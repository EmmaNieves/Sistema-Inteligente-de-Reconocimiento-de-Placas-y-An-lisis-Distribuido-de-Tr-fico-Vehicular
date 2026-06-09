import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

import cv2
from supabase import Client, create_client


DEFAULT_SUPABASE_URL = "https://ecwomhimxcypilnuatdn.supabase.co"
ENV_FILES = (
    Path(__file__).resolve().parent / ".env",
    Path(__file__).resolve().parent / ".env.local",
    Path(__file__).resolve().parent.parent / ".env",
    Path(__file__).resolve().parent.parent / ".env.local",
)


def _load_env_files() -> None:
    for env_file in ENV_FILES:
        if not env_file.exists():
            continue

        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


_load_env_files()

SUPABASE_URL = os.getenv("SUPABASE_URL", DEFAULT_SUPABASE_URL)
SUPABASE_KEY = (
    os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)
STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "plate-images")

_client: Optional[Client] = None


def _get_client() -> Client:
    global _client

    if not SUPABASE_KEY or SUPABASE_KEY == "TU_KEY_AQUI":
        raise RuntimeError(
            "Falta configurar SUPABASE_KEY. Define SUPABASE_KEY o "
            "SUPABASE_ANON_KEY en backend/.env o en las variables de entorno."
        )

    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_plate(plate: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (plate or "").upper())


def _as_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _first(response: Any) -> Optional[Dict[str, Any]]:
    return response.data[0] if getattr(response, "data", None) else None


def init_db() -> None:
    try:
        client = _get_client()
        client.table("users").select("id").limit(1).execute()
        client.table("cameras").select("id").limit(1).execute()
        client.table("vehicles").select("id").limit(1).execute()
        client.table("plates").select("id").limit(1).execute()
        client.table("alertas").select("id").limit(1).execute()
        client.table("simulations").select("id").limit(1).execute()
        print("Conexion a Supabase OK")
    except Exception as exc:
        print(f"Error conectando a Supabase: {exc}")
        raise


def _upload_image(plate_text: str, image_np: Any) -> str:
    if image_np is None:
        return ""

    try:
        success, buffer = cv2.imencode(".jpg", image_np)
        if not success:
            return ""

        client = _get_client()
        safe_plate = _normalize_plate(plate_text) or "PLACA"
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
        filename = f"{safe_plate}/{timestamp}_{uuid4().hex[:8]}.jpg"

        client.storage.from_(STORAGE_BUCKET).upload(
            path=filename,
            file=buffer.tobytes(),
            file_options={"content-type": "image/jpeg"},
        )
        return client.storage.from_(STORAGE_BUCKET).get_public_url(filename)
    except Exception as exc:
        print(f"Error subiendo imagen: {exc}")
        return ""


def _get_default_camera_id() -> str:
    client = _get_client()

    response = (
        client.table("cameras")
        .select("id")
        .eq("active", True)
        .limit(1)
        .execute()
    )
    camera = _first(response)
    if camera:
        return camera["id"]

    response = (
        client.table("cameras")
        .select("id")
        .eq("status", "activo")
        .limit(1)
        .execute()
    )
    camera = _first(response)
    if camera:
        return camera["id"]

    response = client.table("cameras").select("id").limit(1).execute()
    camera = _first(response)
    if camera:
        return camera["id"]

    raise RuntimeError(
        "No hay camaras registradas. Inserta al menos una fila en public.cameras "
        "antes de guardar detecciones."
    )


def _resolve_camera_id(camera_id: Any = None) -> str:
    if camera_id is None:
        return _get_default_camera_id()

    candidate = str(camera_id).strip()
    if candidate.lower() in {"", "0", "1", "default", "none", "null"}:
        return _get_default_camera_id()

    client = _get_client()

    try:
        UUID(candidate)
    except ValueError:
        response = (
            client.table("cameras")
            .select("id")
            .eq("camera_code", candidate)
            .limit(1)
            .execute()
        )
        camera = _first(response)
        if camera:
            return camera["id"]

        print(f"camera_id/camera_code invalido ({candidate}); usando camara por defecto")
        return _get_default_camera_id()

    response = (
        client.table("cameras")
        .select("id")
        .eq("id", candidate)
        .limit(1)
        .execute()
    )
    if not response.data:
        raise RuntimeError(f"No existe una camara con id {candidate}")

    return candidate


def _get_vehicle_by_plate(plate_text: str) -> Optional[Dict[str, Any]]:
    plate = _normalize_plate(plate_text)
    response = (
        _get_client()
        .table("vehicles")
        .select("id, plate, owner, vehicle_type, observations")
        .eq("plate", plate)
        .limit(1)
        .execute()
    )
    return _first(response)


def _map_vehicle(row: Dict[str, Any]) -> Dict[str, Any]:
    mapped = dict(row)
    mapped["description"] = row.get("observations")
    return mapped


def _map_detection(row: Dict[str, Any]) -> Dict[str, Any]:
    mapped = dict(row)
    mapped["plate"] = row.get("plate_text") or row.get("plate") or ""
    mapped["confidence"] = _as_float(
        row.get("ocr_confidence")
        if row.get("ocr_confidence") is not None
        else row.get("yolo_confidence")
    )
    mapped["timestamp"] = (
        row.get("detection_timestamp")
        or row.get("inserted_at")
        or row.get("timestamp")
        or ""
    )
    return mapped


def _map_alert(row: Dict[str, Any]) -> Dict[str, Any]:
    mapped = dict(row)
    mapped["plate"] = row.get("plate_text") or row.get("plate") or ""
    mapped["timestamp"] = row.get("fecha") or row.get("inserted_at") or ""
    return mapped


def _map_camera(row: Dict[str, Any]) -> Dict[str, Any]:
    mapped = dict(row)
    mapped["name"] = row.get("name") or row.get("camera_code") or "Camara"
    mapped["active"] = bool(row.get("active")) or row.get("status") == "activo"
    return mapped


def plate_exists(plate_text: str) -> bool:
    response = (
        _get_client()
        .table("plates")
        .select("id")
        .eq("plate_text", _normalize_plate(plate_text))
        .limit(1)
        .execute()
    )
    return bool(response.data)


def save_plate(
    plate_text: str,
    image_np: Any,
    camera_id: Any = None,
    yolo_confidence: Optional[float] = None,
    ocr_confidence: Optional[float] = None,
) -> bool:
    save_detection(
        plate_text=plate_text,
        confidence=ocr_confidence if ocr_confidence is not None else yolo_confidence,
        authorized=None,
        camera_id=camera_id,
        image_np=image_np,
        yolo_confidence=yolo_confidence,
        ocr_confidence=ocr_confidence,
    )
    print(f"Placa guardada: {_normalize_plate(plate_text)}")
    return True


def get_all_plates() -> List[Dict[str, Any]]:
    return get_all_detections()


def is_authorized_plate(plate_text: str) -> bool:
    return _get_vehicle_by_plate(plate_text) is not None


def get_all_vehicles() -> List[Dict[str, Any]]:
    response = (
        _get_client()
        .table("vehicles")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return [_map_vehicle(row) for row in response.data]


def add_vehicle(
    plate: str,
    owner: Optional[str] = None,
    description: Optional[str] = None,
    vehicle_type: Optional[str] = None,
    registered_by: Optional[str] = None,
) -> Dict[str, Any]:
    now = _now()
    payload = {
        "plate": _normalize_plate(plate),
        "owner": owner,
        "vehicle_type": vehicle_type,
        "observations": description,
        "registered_by": registered_by,
        "created_at": now,
        "updated_at": now,
    }
    payload = {key: value for key, value in payload.items() if value is not None}

    response = _get_client().table("vehicles").insert(payload).execute()
    return _map_vehicle(response.data[0]) if response.data else {}


def remove_vehicle(plate: str) -> Dict[str, Any]:
    response = (
        _get_client()
        .table("vehicles")
        .delete()
        .eq("plate", _normalize_plate(plate))
        .execute()
    )
    return response.data[0] if response.data else {}


def save_detection(
    plate_text: str,
    confidence: Optional[float] = None,
    authorized: Optional[bool] = None,
    camera_id: Any = None,
    image_url: Optional[str] = None,
    image_np: Any = None,
    yolo_confidence: Optional[float] = None,
    ocr_confidence: Optional[float] = None,
) -> Dict[str, Any]:
    plate = _normalize_plate(plate_text)
    camera_uuid = _resolve_camera_id(camera_id)
    vehicle = _get_vehicle_by_plate(plate)
    is_authorized = vehicle is not None
    now = _now()

    if not image_url:
        image_url = _upload_image(plate, image_np)

    if ocr_confidence is None:
        ocr_confidence = confidence
    if yolo_confidence is None:
        yolo_confidence = confidence

    payload = {
        "plate_text": plate,
        "camera_id": camera_uuid,
        "vehicle_id": vehicle["id"] if vehicle else None,
        "yolo_confidence": yolo_confidence,
        "ocr_confidence": ocr_confidence,
        "authorized": is_authorized,
        "image_url": image_url or None,
        "vehicle_type": vehicle.get("vehicle_type") if vehicle else None,
        "detection_timestamp": now,
        "inserted_at": now,
    }

    response = _get_client().table("plates").insert(payload).execute()
    return _map_detection(response.data[0]) if response.data else {}


def get_all_detections(limit: int = 100) -> List[Dict[str, Any]]:
    response = (
        _get_client()
        .table("plates")
        .select("*")
        .order("detection_timestamp", desc=True)
        .limit(limit)
        .execute()
    )
    return [_map_detection(row) for row in response.data]


def create_alert(
    plate_text: str,
    camera_id: Any = None,
    plate_id: Optional[int] = None,
) -> Dict[str, Any]:
    client = _get_client()
    plate = _normalize_plate(plate_text)
    camera_uuid = _resolve_camera_id(camera_id)

    if plate_id is None:
        response = (
            client.table("plates")
            .select("id, plate_text, camera_id")
            .eq("plate_text", plate)
            .order("detection_timestamp", desc=True)
            .limit(1)
            .execute()
        )
        last_plate = _first(response)
        if not last_plate:
            raise RuntimeError(f"No existe una deteccion previa en plates para {plate}")

        plate_id = last_plate["id"]
        camera_uuid = last_plate.get("camera_id") or camera_uuid

    now = _now()
    payload = {
        "plate_id": plate_id,
        "camera_id": camera_uuid,
        "plate_text": plate,
        "estado_envio": "pendiente",
        "resolved": False,
        "fecha": now,
        "inserted_at": now,
    }

    print(f"Alerta: placa no autorizada {plate}")
    response = client.table("alertas").insert(payload).execute()
    return _map_alert(response.data[0]) if response.data else {}


def get_all_alerts(only_unresolved: bool = False) -> List[Dict[str, Any]]:
    query = _get_client().table("alertas").select("*").order("fecha", desc=True)
    if only_unresolved:
        query = query.eq("resolved", False)

    response = query.execute()
    return [_map_alert(row) for row in response.data]


def resolve_alert(alert_id: int) -> Dict[str, Any]:
    response = (
        _get_client()
        .table("alertas")
        .update({"resolved": True})
        .eq("id", alert_id)
        .execute()
    )
    return _map_alert(response.data[0]) if response.data else {}


def get_all_cameras() -> List[Dict[str, Any]]:
    response = (
        _get_client()
        .table("cameras")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return [_map_camera(row) for row in response.data]


def get_stats() -> Dict[str, int]:
    client = _get_client()

    detections = client.table("plates").select("authorized").execute().data
    alerts = (
        client.table("alertas")
        .select("id")
        .eq("resolved", False)
        .execute()
        .data
    )
    vehicles = client.table("vehicles").select("id").execute().data

    total = len(detections)
    authorized = sum(1 for item in detections if item.get("authorized"))

    return {
        "total_detections": total,
        "authorized": authorized,
        "unauthorized": total - authorized,
        "open_alerts": len(alerts),
        "registered_vehicles": len(vehicles),
    }


def save_simulation(
    plate_text: str,
    city: str,
    vehicle_type: Optional[str] = None,
    camera_code: Optional[str] = None,
    authorized: bool = False,
) -> Dict[str, Any]:
    now = _now()
    payload = {
        "camera_code": camera_code or "SIM-DEFAULT",
        "city": city,
        "plate_text": _normalize_plate(plate_text),
        "vehicle_type": vehicle_type,
        "authorized": authorized,
        "simulation_timestamp": now,
        "inserted_at": now,
    }
    response = _get_client().table("simulations").insert(payload).execute()
    return response.data[0] if response.data else {}


def get_dashboard() -> Dict[str, Any]:
    client = _get_client()
    stats = get_stats()

    cameras = client.table("cameras").select("id, status, active").execute().data
    simulations = client.table("simulations").select("id").execute().data
    recent_detections = (
        client.table("plates")
        .select("*")
        .order("detection_timestamp", desc=True)
        .limit(5)
        .execute()
        .data
    )
    recent_alerts = (
        client.table("alertas")
        .select("*")
        .order("fecha", desc=True)
        .limit(5)
        .execute()
        .data
    )
    active_cameras = sum(
        1
        for camera in cameras
        if camera.get("active") is True or camera.get("status") == "activo"
    )

    return {
        **stats,
        "active_cameras": active_cameras,
        "total_simulations": len(simulations),
        "recent_detections": [_map_detection(row) for row in recent_detections],
        "recent_alerts": [_map_alert(row) for row in recent_alerts],
    }
