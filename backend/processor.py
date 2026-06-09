from pathlib import Path
from ultralytics import YOLO
from paddleocr import PaddleOCR
import numpy as np
import cv2
import re

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "runs" / "detect" / "train-5" / "weights" / "best.pt"

if not MODEL_PATH.exists():
    raise FileNotFoundError(f"No se encontró el modelo YOLO en: {MODEL_PATH}")

yolo_model = YOLO(str(MODEL_PATH))
print(f"Modelo YOLO cargado desde: {MODEL_PATH}")

ocr = PaddleOCR(
    use_angle_cls=True,
    lang="en",
)

print("Modelos cargados.")


def corregir_placa(text: str) -> str:
    text = re.sub(r"[^A-Z0-9]", "", text.upper())
    if len(text) < 5:
        return text

    text = text[:6]
    letras = text[:3]
    letras = letras.replace("0", "O").replace("1", "I").replace("5", "S").replace("6", "G").replace("8", "B")

    numeros = text[3:]
    numeros = numeros.replace("O", "0").replace("I", "1").replace("S", "5").replace("G", "6").replace("B", "8")

    return letras + numeros


def detectar_placa(frame: np.ndarray) -> list:
    results = yolo_model(frame, conf=0.05, verbose=False)
    print(f"YOLO detectó {sum(len(r.boxes) for r in results)} objetos")

    placas = []

    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf_yolo = float(box.conf[0])

            h, w = frame.shape[:2]
            x1, y1 = max(0, x1 - 10), max(0, y1 - 10)
            x2, y2 = min(w, x2 + 10), min(h, y2 + 10)

            crop = frame[y1:y2, x1:x2]
            if crop.size == 0:
                continue

            cv2.imwrite("debug_crop.jpg", crop)

            crop_big = cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4)
            cv2.imwrite("debug_processed.jpg", crop_big)

            ocr_res = ocr.ocr(crop_big)

            if not ocr_res or not ocr_res[0]:
                print("OCR sin resultados")
                continue

            for line in ocr_res[0]:
                text_raw = line[1][0]
                prob = line[1][1]

                print(f"OCR raw: '{text_raw}' prob: {prob:.2f}")

                text = corregir_placa(text_raw)

                print(f"OCR corregido: '{text}'")

                if prob > 0.3 and re.match(r"^[A-Z]{3}\d{3}$", text):
                    placas.append({
                        "placa": text,
                        "confianza_yolo": round(conf_yolo, 2),
                        "confianza_ocr": round(prob, 2)
                    })

    return placas