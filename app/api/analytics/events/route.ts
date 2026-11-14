import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "extension_installed","extension_updated","extension_started","welcome_opened","welcome_completed",
  "youtube_opened","login_started","login_success","login_failed","module_opened",
  "search_submitted","search_performed","analysis_completed","ai_generation_completed","competitor_analysis",
  "pricing_viewed","upgrade_clicked","checkout_started","subscription_activated",
  "subscription_cancelled","subscription_expired","quota_warning","quota_exhausted",
  "upgrade_prompt_viewed","upgrade_prompt_clicked","ui_action","api_error","api_request_succeeded",
  "search_failed","analysis_failed","extension_uninstalled","module_closed","welcome_skipped",
  "session_started","trend_search_completed","trend_search_failed","summary_viewed",
  "creator_workspace_opened","competitor_analysis_started","competitor_analysis_failed"
]);

function cleanText(v: unknown, max=80) {
  return typeof v === "string" ? v.replace(/[^\w .:/-]/g, "").slice(0,max) : null;
}

async function resolveUser(request: Request) {
  const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i,"").trim();
  if (!bearer) return null;
  // First accept a Supabase access token.
  const { data } = await supabaseAdmin.auth.getUser(bearer);
  if (data.user?.id) return data.user.id;
  // The Chrome extension authenticates with Google OAuth. Verify the token with Google,
  // then map its verified email to the existing Supabase Auth user.
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${bearer}` }, cache: "no-store"
    });
    if (!r.ok) return null;
    const profile = await r.json();
    if (!profile?.email || profile.email_verified !== true) return null;
    const { data: profileRow } = await supabaseAdmin.from("users").select("id").ilike("email",String(profile.email)).maybeSingle();
    return profileRow?.id || null;
  } catch { return null; }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const events = Array.isArray(body?.events) ? body.events.slice(0,50) : [body];
    const userId = await resolveUser(request);
    const rows = events.flatMap((e:any) => {
      const eventName = cleanText(e?.event_name,80);
      const installId = cleanText(e?.install_id,64);
      if (!eventName || !ALLOWED.has(eventName) || !installId) return [];
      const props = e?.properties && typeof e.properties === "object" ? e.properties : {};
      // Keep only low-risk, bounded metadata. Never accept raw query text, tokens or content.
      const safeProps = {
        version: cleanText(props.version,20),
        source: cleanText(props.source,40),
        action: cleanText(props.action,60),
        result_count: Number.isFinite(Number(props.result_count)) ? Math.max(0,Math.min(10000,Number(props.result_count))) : undefined,
        duration_ms: Number.isFinite(Number(props.duration_ms)) ? Math.max(0,Math.min(3600000,Number(props.duration_ms))) : undefined,
        error_code: cleanText(props.error_code,60),
        endpoint: cleanText(props.endpoint,100),
        method: cleanText(props.method,8),
        http_status: Number.isFinite(Number(props.http_status)) ? Math.max(0,Math.min(599,Number(props.http_status))) : undefined,
        plan: cleanText(props.plan,20),
        feature: cleanText(props.feature,50),
        reason: cleanText(props.reason,60)
      };
      return [{
        ...(typeof e?.event_id === "string" && /^[0-9a-f-]{36}$/i.test(e.event_id) ? { id: e.event_id } : {}),
        user_id: userId,
        install_id: installId,
        session_id: cleanText(e?.session_id,64),
        event_name: eventName,
        module: cleanText(e?.module,60),
        properties: safeProps
      }];
    });
    if (!rows.length) return NextResponse.json({ success:true, accepted:0 });
    const { error } = await supabaseAdmin.from("tubex_events").upsert(rows,{onConflict:"id",ignoreDuplicates:true});
    if (error) {
      console.error("[TubeX analytics ingestion]",error.message);
      return NextResponse.json({ error:"analytics_unavailable" },{status:503});
    }
    return NextResponse.json({ success:true, accepted:rows.length });
  } catch {
    return NextResponse.json({ error:"invalid_event_payload" },{status:400});
  }
}
