"use client";
import { supabase } from "@/lib/supabase";
import { checkGoogleScopes, type GoogleScopes } from "@/lib/tubex-yt-analytics";

/**
 * Navegador: access token do Google sempre válido.
 * 1) provider_token da sessão Supabase (só existe logo após o login OAuth e vence em ~1h);
 * 2) token renovado pelo servidor (/api/youtube/token) com o refresh token salvo.
 */

type Cached = { token: string; exp: number; scopes?: GoogleScopes };
const KEY = "tubex-google-at-v1";
let mem: Cached | null = null;
let inflight: Promise<string> | null = null;

function readCache(): Cached | null {
  if (mem && mem.exp - Date.now() > 90_000) return mem;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) { const c = JSON.parse(raw) as Cached; if (c.token && c.exp - Date.now() > 90_000) return (mem = c); }
  } catch {}
  return null;
}
function writeCache(c: Cached | null) {
  mem = c;
  try { if (c) sessionStorage.setItem(KEY, JSON.stringify(c)); else sessionStorage.removeItem(KEY); } catch {}
}

async function refreshFromServer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const bearer = data.session?.access_token;
  if (!bearer) return "";
  const r = await fetch("/api/youtube/token", { method: "POST", headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh" }) }).catch(() => null);
  if (!r || !r.ok) return "";
  const d = await r.json().catch(() => ({}));
  if (!d.accessToken) return "";
  writeCache({ token: d.accessToken, exp: Date.now() + Number(d.expiresIn || 3600) * 1000 });
  return d.accessToken;
}

async function resolve(force: boolean): Promise<string> {
  if (!force) { const c = readCache(); if (c) return c.token; }
  const { data } = await supabase.auth.getSession();
  const provider = String((data.session as any)?.provider_token || "");
  if (provider && (!mem || mem.token !== provider || !force)) {
    const scopes = await checkGoogleScopes(provider);
    if (scopes.valid && scopes.expiresIn > 90) {
      writeCache({ token: provider, exp: Date.now() + scopes.expiresIn * 1000, scopes });
      return provider;
    }
  }
  const fresh = await refreshFromServer();
  if (fresh) return fresh;
  writeCache(null);
  // Sem refresh no servidor: devolve o provider_token mesmo assim (as chamadas dirão se venceu).
  return provider;
}

/** Access token do Google para chamar YouTube Data/Analytics. force=true ignora o cache (use após um 401). */
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

/**
 * Chame logo após o login/reconexão Google: envia o provider_refresh_token para o servidor
 * guardar (criptografado). Idempotente por token.
 */
export async function rememberGoogleTokens(session: any) {
  try {
    const refresh = String(session?.provider_refresh_token || "");
    const bearer = String(session?.access_token || "");
    if (!refresh || !bearer) return;
    const mark = `tubex-google-rt-saved:${refresh.slice(-12)}`;
    if (localStorage.getItem(mark)) return;
    const provider = String(session?.provider_token || "");
    const scopes = provider ? (await checkGoogleScopes(provider)).scopes.join(" ") : "";
    const r = await fetch("/api/youtube/token", { method: "POST", headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", refreshToken: refresh, scopes }) });
    if (r.ok && (await r.json().catch(() => ({})))?.saved) localStorage.setItem(mark, "1");
    writeCache(null);
  } catch {}
}
