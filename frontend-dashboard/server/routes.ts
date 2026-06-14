import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { supabase } from "./supabase";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_change_me";

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function makeToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });
}

async function requireAuth(req: Request, res: Response): Promise<any | null> {
  const auth = req.headers["authorization"] || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) { res.status(401).json({ detail: "No autenticado" }); return null; }

  let payload: any;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    res.status(401).json({ detail: "Token inválido o expirado" });
    return null;
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id, username, email, role, status, created_at")
    .eq("id", payload.sub)
    .single();

  if (error || !user) { res.status(401).json({ detail: "Usuario no encontrado" }); return null; }
  return user;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // ── AUTH ──────────────────────────────────────────────────────────────────

  app.post("/auth/login", async (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    if (!username || !password) return res.status(400).json({ detail: "Usuario y contraseña requeridos" });

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .or(`username.eq.${username},email.eq.${username}`)
      .limit(1)
      .maybeSingle();

    if (error || !user) return res.status(401).json({ detail: "Usuario o contraseña incorrectos" });
    if (user.status === "inactivo") return res.status(403).json({ detail: "Tu cuenta está inactiva. Contacta al administrador." });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ detail: "Usuario o contraseña incorrectos" });

    res.json({ access_token: makeToken(user.id), token_type: "bearer" });
  });

  app.get("/auth/me", async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    res.json(user);
  });

  app.post("/auth/logout", (_req, res) => res.status(204).send());

  // ── DASHBOARD ─────────────────────────────────────────────────────────────

  app.get("/dashboard/stats", async (req, res) => {
    if (!await requireAuth(req, res)) return;

    const [plates, alerts, vehicles, cameras] = await Promise.all([
      supabase.from("plates").select("id, authorized"),
      supabase.from("alertas").select("id, resolved"),
      supabase.from("vehicles").select("id", { count: "exact", head: true }),
      supabase.from("cameras").select("id, active"),
    ]);

    const total = plates.data?.length ?? 0;
    const authorized = plates.data?.filter(p => p.authorized).length ?? 0;
    const open_alerts = alerts.data?.filter(a => !a.resolved).length ?? 0;
    const active_cameras = cameras.data?.filter(c => c.active).length ?? 0;

    res.json({
      total_detections: total,
      authorized,
      unauthorized: total - authorized,
      open_alerts,
      registered_vehicles: vehicles.count ?? 0,
      active_cameras,
    });
  });

  // ── ESTADÍSTICAS (Módulo unificado) ───────────────────────────────────────
  app.get("/api/estadisticas", async (req, res) => {
    if (!await requireAuth(req, res)) return;

    try {
      // 1. Consultamos TODAS las tablas necesarias al mismo tiempo (Placas, Cámaras y Alertas)
      const [plates, cameras, alertas] = await Promise.all([
        supabase
          .from("plates")
          .select("authorized, detection_timestamp, inserted_at, vehicle_type, yolo_confidence, ocr_confidence")
          .order("detection_timestamp", { ascending: true }),
        supabase.from("cameras").select("active"),
        supabase.from("alertas").select("resolved")
      ]);

      if (plates.error) return res.status(500).json({ detail: plates.error.message });
      if (cameras.error) return res.status(500).json({ detail: cameras.error.message });
      if (alertas.error) return res.status(500).json({ detail: alertas.error.message });

      // 2. Calculamos la realidad
      const detections = plates.data ?? [];
      const totalAuth = detections.filter(p => p.authorized).length;
      const totalDenied = detections.filter(p => !p.authorized).length;
      const totalDetections = detections.length;

      const activeCameras = cameras.data?.filter(c => c.active).length || 0;
      const inactiveCameras = (cameras.data?.length || 0) - activeCameras;
      const criticalAlerts = alertas.data?.filter(a => !a.resolved).length || 0;

      const getDate = (row: any): Date | null => {
        const value = row.detection_timestamp || row.inserted_at;
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
      };

      const getConfidence = (row: any): number | null => {
        const raw = row.ocr_confidence ?? row.yolo_confidence;
        const value = Number(raw);
        if (!Number.isFinite(value)) return null;
        return value <= 1 ? value * 100 : value;
      };

      const trafficData = Array.from({ length: 24 }, (_, hour) => ({
        hour: `${String(hour).padStart(2, "0")}h`,
        vehicles: 0,
      }));
      const heatCounts = Array.from({ length: 8 }, () => Array(7).fill(0));
      const confidenceBuckets = new Map<string, { total: number; count: number }>();
      const categoryMap = new Map<string, { name: string; auth: number; denied: number }>();
      let totalConfidence = 0;
      let confidenceCount = 0;

      detections.forEach((row: any) => {
        const date = getDate(row);
        if (date) {
          const hour = date.getHours();
          trafficData[hour].vehicles += 1;

          const dayIndex = (date.getDay() + 6) % 7;
          const hourBucket = Math.min(7, Math.floor(hour / 3));
          heatCounts[hourBucket][dayIndex] += 1;

          const confidence = getConfidence(row);
          if (confidence !== null) {
            const label = `${String(hour).padStart(2, "0")}:00`;
            const bucket = confidenceBuckets.get(label) ?? { total: 0, count: 0 };
            bucket.total += confidence;
            bucket.count += 1;
            confidenceBuckets.set(label, bucket);
            totalConfidence += confidence;
            confidenceCount += 1;
          }
        }

        const categoryName = String(row.vehicle_type || "Sin tipo");
        const category = categoryMap.get(categoryName) ?? { name: categoryName, auth: 0, denied: 0 };
        if (row.authorized) category.auth += 1;
        else category.denied += 1;
        categoryMap.set(categoryName, category);
      });

      const processingData = Array.from(confidenceBuckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([time, bucket]) => ({
          time,
          value: Number((bucket.total / bucket.count).toFixed(1)),
        }));

      const maxHeat = Math.max(0, ...heatCounts.flat());
      const heatmapData = heatCounts.map(row =>
        row.map(count => maxHeat === 0 ? 0 : Math.max(1, Math.ceil((count / maxHeat) * 5)))
      );

      const categoryData = Array.from(categoryMap.values())
        .sort((a, b) => (b.auth + b.denied) - (a.auth + a.denied));
      const averageConfidence = confidenceCount > 0
        ? Number((totalConfidence / confidenceCount).toFixed(1))
        : 0;

      // 3. Enviamos los datos
      res.json({
        processingData,
        trafficData,
        categoryData,
        heatmapData,
        // ✨ AQUÍ AGREGAMOS TUS NUEVOS DATOS REALES
        activeCameras,
        inactiveCameras,
        criticalAlerts,
        averageConfidence,
        totalAuthorized: totalAuth,
        totalDenied,
        totalDetections
      });

    } catch (error) {
      console.error("Error obteniendo estadísticas:", error);
      res.status(500).json({ detail: "Error interno al generar estadísticas" });
    }
  });

  app.get("/dashboard/recent-detections", async (req, res) => {
    if (!await requireAuth(req, res)) return;
    const { data, error } = await supabase
      .from("plates")
      .select("*")
      .order("detection_timestamp", { ascending: false })
      .limit(6);
    if (error) return res.status(500).json({ detail: error.message });
    res.json(data);
  });

  app.get("/dashboard/recent-alerts", async (req, res) => {
    if (!await requireAuth(req, res)) return;
    const { data, error } = await supabase
      .from("alertas")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(6);
    if (error) return res.status(500).json({ detail: error.message });
    res.json(data);
  });

  // ── DETECTIONS ────────────────────────────────────────────────────────────

  app.get("/detections", async (req, res) => {
    if (!await requireAuth(req, res)) return;
    let query = supabase.from("plates").select("*").order("detection_timestamp", { ascending: false });

    if (req.query.plate) query = query.ilike("plate_text", `%${req.query.plate}%`);
    if (req.query.authorized !== undefined) query = query.eq("authorized", req.query.authorized === "true");
    if (req.query.camera_id) query = query.eq("camera_id", req.query.camera_id);
    if (req.query.from) query = query.gte("detection_timestamp", req.query.from as string);
    if (req.query.to) query = query.lte("detection_timestamp", req.query.to as string);

    const { data, error } = await query.limit(200);
    if (error) return res.status(500).json({ detail: error.message });
    res.json(data);
  });

  // ── ALERTAS ───────────────────────────────────────────────────────────────

  app.get("/alertas", async (req, res) => {
    if (!await requireAuth(req, res)) return;
    const { data, error } = await supabase
      .from("alertas")
      .select("*")
      .order("fecha", { ascending: false });
    if (error) return res.status(500).json({ detail: error.message });
    res.json(data);
  });

  app.patch("/alertas/:id/resolve", async (req, res) => {
    if (!await requireAuth(req, res)) return;
    const { data, error } = await supabase
      .from("alertas")
      .update({ resolved: true })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) return res.status(500).json({ detail: error.message });
    res.json(data);
  });

  // ── VEHICLES ──────────────────────────────────────────────────────────────

  app.get("/vehicles", async (req, res) => {
    if (!await requireAuth(req, res)) return;
    let query = supabase.from("vehicles").select("*").order("created_at", { ascending: false });
    if (req.query.search) {
      const s = req.query.search as string;
      query = query.or(`plate.ilike.%${s}%,owner.ilike.%${s}%`);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ detail: error.message });
    res.json(data);
  });

  app.post("/vehicles", async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const { plate, owner, vehicle_type, observations } = req.body;
    if (!plate || !owner || !vehicle_type) return res.status(400).json({ detail: "Placa, propietario y tipo son requeridos" });
    const { data, error } = await supabase
      .from("vehicles")
      .insert({ plate: plate.toUpperCase(), owner, vehicle_type, observations: observations || null, registered_by: user.id })
      .select()
      .single();
    if (error) return res.status(500).json({ detail: error.message });
    res.status(201).json(data);
  });

  app.put("/vehicles/:id", async (req, res) => {
    if (!await requireAuth(req, res)) return;
    const { data, error } = await supabase
      .from("vehicles")
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) return res.status(500).json({ detail: error.message });
    res.json(data);
  });

  app.delete("/vehicles/:id", async (req, res) => {
    if (!await requireAuth(req, res)) return;
    const { error } = await supabase.from("vehicles").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ detail: error.message });
    res.status(204).send();
  });

  // ── CAMERAS ───────────────────────────────────────────────────────────────

  app.get("/cameras", async (req, res) => {
    if (!await requireAuth(req, res)) return;
    const { data, error } = await supabase.from("cameras").select("*").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ detail: error.message });
    res.json(data);
  });

  app.post("/cameras", async (req, res) => {
    if (!await requireAuth(req, res)) return;
    const { data, error } = await supabase.from("cameras").insert(req.body).select().single();
    if (error) return res.status(500).json({ detail: error.message });
    res.status(201).json(data);
  });

  app.put("/cameras/:id", async (req, res) => {
    if (!await requireAuth(req, res)) return;
    const { data, error } = await supabase.from("cameras").update(req.body).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ detail: error.message });
    res.json(data);
  });

  app.delete("/cameras/:id", async (req, res) => {
    if (!await requireAuth(req, res)) return;
    const { error } = await supabase.from("cameras").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ detail: error.message });
    res.status(204).send();
  });

  // ── SIMULATIONS ───────────────────────────────────────────────────────────

  app.get("/simulations", async (req, res) => {
    if (!await requireAuth(req, res)) return;
    const { data, error } = await supabase.from("simulations").select("*").order("simulation_timestamp", { ascending: false }).limit(50);
    if (error) return res.status(500).json({ detail: error.message });
    res.json(data);
  });

  app.post("/simulations", async (req, res) => {
    if (!await requireAuth(req, res)) return;
    const { camera_code, city, plate_text, vehicle_type } = req.body;
    if (!camera_code || !city || !plate_text || !vehicle_type)
      return res.status(400).json({ detail: "Todos los campos son requeridos" });

    const plate = plate_text.toUpperCase().trim();

    // Check if plate is in authorized vehicles
    const { data: vehicle } = await supabase.from("vehicles").select("id").eq("plate", plate).maybeSingle();
    const authorized = !!vehicle;

    const { data: sim, error } = await supabase
      .from("simulations")
      .insert({ camera_code, city, plate_text: plate, vehicle_type, authorized, simulation_timestamp: new Date().toISOString() })
      .select()
      .single();

    if (error) return res.status(500).json({ detail: error.message });
    res.status(201).json({ authorized, plate_text: plate, simulation: sim });
  });

  // ── USERS (admin only) ────────────────────────────────────────────────────

  app.get("/users", async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role !== "administrador") return res.status(403).json({ detail: "Acceso denegado" });
    const { data, error } = await supabase
      .from("users")
      .select("id, username, email, role, status, created_at")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ detail: error.message });
    res.json(data);
  });

  app.post("/users", async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role !== "administrador") return res.status(403).json({ detail: "Acceso denegado" });
    const { username, email, password, role, status } = req.body;
    if (!username || !email || !password) return res.status(400).json({ detail: "Username, email y contraseña son requeridos" });

    const password_hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from("users")
      .insert({ username, email, password_hash, role: role || "operador", status: status || "activo" })
      .select("id, username, email, role, status, created_at")
      .single();
    if (error) return res.status(500).json({ detail: error.message });
    res.status(201).json(data);
  });

  app.put("/users/:id", async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role !== "administrador") return res.status(403).json({ detail: "Acceso denegado" });

    const updates: any = {};
    if (req.body.role) updates.role = req.body.role;
    if (req.body.status) updates.status = req.body.status;
    if (req.body.password) updates.password_hash = await bcrypt.hash(req.body.password, 10);

    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", req.params.id)
      .select("id, username, email, role, status, created_at")
      .single();
    if (error) return res.status(500).json({ detail: error.message });
    res.json(data);
  });

  app.delete("/users/:id", async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role !== "administrador") return res.status(403).json({ detail: "Acceso denegado" });
    const { error } = await supabase.from("users").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ detail: error.message });
    res.status(204).send();
  });

  // ── AUDIENCIAS ────────────────────────────────────────────────────────────────
// Pega este bloque en routes.ts, justo antes de:  return httpServer;

app.get("/api/audiencias", async (req, res) => {
  if (!await requireAuth(req, res)) return;

  try {
    const { data, error } = await supabase
      .from("plates")
      .select("plate_text, camera_id, detection_timestamp, vehicle_type, authorized")
      .order("detection_timestamp", { ascending: true });

    if (error) return res.status(500).json({ detail: error.message });

    const rows = data ?? [];

    // Agrupa por plate_text
    const map = new Map<string, {
      plate_text: string;
      count: number;
      vehicle_type: string;
      authorized: boolean;
      hourCounts: number[];       // índice 0-23
      cameraCounts: Map<string, number>;
      firstSeen: string;
      lastSeen: string;
    }>();

    for (const row of rows) {
      const key = row.plate_text;
      if (!key) continue;

      const ts = row.detection_timestamp ? new Date(row.detection_timestamp) : null;
      const hour = ts ? ts.getHours() : -1;

      if (!map.has(key)) {
        map.set(key, {
          plate_text: key,
          count: 0,
          vehicle_type: row.vehicle_type || "Sin tipo",
          authorized: !!row.authorized,
          hourCounts: Array(24).fill(0),
          cameraCounts: new Map(),
          firstSeen: row.detection_timestamp ?? "",
          lastSeen: row.detection_timestamp ?? "",
        });
      }

      const entry = map.get(key)!;
      entry.count += 1;
      if (hour >= 0) entry.hourCounts[hour] += 1;
      if (row.camera_id) {
        entry.cameraCounts.set(
          row.camera_id,
          (entry.cameraCounts.get(row.camera_id) ?? 0) + 1
        );
      }
      if (row.detection_timestamp) {
        if (!entry.firstSeen || row.detection_timestamp < entry.firstSeen)
          entry.firstSeen = row.detection_timestamp;
        if (!entry.lastSeen || row.detection_timestamp > entry.lastSeen)
          entry.lastSeen = row.detection_timestamp;
      }
    }

    // Convierte a array y clasifica
    const result = Array.from(map.values()).map(entry => {
      const peakHour = entry.hourCounts.indexOf(Math.max(...entry.hourCounts));
      const peakHourLabel = `${String(peakHour).padStart(2, "0")}:00`;

      let topCamera = "";
      let topCameraCount = 0;
      entry.cameraCounts.forEach((cnt, cam) => {
        if (cnt > topCameraCount) { topCamera = cam; topCameraCount = cnt; }
      });

      let badge: "Residente" | "Visitante" | "Tránsito";
      if (entry.count >= 5) badge = "Residente";
      else if (entry.count >= 2) badge = "Visitante";
      else badge = "Tránsito";

      return {
        plate_text: entry.plate_text,
        count: entry.count,
        badge,
        vehicle_type: entry.vehicle_type,
        authorized: entry.authorized,
        peak_hour: peakHourLabel,
        top_camera_id: topCamera,
        first_seen: entry.firstSeen,
        last_seen: entry.lastSeen,
      };
    });

    // Resumen general
    const residentes = result.filter(r => r.badge === "Residente").length;
    const visitantes = result.filter(r => r.badge === "Visitante").length;
    const transito = result.filter(r => r.badge === "Tránsito").length;
    const recurrenceRate = result.length > 0
      ? Number(((residentes + visitantes) / result.length * 100).toFixed(1))
      : 0;

    res.json({
      total_placas: result.length,
      residentes,
      visitantes,
      transito,
      recurrence_rate: recurrenceRate,
      placas: result.sort((a, b) => b.count - a.count),
    });

  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

  return httpServer;
}
