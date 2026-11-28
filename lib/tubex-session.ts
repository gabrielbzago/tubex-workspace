"use client";
import { supabase } from "@/lib/supabase";

/**
 * Sessão do site persistente.
 * - O Supabase guarda a sessão e renova o access token sozinho (autoRefreshToken).
 * - O token do Google é renovado no servidor com o refresh token salvo (sem tela nenhuma).
 * Só pedimos para a pessoa entrar de novo quando a renovação é IMPOSSÍVEL:
 * refresh token do Supabase inválido, ou refresh token do Google revogado/inexistente.
 */

export const RELOGIN_EVENT = "tubex-relogin-required";
export type ReloginReason = "session" | "google";

let asked = false;
/** Abre o aviso "Entre novamente" (uma vez). Não redireciona sozinho. */
export function requestSiteRelogin(reason: ReloginReason = "session") {
  if (asked) return;
  asked = true;
  try { window.dispatchEvent(new CustomEvent(RELOGIN_EVENT, { detail: reason })); } catch {}
}
export function resetReloginRequest() { asked = false; }

/**
 * Bearer do Supabase válido. Se o access token venceu, renova em silêncio com o refresh token.
 * Devolve "" só quando a sessão realmente acabou.
 */
export async function getSiteBearer(forceRefresh = false): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const s = data.session;
  const exp = Number(s?.expires_at || 0) * 1000;
  if (s?.access_token && !forceRefresh && exp - Date.now() > 60_000) return s.access_token;
  if (!s?.refresh_token) return s?.access_token || "";
  const r = await supabase.auth.refreshSession();
  return r.data.session?.access_token || "";
}

/**
 * fetch autenticado: em 401, renova a sessão em silêncio e tenta de novo uma vez.
 * Se ainda der 401 com refresh inválido, aí sim pede o login do site.
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const go = (token: string) => fetch(input, { ...init, headers: { ...(init.headers as Record<string, string> || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  let res = await go(await getSiteBearer());
  if (res.status !== 401) return res;
  const fresh = await getSiteBearer(true);
  if (!fresh) { requestSiteRelogin("session"); return res; }
  res = await go(fresh);
  if (res.status === 401) requestSiteRelogin("session");
  return res;
}

/** Entrar de novo com Google: o MESMO pedido do login do site (escopos que o Google já aprovou). */
export async function reloginWithGoogle(email = "") {
  try { sessionStorage.setItem("tubex-pending-google-login", "1"); } catch {}
  const queryParams: Record<string, string> = { access_type: "offline", prompt: "consent", include_granted_scopes: "true" };
  if (email && !/@pages\.plusgoogle\.com$/i.test(email)) queryParams.login_hint = email;
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
      scopes: "openid email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly",
      queryParams,
    },
  });
}
