"use client";
import { supabase } from "@/lib/supabase";
import { getSiteBearer } from "@/lib/tubex-session";
import { checkGoogleScopes, type GoogleScopes } from "@/lib/tubex-yt-analytics";

/**
 * Navegador: access token do Google sempre válido, do CANAL ATIVO.
 *
 * Uma conta Google pode ter vários canais (pessoal + contas de marca) e cada consentimento só
 * enxerga o canal escolhido. O servidor guarda um refresh token por canal; aqui guardamos qual é o
 * canal ativo e pedimos o token dele. Trocar de canal NÃO troca o login TubeX (nem o acesso de owner).
 *
 * Ordem: 1) cache do canal ativo; 2) servidor (/api/youtube/token) com o refresh token do canal;
 * 3) provider_token da sessão Supabase (só logo após o login, vence em ~1h).
 */

type Cached = { token: string; exp: number; chan: string; scopes?: GoogleScopes };
const KEY = "tubex-google-at-v2";
const ACTIVE_KEY = "tubex-active-channel";
const SEEN_KEY = "tubex-google-pt-seen";
export const CHANNEL_EVENT = "tubex-channel-changed";

let mem: Cached | null = null;
let inflight: Promise<string> | null = null;
let remembering: Promise<void> | null = null;
let lastServerReason = "";

/**
 * true só quando o acesso ao Google acabou de verdade: o servidor não tem refresh token
 * (ou o Google o revogou) e não há token de login válido. Aí a tela pede o login do site.
 * Falhas temporárias (rede, Google fora, variáveis ausentes) NÃO contam.
 */
export function googleAccessLost() {
  return lastServerReason === "revoked" || lastServerReason === "no_refresh_token";
}

/* ---------- Canal ativo ---------- */

export function getActiveChannelId(): string {
  try { return localStorage.getItem(ACTIVE_KEY) || ""; } catch { return ""; }
}

/** Define o canal ativo no navegador. emit=true avisa a tela para recarregar os dados. */
export function setActiveChannelId(id: string, emit = true) {
  const prev = getActiveChannelId();
  if (prev === id) return;
  try { if (id) localStorage.setItem(ACTIVE_KEY, id); else localStorage.removeItem(ACTIVE_KEY); } catch {}
  if (mem && mem.chan !== id) writeCache(null);
  if (emit && prev) {
    // O contexto do canal anterior (usado pelo chat da IA) não vale mais.
    try { localStorage.removeItem("tubex-ai-channel-context"); localStorage.setItem("tubex-feed-channel", id); } catch {}
    try { window.dispatchEvent(new CustomEvent(CHANNEL_EVENT, { detail: id })); window.dispatchEvent(new Event("tubex-channel-context")); } catch {}
  }
}

/* ---------- Cache ---------- */

function readCache(): Cached | null {
  const chan = getActiveChannelId();
  if (mem && mem.chan === chan && mem.exp - Date.now() > 90_000) return mem;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) { const c = JSON.parse(raw) as Cached; if (c.token && c.chan === chan && c.exp - Date.now() > 90_000) return (mem = c); }
  } catch {}
  return null;
}
function writeCache(c: Cached | null) {
  mem = c;
  try { sessionStorage.removeItem("tubex-google-at-v1"); if (c) sessionStorage.setItem(KEY, JSON.stringify(c)); else sessionStorage.removeItem(KEY); } catch {}
}

async function bearer() {
  const token = await getSiteBearer().catch(() => "");
  const { data } = await supabase.auth.getSession();
  return { token: token || data.session?.access_token || "", session: data.session as any };
}

async function refreshFromServer(channelId: string): Promise<string> {
  const { token } = await bearer();
  if (!token) return "";
  const r = await fetch("/api/youtube/token", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh", channelId }) }).catch(() => null);
  if (r && !r.ok && !(channelId && r.status === 409)) {
    const e = await r.clone().json().catch(() => ({}));
    lastServerReason = String(e?.reason || r.status);
  }
  if ((!r || !r.ok) && channelId && r?.status === 409) {
    // Canal salvo neste navegador não pertence a esta conta (ex.: outra pessoa logou): usa o ativo do servidor.
    setActiveChannelId("", false);
    return refreshFromServer("");
  }
  if (!r || !r.ok) return "";
  const d = await r.json().catch(() => ({}));
  if (!d.accessToken) return "";
  lastServerReason = "";
  const chan = String(d.channelId || channelId || "");
  // Primeira vez neste navegador: adota o canal ativo do servidor sem recarregar a tela.
  if (chan && !getActiveChannelId()) setActiveChannelId(chan, false);
  writeCache({ token: d.accessToken, exp: Date.now() + Number(d.expiresIn || 3600) * 1000, chan: getActiveChannelId() });
  return d.accessToken;
}

async function resolve(force: boolean): Promise<string> {
  if (remembering) await remembering.catch(() => {});
  if (!force) { const c = readCache(); if (c) return c.token; }
  const fresh = await refreshFromServer(getActiveChannelId());
  if (fresh) return fresh;
  // Sem refresh no servidor (variáveis não configuradas / migration pendente): usa o token do login.
  const { session } = await bearer();
  const provider = String(session?.provider_token || "");
  if (provider) {
    const scopes = await checkGoogleScopes(provider);
    if (scopes.valid && scopes.expiresIn > 90) {
      writeCache({ token: provider, exp: Date.now() + scopes.expiresIn * 1000, chan: getActiveChannelId(), scopes });
      return provider;
    }
  }
  writeCache(null);
  return provider;
}

/** Access token do Google do canal ativo. force=true ignora o cache (use após um 401). */
export async function getGoogleAccessToken(force = false): Promise<string> {
  if (!inflight) inflight = resolve(force).finally(() => { inflight = null; });
  return inflight;
}

/** Permissões do token atual (com cache). */
export async function getGoogleScopes(force = false): Promise<GoogleScopes> {
  const token = await getGoogleAccessToken(force);
  if (mem?.token === token && mem.scopes) return mem.scopes;
  const scopes = await checkGoogleScopes(token);
  if (mem?.token === token) writeCache({ ...mem, scopes });
  return scopes;
}

/** Headers para rotas do servidor que usam o YouTube do canal ativo. */
export function activeChannelHeaders(): Record<string, string> {
  const id = getActiveChannelId();
  return id ? { "X-TubeX-Channel": id } : {};
}

/**
 * Chame logo após o login Google: o servidor descobre QUAL canal foi escolhido na tela do Google
 * (channels.list mine=true com o token desse consentimento), guarda o refresh token dele e o torna
 * ativo. Assim, entrar escolhendo outro canal carrega o canal certo.
 */
export function rememberGoogleTokens(session: any): Promise<void> {
  const provider = String(session?.provider_token || "");
  const refresh = String(session?.provider_refresh_token || "");
  const auth = String(session?.access_token || "");
  if (!auth || (!provider && !refresh)) return Promise.resolve();
  const mark = `${String(session?.user?.id || "")}:${(provider || refresh).slice(-16)}`;
  try { if (localStorage.getItem(SEEN_KEY) === mark) return Promise.resolve(); } catch {}
  const job = (async () => {
    try {
      const scopes = provider ? (await checkGoogleScopes(provider)).scopes.join(" ") : "";
      const r = await fetch("/api/youtube/token", { method: "POST", headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", refreshToken: refresh, accessToken: provider, scopes }) });
      const d = r.ok ? await r.json().catch(() => ({})) : {};
      const chan = String(d?.channelId || "");
      if (chan) setActiveChannelId(chan, true);
      writeCache(provider && chan ? { token: provider, exp: Date.now() + 50 * 60_000, chan } : null);
      if (r.ok && (d?.saved || chan)) { try { localStorage.setItem(SEEN_KEY, mark); } catch {} }
    } catch {}
  })();
  remembering = job.finally(() => { remembering = null; });
  return remembering;
}

/* ---------- Lista / troca / adição de canais ---------- */

export type ConnectedChannel = { id: string; title: string; thumbnail: string; customUrl: string; googleEmail: string; active: boolean; hasRefresh: boolean; lastError: string | null };

export async function listConnectedChannels(): Promise<{ channels: ConnectedChannel[]; activeId: string; oauthConfigured: boolean }> {
  if (remembering) await remembering.catch(() => {});
  const { token } = await bearer();
  if (!token) return { channels: [], activeId: "", oauthConfigured: false };
  const r = await fetch("/api/youtube/channels", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);
  const d = r && r.ok ? await r.json().catch(() => ({})) : {};
  return { channels: Array.isArray(d?.channels) ? d.channels : [], activeId: String(d?.activeId || ""), oauthConfigured: d?.oauthConfigured === true };
}

export async function switchChannel(id: string) {
  const { token } = await bearer();
  if (token) await fetch("/api/youtube/channels", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "activate", channelId: id }) }).catch(() => null);
  writeCache(null);
  setActiveChannelId(id, true);
}

export async function disconnectChannel(id: string) {
  const { token } = await bearer();
  if (!token) return;
  await fetch("/api/youtube/channels", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", channelId: id }) }).catch(() => null);
  if (getActiveChannelId() === id) { writeCache(null); setActiveChannelId("", false); }
}

/**
 * Abre a tela do Google para adicionar/reconectar um canal SEM trocar o login TubeX.
 * Devolve false quando o servidor não tem o OAuth configurado (aí use o login do Supabase).
 */
export async function startChannelConnect(extraScopes: string[] = [], tab = ""): Promise<boolean> {
  const { token } = await bearer();
  if (!token) return false;
  let current = tab;
  if (!current) { try { current = new URLSearchParams(window.location.search).get("tab") || ""; } catch {} }
  const r = await fetch("/api/youtube/oauth/start", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ extraScopes, tab: current || "home" }) }).catch(() => null);
  if (!r || !r.ok) return false;
  const d = await r.json().catch(() => ({}));
  if (!d?.url) return false;
  window.location.href = d.url;
  return true;
}
