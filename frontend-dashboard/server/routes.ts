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

  return httpServer;
}
