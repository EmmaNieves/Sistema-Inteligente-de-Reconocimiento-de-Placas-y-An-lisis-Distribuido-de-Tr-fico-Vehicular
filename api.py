from fastapi import FastAPI, UploadFile, File
from ultralytics import YOLO
from paddleocr import PaddleOCR
import numpy as np
import cv2
from database import save_plate
import re

app = FastAPI()

yolo_model = YOLO("runs/detect/placas_combinado2/weights/best.pt")
ocr = PaddleOCR() 

print("Modelos cargados. Servidor listo.")


def corregir_placa(text: str) -> str:
    # Limpia todo excepto letras y números
    text = re.sub(r'[^A-Z0-9]', '', text.upper())

    if len(text) < 5:
        return text

    text = text[:6]

    letras = text[:3]
    letras = letras.replace("0", "O")
    letras = letras.replace("1", "I")
    letras = letras.replace("5", "S")
    letras = letras.replace("6", "G")
    letras = letras.replace("8", "B")

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

    results = yolo_model(frame, conf=0.05, verbose=False)
    print(f"YOLO detectó {sum(len(r.boxes) for r in results)} objetos")
    placas_detectadas = []

    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])

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

            # Escalar x4
            crop_big = cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4)
            cv2.imwrite("debug_processed.jpg", crop_big)

            ocr_res = ocr.ocr(crop_big)
            if not ocr_res or not ocr_res[0]:
                print("OCR sin resultados")
                continue

            for line in ocr_res[0]:
                text_raw = line[1][0]
                prob = line[1][1]
                print(f"OCR raw: '{text_raw}' prob:{prob:.2f}")

                text = corregir_placa(text_raw)
                print(f"OCR corregido: '{text}'")

                if prob > 0.3 and re.match(r'^[A-Z]{3}\d{3}$', text):
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