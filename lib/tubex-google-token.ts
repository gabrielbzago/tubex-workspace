import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Servidor: guarda o refresh token do Google (criptografado) e gera access tokens novos.
 *
 * Por quê: o Supabase só entrega o provider_token (Google) no login e NÃO o renova. Depois de
 * ~1 hora ele vence e toda chamada ao YouTube/Analytics devolve 401 até a pessoa reconectar.
 * Com o refresh token salvo aqui, o site renova sozinho.
 *
 * Requer: tabela public.tubex_google_tokens (migration 20261127_tubex_google_tokens.sql) e as
 * variáveis GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (o MESMO cliente OAuth configurado no
 * provedor Google do Supabase).
 */

const TABLE = "tubex_google_tokens";

function key() {
  const secret = process.env.GOOGLE_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createHash("sha256").update(`tubex-google-token:${secret}`).digest();
}
function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${enc.toString("base64")}`;
}
function decrypt(stored: string) {
  const [v, iv, tag, data] = String(stored).split(".");
  if (v !== "v1" || !iv || !tag || !data) return "";
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
  } catch { return ""; }
}

export function googleRefreshConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export async function saveGoogleRefreshToken(userId: string, refreshToken: string, scopes = "") {
  if (!userId || !refreshToken) return { ok: false, error: "missing" };
  const { error } = await supabaseAdmin.from(TABLE).upsert({
    user_id: userId, refresh_token: encrypt(refreshToken), scopes: scopes.slice(0, 2000), updated_at: new Date().toISOString(), last_error: null,
  }, { onConflict: "user_id" });
  if (error) { console.warn("[TubeX Google token] save", error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

export type RefreshResult =
  | { ok: true; accessToken: string; expiresIn: number; scope: string }
  | { ok: false; reason: "not_configured" | "no_refresh_token" | "revoked" | "error"; message: string };

const memory = new Map<string, { token: string; exp: number; scope: string }>();

/** Access token válido para a pessoa (renova com o refresh token salvo). */
export async function refreshGoogleAccessToken(userId: string): Promise<RefreshResult> {
  const hit = memory.get(userId);
  if (hit && hit.exp - Date.now() > 120_000) return { ok: true, accessToken: hit.token, expiresIn: Math.floor((hit.exp - Date.now()) / 1000), scope: hit.scope };
  if (!googleRefreshConfigured()) return { ok: false, reason: "not_configured", message: "GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados no servidor." };
  const { data, error } = await supabaseAdmin.from(TABLE).select("refresh_token").eq("user_id", userId).maybeSingle();
  if (error) return { ok: false, reason: "error", message: error.message };
  const refreshToken = data?.refresh_token ? decrypt(String(data.refresh_token)) : "";
  if (!refreshToken) return { ok: false, reason: "no_refresh_token", message: "Nenhuma conexão do Google salva. Reconecte o canal." };
  const body = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: refreshToken, grant_type: "refresh_token" });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) {
    const revoked = d?.error === "invalid_grant";
    await supabaseAdmin.from(TABLE).update({ last_error: String(d?.error || r.status), updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (revoked) await supabaseAdmin.from(TABLE).delete().eq("user_id", userId);
    return { ok: false, reason: revoked ? "revoked" : "error", message: String(d?.error_description || d?.error || `Google ${r.status}`) };
  }
  const expiresIn = Number(d.expires_in || 3600);
  memory.set(userId, { token: d.access_token, exp: Date.now() + expiresIn * 1000, scope: String(d.scope || "") });
  if (d.scope) await supabaseAdmin.from(TABLE).update({ scopes: String(d.scope).slice(0, 2000), last_refreshed_at: new Date().toISOString(), last_error: null }).eq("user_id", userId);
  return { ok: true, accessToken: d.access_token, expiresIn, scope: String(d.scope || "") };
}

/**
 * Para rotas de servidor (ex.: chat da IA): usa o token enviado pelo navegador no header
 * X-Google-Token quando existir; senão renova pelo refresh token salvo.
 */
export async function resolveGoogleToken(request: Request, userId: string) {
  const header = String(request.headers.get("x-google-token") || "").trim();
  if (header) return header;
  const r = await refreshGoogleAccessToken(userId);
  return r.ok ? r.accessToken : "";
}
