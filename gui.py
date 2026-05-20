import tkinter as tk
from tkinter import font as tkfont
import threading
import requests
import time
from PIL import Image, ImageTk
from datetime import datetime
from io import BytesIO

# ──────────────────────────────────────────────
#  Configuración
# ──────────────────────────────────────────────
API_URL = "http://localhost:8000"
POLL_INTERVAL = 3000  # ms entre cada consulta a la API

# ──────────────────────────────────────────────
#  Colores
# ──────────────────────────────────────────────
BG      = "#0a0d14"
PANEL   = "#111827"
CARD    = "#1a2235"
BORDER  = "#1e3a5f"
ACCENT  = "#00d4ff"
ACCENT2 = "#0080ff"
GREEN   = "#00ff88"
RED     = "#ff3860"
YELLOW  = "#ffd700"
TEXT    = "#e2e8f0"
MUTED   = "#64748b"
WHITE   = "#ffffff"


class PlacasApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("PLACAS DETECTOR v3.0")
        self.configure(bg=BG)
        self.geometry("1280x780")
        self.resizable(True, True)
        self.minsize(960, 640)

        # Estado
        self.status_text   = tk.StringVar(value="Conectando con el servidor...")
        self.plate_result  = tk.StringVar(value="—")
        self.api_online    = False
        self.last_plate_id = None
        self.current_image = None

        self._build_ui()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        # Iniciar polling
        self.after(500, self._check_api_status)
        self.after(1000, self._poll_placas)

    # ── UI ────────────────────────────────────
    def _build_ui(self):
        self.font_title = tkfont.Font(family="Courier New", size=20, weight="bold")
        self.font_label = tkfont.Font(family="Courier New", size=10)
        self.font_plate = tkfont.Font(family="Courier New", size=38, weight="bold")
        self.font_small = tkfont.Font(family="Courier New", size=9)
        self.font_hist  = tkfont.Font(family="Courier New", size=9)

        # Header
        header = tk.Frame(self, bg=PANEL, height=60)
        header.pack(fill="x")
        header.pack_propagate(False)
        tk.Label(header, text="◈  SISTEMA DE RECONOCIMIENTO DE PLACAS",
                 font=self.font_title, fg=ACCENT, bg=PANEL).pack(side="left", padx=20, pady=12)
        self._api_dot = tk.Label(header, text="● SERVIDOR OFFLINE",
                                  font=self.font_small, fg=RED, bg=PANEL)
        self._api_dot.pack(side="right", padx=20)

        tk.Frame(self, bg=ACCENT2, height=2).pack(fill="x")

        # Cuerpo
        body = tk.Frame(self, bg=BG)
        body.pack(fill="both", expand=True, padx=16, pady=12)

        # ── Columna izquierda — imagen ──
        left = tk.Frame(body, bg=BG)
        left.pack(side="left", fill="both", expand=True)

        img_header = tk.Frame(left, bg=CARD, height=32)
        img_header.pack(fill="x")
        img_header.pack_propagate(False)
        tk.Label(img_header, text="● ÚLTIMA CAPTURA",
                 font=self.font_label, fg=ACCENT, bg=CARD).pack(side="left", padx=10)
        self._cam_dot = tk.Label(img_header, text="◎ ESPERANDO",
                                  font=self.font_small, fg=MUTED, bg=CARD)
        self._cam_dot.pack(side="right", padx=10)

        self.img_canvas = tk.Canvas(left, bg="#060a12",
                                     highlightthickness=1, highlightbackground=BORDER)
        self.img_canvas.pack(fill="both", expand=True)
        self.after(200, self._draw_idle)

        # ── Columna derecha ──
        right = tk.Frame(body, bg=BG, width=320)
        right.pack(side="right", fill="y", padx=(14, 0))
        right.pack_propagate(False)

        # Resultado
        result_card = tk.Frame(right, bg=CARD)
        result_card.pack(fill="x", pady=(0, 10))
        tk.Label(result_card, text="ÚLTIMA PLACA DETECTADA",
                 font=self.font_small, fg=MUTED, bg=CARD).pack(anchor="w", padx=14, pady=(12, 4))

        self.plate_badge = tk.Frame(result_card, bg="#0d1a2e", height=90)
        self.plate_badge.pack(fill="x", padx=14, pady=4)
        self.plate_badge.pack_propagate(False)
        self.plate_lbl = tk.Label(self.plate_badge, textvariable=self.plate_result,
                                   font=self.font_plate, fg=ACCENT, bg="#0d1a2e")
        self.plate_lbl.place(relx=0.5, rely=0.5, anchor="center")

        self.result_lbl = tk.Label(result_card, text="",
                                    font=self.font_label, bg=CARD, fg=TEXT)
        self.result_lbl.pack(pady=(4, 12))

        # Estado
        status_card = tk.Frame(right, bg=CARD)
        status_card.pack(fill="x", pady=(0, 10))
        tk.Label(status_card, text="ESTADO", font=self.font_small,
                 fg=MUTED, bg=CARD).pack(anchor="w", padx=14, pady=(10, 2))
        tk.Label(status_card, textvariable=self.status_text,
                 font=self.font_small, fg=TEXT, bg=CARD,
                 wraplength=280, justify="left").pack(anchor="w", padx=14, pady=(0, 10))

        # Historial
        hist_card = tk.Frame(right, bg=CARD)
        hist_card.pack(fill="both", expand=True)
        tk.Label(hist_card, text="HISTORIAL", font=self.font_small,
                 fg=MUTED, bg=CARD).pack(anchor="w", padx=14, pady=(10, 4))
        self.hist_frame = tk.Frame(hist_card, bg=CARD)
        self.hist_frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))

        # Footer
        footer = tk.Frame(self, bg=PANEL, height=28)
        footer.pack(fill="x", side="bottom")
        footer.pack_propagate(False)
        tk.Label(footer, text="YOLOv8  ·  EasyOCR  ·  FastAPI  ·  Supabase",
                 font=self.font_small, fg=MUTED, bg=PANEL).pack(side="left", padx=14)
        self._clock_lbl = tk.Label(footer, text="", font=self.font_small, fg=MUTED, bg=PANEL)
        self._clock_lbl.pack(side="right", padx=14)
        self._tick_clock()

    # ── Idle canvas ───────────────────────────
    def _draw_idle(self):
        self.img_canvas.delete("all")
        self.img_canvas.update_idletasks()
        w = self.img_canvas.winfo_width() or 800
        h = self.img_canvas.winfo_height() or 500
        self.img_canvas.create_text(w // 2, h // 2,
            text="Esperando captura del dispositivo...",
            fill=MUTED, font=self.font_label)

    # ── Polling API ───────────────────────────
    def _check_api_status(self):
        def check():
            try:
                r = requests.get(f"{API_URL}/", timeout=2)
                online = r.status_code == 200
            except Exception:
                online = False
            self.after(0, lambda: self._set_api_status(online))
        threading.Thread(target=check, daemon=True).start()
        self.after(5000, self._check_api_status)

    def _set_api_status(self, online):
        self.api_online = online
        if online:
            self._api_dot.config(text="● SERVIDOR ONLINE", fg=GREEN)
            self.status_text.set("✅ Servidor activo — esperando capturas")
        else:
            self._api_dot.config(text="● SERVIDOR OFFLINE", fg=RED)
            self.status_text.set("❌ Servidor offline — corre api.py")

    def _poll_placas(self):
        def fetch():
            try:
                r = requests.get(f"{API_URL}/placas", timeout=3)
                if r.status_code == 200:
                    data = r.json()
                    placas = data.get("placas", [])
                    self.after(0, lambda: self._update_ui(placas))
            except Exception:
                pass
        threading.Thread(target=fetch, daemon=True).start()
        self.after(POLL_INTERVAL, self._poll_placas)

    def _update_ui(self, placas):
        if not placas:
            return

        self._refresh_history(placas)

        ultima = placas[0]
        plate_id = ultima.get("id")
        if plate_id == self.last_plate_id:
            return

        self.last_plate_id = plate_id
        plate_text = ultima.get("plate_text", "")
        image_url  = ultima.get("image_url", "")
        timestamp  = ultima.get("timestamp", "")[:16].replace("T", " ")

        self.plate_result.set(plate_text)
        self.plate_lbl.config(fg=GREEN)
        self.result_lbl.config(text=f"✅ Detectada — {timestamp}", fg=GREEN)
        self.status_text.set(f"Nueva placa detectada: {plate_text}")
        self._cam_dot.config(text="◉ ACTIVA", fg=GREEN)
        self._flash_badge(GREEN, 4)

        if image_url:
            threading.Thread(target=self._load_image, args=(image_url,), daemon=True).start()

    def _load_image(self, url):
        try:
            r = requests.get(url, timeout=5)
            img = Image.open(BytesIO(r.content))
            self.after(0, lambda: self._show_image(img))
        except Exception:
            pass

    def _show_image(self, img):
        try:
            self.img_canvas.update_idletasks()
            cw = self.img_canvas.winfo_width()
            ch = self.img_canvas.winfo_height()
            if cw < 10 or ch < 10:
                return
            img = img.resize((cw, ch), Image.LANCZOS)
            photo = ImageTk.PhotoImage(img)
            self.img_canvas.delete("all")
            self.img_canvas.create_image(0, 0, anchor="nw", image=photo)
            self.img_canvas._photo = photo
        except Exception:
            pass

    # ── Historial ─────────────────────────────
    def _refresh_history(self, placas):
        for w in self.hist_frame.winfo_children():
            w.destroy()
        for p in placas[:15]:
            texto = p.get("plate_text", "")
            ts    = p.get("timestamp", "")[:16].replace("T", " ")
            row   = tk.Frame(self.hist_frame, bg=CARD)
            row.pack(fill="x", pady=1)
            tk.Label(row, text=texto, font=self.font_hist,
                     fg=ACCENT, bg=CARD, width=10, anchor="w").pack(side="left")
            tk.Label(row, text=ts, font=self.font_hist,
                     fg=MUTED, bg=CARD).pack(side="right")

    # ── Flash badge ───────────────────────────
    def _flash_badge(self, color, n):
        if n <= 0:
            self.plate_badge.config(bg="#0d1a2e")
            self.plate_lbl.config(bg="#0d1a2e")
            return
        bg = color if n % 2 == 0 else "#0d1a2e"
        self.plate_badge.config(bg=bg)
        self.plate_lbl.config(bg=bg)
        self.after(200, lambda: self._flash_badge(color, n - 1))

    # ── Reloj ─────────────────────────────────
    def _tick_clock(self):
        self._clock_lbl.config(text=datetime.now().strftime("%Y-%m-%d  %H:%M:%S"))
        self.after(1000, self._tick_clock)

    # ── Cierre ────────────────────────────────
    def _on_close(self):
        self.destroy()


if __name__ == "__main__":
    app = PlacasApp()
    app.mainloop()