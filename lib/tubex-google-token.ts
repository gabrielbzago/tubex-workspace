import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Servidor: tokens do Google por CANAL do YouTube.
 *
 * Um e-mail Google pode ter vários canais (canal pessoal + contas de marca). Cada consentimento
 * OAuth gera um token que só enxerga o canal escolhido na tela do Google. Por isso guardamos um
 * refresh token por (usuário TubeX, canal) em public.tubex_google_channels e marcamos um canal ativo.
 * O usuário TubeX (e o acesso de owner) não muda quando a pessoa troca de canal.
 *
 * Tabelas: tubex_google_channels (20261127_tubex_google_channels.sql) e a antiga
 * tubex_google_tokens (1 token por usuário; migrada automaticamente para a nova).
 * Variáveis: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (o MESMO cliente OAuth do provedor Google do Supabase).
 */

const LEGACY = "tubex_google_tokens";
const CHANNELS = "tubex_google_channels";
const YT = "https://www.googleapis.com/youtube/v3";

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

/* ---------------- Canais ---------------- */

export type GoogleChannel = {
  id: string; title: string; thumbnail: string; customUrl: string; googleEmail: string;
  active: boolean; hasRefresh: boolean; lastError: string | null; updatedAt: string;
};

type MineChannel = { id: string; title: string; thumbnail: string; customUrl: string };

/** Canais que o access token enxerga (channels.list mine=true). Só o canal escolhido no consentimento. */
export async function fetchMineChannels(accessToken: string): Promise<MineChannel[]> {
  const r = await fetch(`${YT}/channels?part=snippet&mine=true&maxResults=50`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `YouTube ${r.status}`);
  return (d.items || []).map((c: any) => ({
    id: String(c.id), title: String(c.snippet?.title || "Canal"),
    thumbnail: String(c.snippet?.thumbnails?.medium?.url || c.snippet?.thumbnails?.default?.url || ""),
    customUrl: String(c.snippet?.customUrl || ""),
  }));
}

async function tokenInfo(accessToken: string) {
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    return { email: String(d?.email || "").toLowerCase(), scope: String(d?.scope || "") };
  } catch { return { email: "", scope: "" }; }
}

const memory = new Map<string, { token: string; exp: number; scope: string }>();
function forget(userId: string) { for (const k of [...memory.keys()]) if (k.startsWith(`${userId}:`)) memory.delete(k); }

/**
 * Registra os canais que o access token enxerga e torna o primeiro o canal ativo.
 * refreshToken opcional: sem ele, mantém o refresh token que já existia para o canal.
 */
export async function registerGoogleChannels(userId: string, accessToken: string, refreshToken = "", scopesHint = "") {
  const channels = await fetchMineChannels(accessToken);
  if (!channels.length) return { channels: [] as MineChannel[], activeId: "" };
  const info = await tokenInfo(accessToken);
  const now = new Date().toISOString();
  const rows = channels.map((c) => ({
    user_id: userId, channel_id: c.id, title: c.title.slice(0, 200), thumbnail: c.thumbnail.slice(0, 1000), custom_url: c.customUrl.slice(0, 200),
    google_email: info.email || null, scopes: (info.scope || scopesHint).slice(0, 2000), updated_at: now, last_error: null,
    ...(refreshToken ? { refresh_token: encrypt(refreshToken) } : {}),
  }));
  const { error } = await supabaseAdmin.from(CHANNELS).upsert(rows, { onConflict: "user_id,channel_id" });
  if (error) throw new Error(error.message);
  const activeId = channels[0].id;
  await setActiveGoogleChannel(userId, activeId);
  forget(userId);
  memory.set(`${userId}:${activeId}`, { token: accessToken, exp: Date.now() + 50 * 60_000, scope: info.scope });
  return { channels, activeId };
}

export async function listGoogleChannels(userId: string): Promise<GoogleChannel[]> {
  const { data, error } = await supabaseAdmin.from(CHANNELS)
    .select("channel_id,title,thumbnail,custom_url,google_email,is_active,refresh_token,last_error,updated_at")
    .eq("user_id", userId).order("created_at", { ascending: true }).limit(50);
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    id: String(r.channel_id), title: String(r.title || "Canal"), thumbnail: String(r.thumbnail || ""), customUrl: String(r.custom_url || ""),
    googleEmail: String(r.google_email || ""), active: r.is_active === true, hasRefresh: Boolean(r.refresh_token),
    lastError: r.last_error || null, updatedAt: String(r.updated_at || ""),
  }));
}

export async function setActiveGoogleChannel(userId: string, channelId: string) {
  const { data } = await supabaseAdmin.from(CHANNELS).select("channel_id").eq("user_id", userId).eq("channel_id", channelId).maybeSingle();
  if (!data) return false;
  await supabaseAdmin.from(CHANNELS).update({ is_active: false }).eq("user_id", userId).neq("channel_id", channelId);
  await supabaseAdmin.from(CHANNELS).update({ is_active: true }).eq("user_id", userId).eq("channel_id", channelId);
  return true;
}

export async function removeGoogleChannel(userId: string, channelId: string) {
  const { data: row } = await supabaseAdmin.from(CHANNELS).select("is_active").eq("user_id", userId).eq("channel_id", channelId).maybeSingle();
  await supabaseAdmin.from(CHANNELS).delete().eq("user_id", userId).eq("channel_id", channelId);
  memory.delete(`${userId}:${channelId}`);
  if (row?.is_active) {
    const { data: next } = await supabaseAdmin.from(CHANNELS).select("channel_id").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (next?.channel_id) await setActiveGoogleChannel(userId, String(next.channel_id));
  }
  return true;
}

async function activeChannelId(userId: string) {
  const { data } = await supabaseAdmin.from(CHANNELS).select("channel_id,is_active").eq("user_id", userId).order("updated_at", { ascending: false }).limit(50);
  const rows = data || [];
  return String((rows.find((r: any) => r.is_active) || rows[0])?.channel_id || "");
}

/* ---------------- Refresh ---------------- */

async function exchangeRefresh(refreshToken: string) {
  const body = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: refreshToken, grant_type: "refresh_token" });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok && Boolean(d.access_token), status: r.status, data: d as any };
}

/** Compatível com o fluxo antigo (1 token por usuário). Também registra o canal do token. */
export async function saveGoogleRefreshToken(userId: string, refreshToken: string, scopes = "") {
  if (!userId || !refreshToken) return { ok: false, error: "missing" };
  const { error } = await supabaseAdmin.from(LEGACY).upsert({
    user_id: userId, refresh_token: encrypt(refreshToken), scopes: scopes.slice(0, 2000), updated_at: new Date().toISOString(), last_error: null,
  }, { onConflict: "user_id" });
  if (error) { console.warn("[TubeX Google token] save", error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

/**
 * Chamado logo após um login/consentimento Google do Supabase: descobre QUAL canal foi escolhido
 * (com o access token desse consentimento), guarda o refresh token para ele e o torna ativo.
 */
export async function saveGoogleConsent(userId: string, opts: { accessToken?: string; refreshToken?: string; scopes?: string }) {
  let accessToken = String(opts.accessToken || "");
  const refreshToken = String(opts.refreshToken || "");
  let refreshStored = false;
  let error = "";
  if (refreshToken) {
    const legacy = await saveGoogleRefreshToken(userId, refreshToken, opts.scopes || "");
    refreshStored = legacy.ok;
    if (!legacy.ok) error = String(legacy.error || "");
  }
  if (!accessToken && refreshToken && googleRefreshConfigured()) {
    const r = await exchangeRefresh(refreshToken);
    if (r.ok) accessToken = r.data.access_token;
  }
  if (!accessToken) return { saved: refreshStored, refreshStored, channelId: "", error };
  try {
    const reg = await registerGoogleChannels(userId, accessToken, refreshToken, opts.scopes || "");
    if (refreshToken && reg.activeId) refreshStored = true;
    return { saved: true, refreshStored, channelId: reg.activeId, error };
  } catch (e: any) {
    console.warn("[TubeX Google channels] register", e?.message);
    return { saved: refreshStored, refreshStored, channelId: "", error: error || String(e?.message || "") };
  }
}

export type RefreshResult =
  | { ok: true; accessToken: string; expiresIn: number; scope: string; channelId: string }
  | { ok: false; reason: "not_configured" | "no_refresh_token" | "revoked" | "client_mismatch" | "error"; message: string; channelId?: string };

/** invalid_client/unauthorized_client: o refresh token foi emitido para OUTRO cliente OAuth. */
const failReason = (d: any): "revoked" | "client_mismatch" | "error" =>
  d?.error === "invalid_grant" ? "revoked" : d?.error === "invalid_client" || d?.error === "unauthorized_client" ? "client_mismatch" : "error";

/** Access token válido para o canal pedido (ou o canal ativo). */
export async function refreshGoogleAccessToken(userId: string, channelId = ""): Promise<RefreshResult> {
  const cid = channelId || await activeChannelId(userId).catch(() => "");
  if (cid) {
    const hit = memory.get(`${userId}:${cid}`);
    if (hit && hit.exp - Date.now() > 120_000) return { ok: true, accessToken: hit.token, expiresIn: Math.floor((hit.exp - Date.now()) / 1000), scope: hit.scope, channelId: cid };
    if (!googleRefreshConfigured()) return { ok: false, reason: "not_configured", message: "GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados no servidor.", channelId: cid };
    const { data, error } = await supabaseAdmin.from(CHANNELS).select("refresh_token").eq("user_id", userId).eq("channel_id", cid).maybeSingle();
    if (error) return { ok: false, reason: "error", message: error.message, channelId: cid };
    if (!data && channelId) return { ok: false, reason: "no_refresh_token", message: "Este canal não está conectado à sua conta TubeX.", channelId: cid };
    const refreshToken = data?.refresh_token ? decrypt(String(data.refresh_token)) : "";
    if (refreshToken) {
      const r = await exchangeRefresh(refreshToken);
      if (!r.ok) {
        const revoked = r.data?.error === "invalid_grant";
        await supabaseAdmin.from(CHANNELS).update({ last_error: String(r.data?.error || r.status), ...(revoked ? { refresh_token: null } : {}) }).eq("user_id", userId).eq("channel_id", cid);
        return { ok: false, reason: failReason(r.data), message: String(r.data?.error_description || r.data?.error || `Google ${r.status}`), channelId: cid };
      }
      const expiresIn = Number(r.data.expires_in || 3600);
      const scope = String(r.data.scope || "");
      memory.set(`${userId}:${cid}`, { token: r.data.access_token, exp: Date.now() + expiresIn * 1000, scope });
      await supabaseAdmin.from(CHANNELS).update({ ...(scope ? { scopes: scope.slice(0, 2000) } : {}), last_refreshed_at: new Date().toISOString(), last_error: null }).eq("user_id", userId).eq("channel_id", cid);
      return { ok: true, accessToken: r.data.access_token, expiresIn, scope, channelId: cid };
    }
    if (data) return { ok: false, reason: "no_refresh_token", message: "Reconecte este canal para renovar o acesso.", channelId: cid };
  }
  return refreshLegacy(userId);
}

/** Token antigo (1 por usuário). Ao funcionar, migra para a tabela de canais. */
async function refreshLegacy(userId: string): Promise<RefreshResult> {
  if (!googleRefreshConfigured()) return { ok: false, reason: "not_configured", message: "GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados no servidor." };
  const { data, error } = await supabaseAdmin.from(LEGACY).select("refresh_token").eq("user_id", userId).maybeSingle();
  if (error) return { ok: false, reason: "error", message: error.message };
  const refreshToken = data?.refresh_token ? decrypt(String(data.refresh_token)) : "";
  if (!refreshToken) return { ok: false, reason: "no_refresh_token", message: "Nenhuma conexão do Google salva. Reconecte o canal." };
  const r = await exchangeRefresh(refreshToken);
  if (!r.ok) {
    const revoked = r.data?.error === "invalid_grant";
    await supabaseAdmin.from(LEGACY).update({ last_error: String(r.data?.error || r.status), updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (revoked) await supabaseAdmin.from(LEGACY).delete().eq("user_id", userId);
    return { ok: false, reason: failReason(r.data), message: String(r.data?.error_description || r.data?.error || `Google ${r.status}`) };
  }
  const expiresIn = Number(r.data.expires_in || 3600);
  let channelId = "";
  try { channelId = (await registerGoogleChannels(userId, r.data.access_token, refreshToken, String(r.data.scope || ""))).activeId; } catch {}
  return { ok: true, accessToken: r.data.access_token, expiresIn, scope: String(r.data.scope || ""), channelId };
}

/**
 * Para rotas de servidor (ex.: chat da IA): usa o token enviado pelo navegador no header
 * X-Google-Token quando existir; senão renova o canal do header X-TubeX-Channel (ou o ativo).
 */
export async function resolveGoogleToken(request: Request, userId: string) {
  const header = String(request.headers.get("x-google-token") || "").trim();
  if (header) return header;
  const channel = String(request.headers.get("x-tubex-channel") || "").trim().slice(0, 80);
  const r = await refreshGoogleAccessToken(userId, /^UC[\w-]{10,}$/.test(channel) ? channel : "");
  return r.ok ? r.accessToken : "";
}
