import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, Camera, SimulationCreate } from "@/lib/api";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { MapPin, Play, Pause, Square, Zap, AlertTriangle } from "lucide-react";

// ─── Leaflet CSS ──────────────────────────────────────────────────────────────
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icons (Vite asset issue)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Types ───────────────────────────────────────────────────────────────────
interface LiveEvent {
  camera_code: string;
  plate_text: string;
  authorized: boolean;
  timestamp: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const RIOHACHA_CENTER: [number, number] = [11.5444, -72.9072];
const PLATES_POOL = [
  "ABC123","XYZ789","DEF456","GHI012","JKL345","MNO678",
  "PQR901","STU234","VWX567","YZA890","BCR441","MND772",
  "PLT993","KZA114","FGH225","WER336","NMB447","QAZ558",
];
const SPEEDS = { ligero: 2000, normal: 1000, pico: 400 };

// ─── Camera marker icons ──────────────────────────────────────────────────────
function makeCameraIcon(active: boolean, pulsing: boolean) {
  const color = pulsing ? "#fc6c03" : active ? "#22c55e" : "#6b7280";
  const pulse = pulsing
    ? `<circle cx="16" cy="16" r="14" fill="${color}" opacity="0.25">
         <animate attributeName="r" values="14;22;14" dur="1s" repeatCount="indefinite"/>
         <animate attributeName="opacity" values="0.25;0;0.25" dur="1s" repeatCount="indefinite"/>
       </circle>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    ${pulse}
    <circle cx="16" cy="16" r="12" fill="${color}" stroke="white" stroke-width="2"/>
    <path d="M10 13h2l2-2h4l2 2h2a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" fill="white" opacity="0.9"/>
    <circle cx="16" cy="17" r="2.5" fill="${color}"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Mapa() {
  const mapRef = useRef<L.Map | null>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const heatCirclesRef = useRef<Record<string, L.Circle>>({});
  const detectionCountRef = useRef<Record<string, number>>({});
  const detectionTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [simRunning, setSimRunning] = useState(false);
  const [simPaused, setSimPaused] = useState(false);
  const [simSpeed, setSimSpeed] = useState<keyof typeof SPEEDS>("normal");
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [pulsingCams, setPulsingCams] = useState<Set<string>>(new Set());

  const { data: cameras = [] } = useQuery<Camera[]>({
    queryKey: ["/api/cameras"],
    queryFn: () => api.getCameras(),
    refetchInterval: 30000,
  });

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    const map = L.map(mapDivRef.current, {
      center: RIOHACHA_CENTER,
      zoom: 14,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Draw camera markers ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    cameras.forEach((cam) => {
      if (cam.latitud == null || cam.longitud == null) return;
      const marker = L.marker([cam.latitud, cam.longitud], {
        icon: makeCameraIcon(cam.active, false),
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family:sans-serif;min-width:160px">
          <p style="font-weight:700;margin:0 0 4px;color:#253232">${cam.name}</p>
          <p style="font-size:12px;color:#6b7280;margin:0">${cam.camera_code}</p>
          <p style="font-size:12px;color:#6b7280;margin:4px 0 0">${cam.location}</p>
          <span style="display:inline-block;margin-top:6px;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;background:${cam.active ? "#dcfce7" : "#f3f4f6"};color:${cam.active ? "#16a34a" : "#6b7280"}">
            ${cam.active ? "Activa" : "Inactiva"}
          </span>
        </div>
      `);

      markersRef.current[cam.camera_code] = marker;
    });
  }, [cameras]);

  // ── Update marker icons when pulsing changes ─────────────────────────────────
  useEffect(() => {
    cameras.forEach((cam) => {
      const marker = markersRef.current[cam.camera_code];
      if (!marker) return;
      marker.setIcon(makeCameraIcon(cam.active, pulsingCams.has(cam.camera_code)));
    });
  }, [pulsingCams, cameras]);

  // ── Handle a detection event (real or simulated) ─────────────────────────────
  const handleDetection = (camera_code: string, plate_text: string, authorized: boolean) => {
    // Add to live feed
    const event: LiveEvent = { camera_code, plate_text, authorized, timestamp: Date.now() };
    setLiveEvents(prev => [event, ...prev].slice(0, 30));

    // Pulse marker
    setPulsingCams(prev => new Set(prev).add(camera_code));
    setTimeout(() => {
      setPulsingCams(prev => { const s = new Set(prev); s.delete(camera_code); return s; });
    }, 1500);

    // Show popup briefly
    const marker = markersRef.current[camera_code];
    if (marker) {
      marker.bindPopup(`
        <div style="font-family:sans-serif;text-align:center;padding:4px">
          <p style="font-size:18px;font-weight:800;font-family:monospace;margin:0;color:#253232">${plate_text}</p>
          <span style="display:inline-block;margin-top:4px;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;background:${authorized ? "#dcfce7" : "#fee2e2"};color:${authorized ? "#16a34a" : "#dc2626"}">
            ${authorized ? "✓ Autorizado" : "✗ Denegado"}
          </span>
        </div>
      `).openPopup();
      setTimeout(() => marker.closePopup(), 2500);
    }

    // Heatmap logic
    const map = mapRef.current;
    const cam = cameras.find(c => c.camera_code === camera_code);
    if (!map || !cam || cam.latitud == null || cam.longitud == null) return;

    detectionCountRef.current[camera_code] = (detectionCountRef.current[camera_code] || 0) + 1;

    if (detectionCountRef.current[camera_code] >= 5) {
      if (!heatCirclesRef.current[camera_code]) {
        const circle = L.circle([cam.latitud, cam.longitud], {
          radius: 120,
          color: "#ef4444",
          fillColor: "#ef4444",
          fillOpacity: 0.18,
          weight: 2,
        }).addTo(map);
        heatCirclesRef.current[camera_code] = circle;
      }
    }

    // Reset count after 10s of inactivity
    if (detectionTimerRef.current[camera_code]) clearTimeout(detectionTimerRef.current[camera_code]);
    detectionTimerRef.current[camera_code] = setTimeout(() => {
      detectionCountRef.current[camera_code] = 0;
      if (heatCirclesRef.current[camera_code]) {
        heatCirclesRef.current[camera_code].remove();
        delete heatCirclesRef.current[camera_code];
      }
    }, 10000);
  };

  // ── Simulation engine ────────────────────────────────────────────────────────
  const startSim = () => {
    const activeCams = cameras.filter(c => c.latitud != null && c.longitud != null);
    if (!activeCams.length) return;

    setSimRunning(true);
    setSimPaused(false);

    const tick = () => {
      const cam = activeCams[Math.floor(Math.random() * activeCams.length)];
      const plate = PLATES_POOL[Math.floor(Math.random() * PLATES_POOL.length)];
      const authorized = Math.random() > 0.3;

      // Fire to backend (no await, best-effort)
      api.simulate({ camera_code: cam.camera_code, city: cam.location, plate_text: plate, vehicle_type: "automovil" } as SimulationCreate).catch(() => {});

      handleDetection(cam.camera_code, plate, authorized);
    };

    simIntervalRef.current = setInterval(tick, SPEEDS[simSpeed]);
  };

  const pauseSim = () => {
    if (simIntervalRef.current) { clearInterval(simIntervalRef.current); simIntervalRef.current = null; }
    setSimPaused(true);
  };

  const resumeSim = () => {
    setSimPaused(false);
    const activeCams = cameras.filter(c => c.latitud != null && c.longitud != null);
    if (!activeCams.length) return;
    const tick = () => {
      const cam = activeCams[Math.floor(Math.random() * activeCams.length)];
      const plate = PLATES_POOL[Math.floor(Math.random() * PLATES_POOL.length)];
      const authorized = Math.random() > 0.3;
      api.simulate({ camera_code: cam.camera_code, city: cam.location, plate_text: plate, vehicle_type: "automovil" } as SimulationCreate).catch(() => {});
      handleDetection(cam.camera_code, plate, authorized);
    };
    simIntervalRef.current = setInterval(tick, SPEEDS[simSpeed]);
  };

  const stopSim = () => {
    if (simIntervalRef.current) { clearInterval(simIntervalRef.current); simIntervalRef.current = null; }
    setSimRunning(false);
    setSimPaused(false);
    setLiveEvents([]);
    // Clear heatmap
    Object.values(heatCirclesRef.current).forEach(c => c.remove());
    heatCirclesRef.current = {};
    detectionCountRef.current = {};
  };

  useEffect(() => () => { if (simIntervalRef.current) clearInterval(simIntervalRef.current); }, []);

  const camsOnMap = cameras.filter(c => c.latitud != null && c.longitud != null);
  const camsNoCoords = cameras.filter(c => c.latitud == null || c.longitud == null);

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#253232]" style={{ fontFamily: "'Fredoka One', Helvetica" }}>
              Mapa de Tráfico
            </h1>
            <p className="text-sm text-gray-500">
              {camsOnMap.length} cámara{camsOnMap.length !== 1 ? "s" : ""} activa{camsOnMap.length !== 1 ? "s" : ""} en el mapa
            </p>
          </div>

          {/* Speed selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Velocidad:</span>
            {(Object.keys(SPEEDS) as (keyof typeof SPEEDS)[]).map(s => (
              <button
                key={s}
                onClick={() => setSimSpeed(s)}
                className={`text-xs px-3 py-1 rounded-lg font-medium transition-all ${
                  simSpeed === s
                    ? "bg-[#fc6c03] text-white"
                    : "bg-white text-gray-500 border border-gray-200 hover:border-[#fc6c03]"
                }`}
              >
                {s === "ligero" ? "Ligero" : s === "normal" ? "Normal" : "Hora pico"}
              </button>
            ))}
          </div>
        </div>

        {/* Warning if cameras have no coords */}
        {camsNoCoords.length > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-700">
            <AlertTriangle size={15} />
            {camsNoCoords.length} cámara{camsNoCoords.length > 1 ? "s" : ""} sin coordenadas ({camsNoCoords.map(c => c.camera_code).join(", ")}). Edítalas en la sección Cámaras.
          </div>
        )}

        <div className="flex gap-4 h-[calc(100vh-220px)]">
          {/* Map */}
          <div className="relative flex-1 rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div ref={mapDivRef} className="w-full h-full" />

            {/* Sim control panel (floating) */}
            <div className="absolute top-4 left-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-4 min-w-[200px]">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Simulación de Tráfico
              </p>

              {!simRunning ? (
                <Button
                  onClick={startSim}
                  disabled={camsOnMap.length === 0}
                  className="w-full bg-[#fc6c03] hover:bg-[#e05f00] text-white rounded-xl text-sm"
                >
                  <Play size={14} className="mr-1.5" /> Iniciar Simulación
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full bg-[#fc6c03] animate-pulse" />
                    <span className="text-xs font-medium text-[#fc6c03]">
                      {simPaused ? "Pausado" : "Simulando..."}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {simPaused ? (
                      <Button onClick={resumeSim} size="sm" className="flex-1 bg-[#fc6c03] hover:bg-[#e05f00] text-white rounded-xl text-xs">
                        <Play size={12} className="mr-1" /> Reanudar
                      </Button>
                    ) : (
                      <Button onClick={pauseSim} size="sm" variant="outline" className="flex-1 rounded-xl text-xs">
                        <Pause size={12} className="mr-1" /> Pausar
                      </Button>
                    )}
                    <Button onClick={stopSim} size="sm" variant="outline" className="rounded-xl text-xs text-red-500 border-red-200 hover:bg-red-50">
                      <Square size={12} />
                    </Button>
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-400 mb-2">Leyenda</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" /> Cámara activa
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-3 h-3 rounded-full bg-gray-400 flex-shrink-0" /> Cámara inactiva
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-3 h-3 rounded-full bg-[#fc6c03] flex-shrink-0" /> Detección en curso
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-3 h-3 rounded-full bg-red-400 opacity-60 flex-shrink-0" /> Zona de tráfico pesado
                </div>
              </div>
            </div>
          </div>

          {/* Live feed */}
          <div className="w-72 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
              <Zap size={14} className="text-[#fc6c03]" />
              <p className="text-sm font-semibold text-[#253232]">Registro en vivo</p>
              {liveEvents.length > 0 && (
                <span className="ml-auto text-xs bg-[#fc6c03]/10 text-[#fc6c03] px-2 py-0.5 rounded-full font-medium">
                  {liveEvents.length}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {liveEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2 py-12">
                  <MapPin size={32} />
                  <p className="text-xs text-center">Inicia la simulación o espera<br />detecciones en tiempo real</p>
                </div>
              ) : (
                liveEvents.map((e, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-sm font-mono font-bold text-[#253232]">{e.plate_text}</p>
                      <p className="text-xs text-gray-400">{e.camera_code}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      e.authorized ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {e.authorized ? "✓" : "✗"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
