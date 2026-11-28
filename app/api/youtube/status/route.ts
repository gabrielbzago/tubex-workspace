import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tubex-backend";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { googleRefreshConfigured, refreshGoogleAccessToken } from "@/lib/tubex-google-token";
import { redirectUri } from "@/lib/tubex-google-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnóstico da conexão com o Google (sem expor tokens). Mostra exatamente o que falta:
 * variáveis, tabelas (migrations), refresh token salvo e o erro do Google ao renovar.
 */
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const out: Record<string, any> = {
    env: { GOOGLE_CLIENT_ID: Boolean(process.env.GOOGLE_CLIENT_ID), GOOGLE_CLIENT_SECRET: Boolean(process.env.GOOGLE_CLIENT_SECRET), SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
    clientIdSuffix: String(process.env.GOOGLE_CLIENT_ID || "").replace(/\.apps\.googleusercontent\.com$/, "").slice(-6),
    redirectUri: redirectUri(request),
  };
  const ch = await supabaseAdmin.from("tubex_google_channels").select("channel_id,title,is_active,refresh_token,last_error,updated_at").eq("user_id", user.id);
  out.channelsTable = ch.error ? `erro: ${ch.error.message}` : "ok";
  out.channels = (ch.data || []).map((r: any) => ({ title: r.title, active: r.is_active, hasRefresh: Boolean(r.refresh_token), lastError: r.last_error, updatedAt: r.updated_at }));
  const lg = await supabaseAdmin.from("tubex_google_tokens").select("refresh_token,last_error,updated_at").eq("user_id", user.id).maybeSingle();
  out.legacyTable = lg.error ? `erro: ${lg.error.message}` : "ok";
  out.legacyToken = lg.data ? { hasRefresh: Boolean(lg.data.refresh_token), lastError: lg.data.last_error, updatedAt: lg.data.updated_at } : null;
  if (googleRefreshConfigured()) {
    const r = await refreshGoogleAccessToken(user.id);
    out.refresh = r.ok ? { ok: true, channelId: r.channelId, scope: r.scope } : { ok: false, reason: r.reason, message: r.message };
  } else out.refresh = { ok: false, reason: "not_configured" };
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
