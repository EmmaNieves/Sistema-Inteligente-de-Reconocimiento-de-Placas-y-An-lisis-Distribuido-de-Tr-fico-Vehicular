import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";


const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;

if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set");
}

const role = parseJwtRole(key);

if (role !== "service_role") {
  throw new Error(
    "SUPABASE_SERVICE_KEY must be the Supabase service_role key. The current key cannot read protected users for login.",
  );
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
  realtime: { transport: ws } as any,
});

function parseJwtRole(token: string): string | null {
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(decoded).role ?? null;
  } catch {
    return null;
  }
}
