import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function recordServerProductEvent(request: Request, userId: string, eventName: string, module: string, extra: Record<string, string | number | null> = {}) {
  if (!userId) return;
  const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const sessionId = bearer ? createHash("sha256").update(bearer).digest("hex").slice(0, 32) : null;
  try {
    const { error } = await supabaseAdmin.from("tubex_events").insert({
      user_id: userId,
      install_id: `web-${userId}`,
      session_id: sessionId,
      event_name: eventName,
      module,
      properties: { source: "web_dashboard", ...extra },
    });
    if (error) console.warn("[TubeX product analytics] event not recorded", eventName, error.message);
  } catch (error: any) {
    console.warn("[TubeX product analytics] event not recorded", eventName, error?.message || error);
  }
}
