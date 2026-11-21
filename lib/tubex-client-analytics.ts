import type { Session } from "@supabase/supabase-js";

async function getSessionId(session: Session) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(session.access_token));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export async function recordWebProductEvent(session: Session | null, eventName: string, module: string) {
  if (!session?.access_token || !session.user.id || typeof window === "undefined") return;
  try {
    const sessionId = await getSessionId(session);
    await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        install_id: `web-${session.user.id}`,
        session_id: sessionId,
        event_name: eventName,
        module,
        queued_at: Date.now(),
        properties: { source: "web_dashboard" },
      }),
      keepalive: true,
    });
  } catch {
    // Analytics should not block a successful sign-in.
  }
}

export function recordWebLogin(session: Session | null) {
  return recordWebProductEvent(session, "login_success", "web_dashboard");
}

export async function recordInitialDashboardOpen(session: Session | null) {
  if (!session?.user.id || typeof window === "undefined") return;
  const key = `tubex-dashboard-open-recorded:${session.user.id}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  await recordWebProductEvent(session, "module_opened", "dashboard");
}
