import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store"
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  return NextResponse.json(
    { success: true, service: "tubex-analytics-ingestion", methods: ["POST", "OPTIONS"] },
    { headers: corsHeaders }
  );
}

const ALLOWED = new Set([
  "extension_installed","extension_updated","extension_started","welcome_opened","welcome_completed",
  "youtube_opened","login_started","login_success","login_failed","module_opened",
  "search_submitted","search_performed","analysis_completed","ai_generation_completed","competitor_analysis",
  "pricing_viewed","upgrade_clicked","checkout_started","subscription_activated",
  "subscription_cancelled","subscription_expired","quota_warning","quota_exhausted",
  "upgrade_prompt_viewed","upgrade_prompt_clicked","ui_action","api_error","api_request_succeeded",
  "search_failed","analysis_failed","extension_uninstalled","module_closed","welcome_skipped",
  "session_started","extension_action","trend_search_completed","trend_search_failed","summary_viewed",
  "creator_workspace_opened","competitor_analysis_started","competitor_analysis_failed",
  // TubeX AI Chat (site e extensão): sem estes nomes os eventos do Chat eram descartados.
  "chat_opened","chat_message_sent","chat_response_received","ai_chat_opened","ai_chat_message_sent",
  "ai_message_sent","ai_response_received","thumbnail_generated"
]);

function cleanText(v: unknown, max=80) {
  return typeof v === "string" ? v.replace(/[^\w .:/-]/g, "").slice(0,max) : null;
}

type VerifiedGoogleProfile = {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
};

async function resolveIdentity(request: Request): Promise<{ userId: string | null; google: VerifiedGoogleProfile | null }> {
  const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return { userId: null, google: null };

  // First accept a Supabase access token (web app session).
  const { data: authData } = await supabaseAdmin.auth.getUser(bearer);
  if (authData.user?.id) {
    return { userId: authData.user.id, google: null };
  }

  // The extension uses Chrome Identity. Verify the bearer directly with Google;
  // never trust an email or Google subject supplied in the JSON body.
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${bearer}` }, cache: "no-store"
    });
    if (!r.ok) return { userId: null, google: null };
    const profile = await r.json();
    if (!profile?.sub || !profile?.email || profile.email_verified !== true) {
      return { userId: null, google: null };
    }
    const email = String(profile.email).trim().toLowerCase();
    const { data: profileRow } = await supabaseAdmin
      .from("users").select("id").ilike("email", email).maybeSingle();
    return {
      userId: profileRow?.id || null,
      google: {
        sub: String(profile.sub),
        email,
        name: typeof profile.name === "string" ? profile.name.slice(0, 120) : null,
        picture: typeof profile.picture === "string" ? profile.picture.slice(0, 500) : null,
      }
    };
  } catch {
    return { userId: null, google: null };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const events = Array.isArray(body?.events) ? body.events.slice(0,50) : [body];
    const identity = await resolveIdentity(request);
    const userId = identity.userId;
    const rows = events.flatMap((e:any) => {
      const eventName = cleanText(e?.event_name,80);
      const installId = cleanText(e?.install_id,64);
      if (!eventName || !ALLOWED.has(eventName) || !installId) return [];
      // A extensão mantém queued_at desde a ocorrência do evento; preservar
      // esse instante evita jogar lotes offline inteiros no dia da sincronização.
      const now = Date.now();
      const queuedAt = Number(e?.queued_at);
      const eventTime = Number.isSafeInteger(queuedAt) && queuedAt >= now - 400 * 86400000 && queuedAt <= now + 5 * 60000
        ? new Date(queuedAt).toISOString()
        : new Date(now).toISOString();
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
        properties: safeProps,
        created_at: eventTime
      }];
    });
    if (!rows.length) return NextResponse.json({ success:true, accepted:0 }, { headers: corsHeaders });

    // Persist only Google identities verified server-side. Email is stored once per
    // extension installation, not duplicated into every telemetry event.
    if (identity.google) {
      const installIds = [...new Set(rows.map((row: any) => row.install_id).filter(Boolean))];
      if (installIds.length) {
        const versions = [...new Set(rows.map((row: any) => (row.properties as any)?.version).filter(Boolean))];
        const { error: installationError } = await supabaseAdmin
          .from("tubex_installations")
          .upsert(installIds.map((installId) => ({
            install_id: installId,
            google_sub: identity.google!.sub,
            email: identity.google!.email,
            name: identity.google!.name,
            picture: identity.google!.picture,
            user_id: userId,
            extension_version: versions[0] || null,
            last_seen: new Date().toISOString(),
          })), { onConflict: "install_id" });
        if (installationError) {
          console.error("[TubeX analytics identity]", installationError.message);
          return NextResponse.json({ error:"identity_storage_unavailable" }, { status:503, headers:corsHeaders });
        }
      }
    }

    // Em upserts em lote, o PostgREST pode preencher colunas ausentes com NULL.
    // defaultToNull:false preserva o DEFAULT gen_random_uuid() do banco quando
    // eventos antigos da fila não possuem event_id.
    const { error } = await supabaseAdmin
      .from("tubex_events")
      .upsert(rows, {
        onConflict: "id",
        ignoreDuplicates: true,
        defaultToNull: false
      });
    if (error) {
      console.error("[TubeX analytics ingestion]",error.message);
      return NextResponse.json({ error:"analytics_unavailable" },{status:503, headers:corsHeaders});
    }
    return NextResponse.json({ success:true, accepted:rows.length }, { headers: corsHeaders });
  } catch {
    return NextResponse.json({ error:"invalid_event_payload" },{status:400, headers:corsHeaders});
  }
}
