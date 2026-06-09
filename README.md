# Sistema Inteligente de Reconocimiento de Placas v2.0

## Estructura del proyecto

```
proyecto/
├── backend/
│   ├── api.py              ← FastAPI principal (registra todos los routers)
│   ├── database.py         ← Todas las funciones de Supabase
│   ├── processor.py        ← YOLO + OCR (sin lógica de negocio)
│   └── routes/
│       ├── detections.py   ← POST /detections/detect  GET /detections/
│       ├── vehicles.py     ← CRUD /vehicles/
│       ├── alerts.py       ← GET/PATCH /alerts/
│       ├── cameras.py      ← GET /cameras/
│       └── stats.py        ← GET /stats/
│
└── frontend/               ← Next.js 14 + Tailwind
    └── src/
        ├── app/
        │   ├── dashboard/  ← Resumen general
        │   ├── vehicles/   ← Vehículos autorizados (CRUD)
        │   ├── detections/ ← Historial de detecciones
        │   ├── cameras/    ← Estado de cámaras
        │   ├── stats/      ← Estadísticas y gráficos
        │   └── alerts/     ← Alertas de acceso no autorizado
        ├── components/
        │   └── Sidebar.tsx
        └── lib/
            └── api.ts      ← Cliente HTTP tipado
```

## Tablas Supabase necesarias

```sql
-- Vehículos autorizados
create table vehicles (
  id          bigint primary key generated always as identity,
  plate       text not null unique,
  owner       text,
  description text,
  created_at  timestamptz default now()
);

-- Cada detección individual
create table detections (
  id          bigint primary key generated always as identity,
  plate       text not null,
  camera_id   int,
  confidence  float,
  authorized  boolean,
  image_url   text,
  timestamp   timestamptz default now()
);

-- Alertas de acceso no autorizado
create table alertas (
  id          bigint primary key generated always as identity,
  plate       text not null,
  camera_id   int,
  timestamp   timestamptz default now(),
  resolved    boolean default false
);

-- Cámaras registradas
create table cameras (
  id       bigint primary key generated always as identity,
  name     text not null,
  location text,
  active   boolean default true
);
```

## Levantar el backend

```bash
cd backend
pip install -r requirements_clean.txt```

## Levantar el frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
# Abre http://localhost:3000
```

## Flujo de detección

```
Imagen → YOLO → OCR → corregir_placa()
                           ↓
                   is_authorized_plate()  →  tabla vehicles
                           ↓
                   save_detection()       →  tabla detections
                           ↓
               (si no autorizado)
                   create_alert()         →  tabla alertas
                           ↓
                   save_plate()           →  tabla plates (imagen)
                           ↓
              Respuesta API:
              { plate, authorized, status, confidence }
```

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /detections/detect | Enviar imagen para detectar |
| GET | /detections/ | Listar detecciones |
| GET | /vehicles/ | Listar vehículos autorizados |
| POST | /vehicles/ | Agregar vehículo |
| DELETE | /vehicles/{plate} | Eliminar vehículo |
| GET | /vehicles/check/{plate} | Verificar si está autorizada |
| GET | /alerts/ | Listar alertas |
| PATCH | /alerts/{id}/resolve | Resolver alerta |
| GET | /stats/ | Estadísticas globales |
| GET | /cameras/ | Listar cámaras |
