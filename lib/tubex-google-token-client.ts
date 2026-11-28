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
const PENDING_KEY = "tubex-google-rt-pending";
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
    const e = await r.clone().json().catch(() => ({}));
    lastServerReason = String(e?.reason || "409");
    // O servidor ainda não tem token deste canal: tenta salvar de novo o token pendente do login.
    if (await resendPending()) return refreshFromServer(channelId);
    return "";
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

/* ---------- Token do login (provider_token) ---------- */

const PT_CHANNEL_KEY = "tubex-google-pt-channel";
const APPLIED_KEY = "tubex-google-pt-applied";
/**
 * Canal que o token do login enxerga (channels.list mine=true, direto no YouTube, sem servidor).
 * O canal escolhido na tela do Google é a FONTE DA VERDADE logo após o login.
 */
async function providerChannel(provider: string): Promise<string> {
  const tail = provider.slice(-16);
  try { const c = JSON.parse(sessionStorage.getItem(PT_CHANNEL_KEY) || "null"); if (c?.t === tail && c?.id) return String(c.id); } catch {}
  try {
    const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true&maxResults=1", { headers: { Authorization: `Bearer ${provider}` }, cache: "no-store" });
    if (!r.ok) return "";
    const d = await r.json().catch(() => ({}));
    const id = String(d?.items?.[0]?.id || "");
    if (id) { try { sessionStorage.setItem(PT_CHANNEL_KEY, JSON.stringify({ t: tail, id })); } catch {} }
    return id;
  } catch { return ""; }
}

/** Canal que o último login do Google enxergou (para o diagnóstico no seletor). */
export function getLoginChannelId(): string {
  try { return String(JSON.parse(sessionStorage.getItem(PT_CHANNEL_KEY) || "null")?.id || ""); } catch { return ""; }
}

/** Token do login ainda válido + canal dele. */
async function freshProvider(): Promise<{ token: string; chan: string; exp: number; scopes: GoogleScopes } | null> {
  const { session } = await bearer();
  const provider = String(session?.provider_token || "");
  if (!provider) return null;
  const scopes = await checkGoogleScopes(provider);
  if (!scopes.valid || scopes.expiresIn <= 90) return null;
  const chan = await providerChannel(provider);
  return { token: provider, chan, exp: Date.now() + scopes.expiresIn * 1000, scopes };
}

async function resolve(force: boolean): Promise<string> {
  if (remembering) await remembering.catch(() => {});
  if (!force) { const c = readCache(); if (c) return c.token; }
  let active = getActiveChannelId();
  // 1) Token do login: vale enquanto não vence (~1h) para o canal escolhido no Google.
  const p = await freshProvider();
  // Login novo (token ainda não aplicado): o canal escolhido na tela do Google vira o ativo.
  if (p?.chan) {
    const tail = p.token.slice(-16);
    let applied = ""; try { applied = localStorage.getItem(APPLIED_KEY) || ""; } catch {}
    if (applied !== tail) {
      try { localStorage.setItem(APPLIED_KEY, tail); } catch {}
      if (p.chan !== active) { setActiveChannelId(p.chan, Boolean(active)); active = p.chan; }
    }
  }
  if (p && (!active || !p.chan || p.chan === active)) {
    if (p.chan && !active) setActiveChannelId(p.chan, false);
    writeCache({ token: p.token, exp: p.exp, chan: getActiveChannelId(), scopes: p.scopes });
    return p.token;
  }
  // 2) Servidor: renova o canal ativo com o refresh token salvo (sem tela nenhuma).
  const fresh = await refreshFromServer(active);
  if (fresh) return fresh;
  // 3) Último recurso: token do login mesmo que seja de outro canal.
  if (p) { writeCache({ token: p.token, exp: p.exp, chan: getActiveChannelId(), scopes: p.scopes }); return p.token; }
  writeCache(null);
  return "";
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
let resent = false;
async function resendPending(): Promise<boolean> {
  if (resent) return false;
  resent = true;
  const { session } = await bearer();
  if (!session) return false;
  try { localStorage.removeItem(SEEN_KEY); } catch {}
  await rememberGoogleTokens(session);
  return true;
}

export function rememberGoogleTokens(session: any): Promise<void> {
  const provider = String(session?.provider_token || "");
  const auth = String(session?.access_token || "");
  const userId = String(session?.user?.id || "");
  let refresh = String(session?.provider_refresh_token || "");
  // O Supabase descarta o provider_refresh_token na 1ª renovação da sessão (~1h). Guardamos uma
  // cópia local até o servidor confirmar que salvou; assim um erro temporário não perde o token.
  // A cópia pendente só vale quando a sessão já não tem token do login (provider_token). Com um login
  // novo, nunca misturamos o refresh token antigo (de outro canal) com o token do canal escolhido agora.
  try {
    if (refresh) localStorage.setItem(PENDING_KEY, JSON.stringify({ u: userId, t: refresh }));
    else if (!provider) { const p = JSON.parse(localStorage.getItem(PENDING_KEY) || "null"); if (p?.u === userId && p?.t) refresh = String(p.t); }
    else localStorage.removeItem(PENDING_KEY);
  } catch {}
  if (!auth || (!provider && !refresh)) return Promise.resolve();
  // Marca pelo token do LOGIN (único a cada login); o refresh token do Google pode se repetir.
  const mark = `${userId}:${(provider || refresh).slice(-16)}:${refresh.slice(-8)}`;
  try { if (localStorage.getItem(SEEN_KEY) === mark) { localStorage.removeItem(PENDING_KEY); return Promise.resolve(); } } catch {}
  const job = (async () => {
    try {
      // Canal escolhido na tela do Google: descobre direto no YouTube (não depende do servidor).
      const loginChan = provider ? await providerChannel(provider) : "";
      if (loginChan) {
        try { localStorage.setItem(APPLIED_KEY, provider.slice(-16)); } catch {}
        setActiveChannelId(loginChan, true);
        const sc = await checkGoogleScopes(provider);
        if (sc.valid && sc.expiresIn > 90) writeCache({ token: provider, exp: Date.now() + sc.expiresIn * 1000, chan: loginChan, scopes: sc });
      }
      const scopes = provider ? (await checkGoogleScopes(provider)).scopes.join(" ") : "";
      const r = await fetch("/api/youtube/token", { method: "POST", headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", refreshToken: refresh, accessToken: provider, scopes }) });
      const d = r.ok ? await r.json().catch(() => ({})) : {};
      const chan = String(d?.channelId || "");
      if (chan && !loginChan) { setActiveChannelId(chan, true); writeCache(provider ? { token: provider, exp: Date.now() + 50 * 60_000, chan } : null); }
      if (chan && loginChan && chan !== loginChan) console.warn("[TubeX] servidor registrou outro canal que o do login", chan, loginChan);
      // Só marca como salvo quando o refresh token ficou guardado no servidor (ou não havia um).
      const done = r.ok && (refresh ? d?.refreshStored === true : Boolean(chan));
      if (done) { try { localStorage.setItem(SEEN_KEY, mark); localStorage.removeItem(PENDING_KEY); } catch {} }
      else if (d?.error) console.warn("[TubeX] Google token não salvo:", d.error);
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
