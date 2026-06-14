const API_URL = import.meta.env.VITE_API_URL || "";

function getToken(): string | null {
  return localStorage.getItem("lpr_token");
}

export function setToken(token: string): void {
  localStorage.setItem("lpr_token", token);
}

export function removeToken(): void {
  localStorage.removeItem("lpr_token");
}



async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "Error en la solicitud");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ access_token: string; token_type: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<User>("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }).catch(() => {}),

  // Dashboard
  dashboardStats: () => request<DashboardStats>("/dashboard/stats"),
  recentDetections: () => request<Plate[]>("/dashboard/recent-detections"),
  recentAlerts: () => request<Alerta[]>("/dashboard/recent-alerts"),

  // Estadisticas
  estadisticas: () => request<EstadisticasStats>("/api/estadisticas"),

  // Audiencias
  audiencias: () => request<AudienciasData>("/api/audiencias"),

  // Detecciones (plates)
  getDetections: (params?: DetectionFilters) => {
    const q = new URLSearchParams();
    if (params?.plate) q.set("plate", params.plate);
    if (params?.authorized !== undefined) q.set("authorized", String(params.authorized));
    if (params?.camera_id) q.set("camera_id", params.camera_id);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    return request<Plate[]>(`/detections?${q}`);
  },

  // Alertas
  getAlertas: () => request<Alerta[]>("/alertas"),
  resolveAlerta: (id: number) =>
    request<Alerta>(`/alertas/${id}/resolve`, { method: "PATCH" }),

  // Vehicles
  getVehicles: (search?: string) => {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    return request<Vehicle[]>(`/vehicles${q}`);
  },
  createVehicle: (data: VehicleCreate) =>
    request<Vehicle>("/vehicles", { method: "POST", body: JSON.stringify(data) }),
  updateVehicle: (id: number, data: Partial<VehicleCreate>) =>
    request<Vehicle>(`/vehicles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteVehicle: (id: number) =>
    request<void>(`/vehicles/${id}`, { method: "DELETE" }),

  // Cameras
  getCameras: () => request<Camera[]>("/cameras"),
  createCamera: (data: CameraCreate) =>
    request<Camera>("/cameras", { method: "POST", body: JSON.stringify(data) }),
  updateCamera: (id: string, data: Partial<CameraCreate>) =>
    request<Camera>(`/cameras/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCamera: (id: string) =>
    request<void>(`/cameras/${id}`, { method: "DELETE" }),

  // Simulator
  simulate: (data: SimulationCreate) =>
    request<SimulationResult>("/simulations", { method: "POST", body: JSON.stringify(data) }),
  getSimulations: () => request<Simulation[]>("/simulations"),

  // Users (admin only)
  getUsers: () => request<User[]>("/users"),
  createUser: (data: UserCreate) =>
    request<User>("/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: string, data: Partial<UserCreate>) =>
    request<User>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    request<void>(`/users/${id}`, { method: "DELETE" }),
};

// Types matching Supabase schema
export interface User {
  id: string;
  username: string;
  email: string;
  role: "administrador" | "operador";
  status: "activo" | "inactivo";
  created_at: string;
}

export interface Camera {
  id: string;
  camera_code: string;
  name: string;
  location: string;
  status: "activo" | "inactivo";
  active: boolean;
  last_connection: string | null;
  created_at: string;
  latitud: number | null;   // 
  longitud: number | null;  //
}

export interface Vehicle {
  id: number;
  plate: string;
  owner: string;
  vehicle_type: string;
  observations: string | null;
  registered_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Plate {
  id: number;
  plate_text: string;
  camera_id: string;
  vehicle_id: number | null;
  yolo_confidence: number | null;
  ocr_confidence: number | null;
  authorized: boolean;
  image_url: string | null;
  vehicle_type: string | null;
  detection_timestamp: string;
  inserted_at: string;
  camera?: Camera;
}

export interface Alerta {
  id: number;
  plate_id: number | null;
  camera_id: string;
  plate_text: string;
  estado_envio: "pendiente" | "enviado" | "fallido";
  resolved: boolean;
  fecha: string;
  inserted_at: string;
}

export interface Simulation {
  id: number;
  camera_code: string;
  city: string;
  plate_text: string;
  vehicle_type: string;
  authorized: boolean;
  simulation_timestamp: string;
  inserted_at: string;
}

export interface DashboardStats {
  total_detections: number;
  authorized: number;
  unauthorized: number;
  open_alerts: number;
  registered_vehicles: number;
  active_cameras: number;
}

export interface EstadisticasStats {
  processingData: Array<{ time: string; value: number }>;
  trafficData: Array<{ hour: string; vehicles: number }>;
  categoryData: Array<{ name: string; auth: number; denied: number }>;
  heatmapData: number[][];
  activeCameras: number;
  inactiveCameras: number;
  criticalAlerts: number;
  averageConfidence: number;
  totalAuthorized: number;
  totalDenied: number;
  totalDetections: number;
}

export type AudienciaBadge = "Residente" | "Visitante" | "Tránsito";

export interface PlacaAudiencia {
  plate_text: string;
  count: number;
  badge: AudienciaBadge;
  vehicle_type: string;
  authorized: boolean;
  peak_hour: string;
  top_camera_id: string;
  first_seen: string;
  last_seen: string;
}

export interface AudienciasData {
  total_placas: number;
  residentes: number;
  visitantes: number;
  transito: number;
  recurrence_rate: number;
  placas: PlacaAudiencia[];
}

export interface DetectionFilters {
  plate?: string;
  authorized?: boolean;
  camera_id?: string;
  from?: string;
  to?: string;
}

export interface VehicleCreate {
  plate: string;
  owner: string;
  vehicle_type: string;
  observations?: string;
}

export interface CameraCreate {
  camera_code: string;
  name: string;
  location: string;
  status: "activo" | "inactivo";
  active: boolean;
  latitud?: number | null;   // 
  longitud?: number | null;  // 
}
export interface UserCreate {
  username: string;
  email: string;
  password: string;
  role: "administrador" | "operador";
  status: "activo" | "inactivo";
}

export interface SimulationCreate {
  camera_code: string;
  city: string;
  plate_text: string;
  vehicle_type: string;
}

export interface SimulationResult {
  authorized: boolean;
  plate_text: string;
  simulation: Simulation;
}
