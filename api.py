from fastapi import FastAPI, UploadFile, File
from ultralytics import YOLO
import easyocr
import numpy as np
import cv2
from database import save_plate
from datetime import datetime
import re

app = FastAPI()

yolo_model = YOLO("runs/detect/placas_combinado2/weights/best.pt")
reader = easyocr.Reader(["es"], gpu=False)

print("Modelos cargados. Servidor listo.")


def corregir_placa(text: str) -> str:
    """Corrige confusiones comunes de OCR en placas colombianas."""
    text = text.upper().replace(" ", "").replace("-", "").replace(".", "")

    if len(text) < 5:
        return text

    # Tomar solo los primeros 6 caracteres
    text = text[:6]

    # Las primeras 3 son letras — reemplazar números por letras similares
    letras = text[:3]
    letras = letras.replace("0", "O")
    letras = letras.replace("1", "I")
    letras = letras.replace("5", "S")
    letras = letras.replace("6", "G")
    letras = letras.replace("8", "B")

    # Los últimos 3 son números — reemplazar letras por números similares
    numeros = text[3:]
    numeros = numeros.replace("O", "0")
    numeros = numeros.replace("I", "1")
    numeros = numeros.replace("S", "5")
    numeros = numeros.replace("G", "6")
    numeros = numeros.replace("B", "8")

    return letras + numeros


@app.get("/")
def root():
    return {"status": "ok", "mensaje": "Sistema de placas activo"}


@app.post("/detectar")
async def detectar(file: UploadFile = File(...)):
    contents = await file.read()
    np_arr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if frame is None:
        return {"error": "Imagen inválida"}

    frame = cv2.resize(frame, (640, 480))

    results = yolo_model(frame, conf=0.05, verbose=False)
    print(f"YOLO detectó {sum(len(r.boxes) for r in results)} objetos")
    placas_detectadas = []

    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])

            # Margen para no cortar la placa
            h, w = frame.shape[:2]
            x1 = max(0, x1 - 10)
            y1 = max(0, y1 - 10)
            x2 = min(w, x2 + 10)
            y2 = min(h, y2 + 10)

            crop = frame[y1:y2, x1:x2]
            if crop.size == 0:
                continue

            cv2.imwrite("debug_crop.jpg", crop)
            print(f"Recorte: {x1},{y1},{x2},{y2}")

            # Escalar x3 para mejor lectura
            crop_big = cv2.resize(crop, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)


            ocr_res = reader.readtext(
                crop_big,
                allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
                rotation_info=[90, 180, 270]  # prueba múltiples rotaciones
            )

            for (_, text, prob) in ocr_res:
                print(f"OCR raw: '{text}' prob:{prob:.2f}")
                text = corregir_placa(text)
                print(f"OCR corregido: '{text}'")

                if prob > 0.2 and re.match(r'^[A-Z]{3}\d{3}$', text):
                    is_new = save_plate(text, frame)
                    placas_detectadas.append({
                        "placa": text,
                        "confianza_yolo": round(conf, 2),
                        "confianza_ocr": round(prob, 2),
                        "es_nueva": is_new
                    })
                    print(f"✅ Placa guardada: {text}")

    if not placas_detectadas:
        return {"resultado": "sin_deteccion", "placas": []}

    return {"resultado": "ok", "placas": placas_detectadas}


@app.get("/placas")
def listar_placas():
    from database import get_all_plates
    return {"placas": get_all_plates()}