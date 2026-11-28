import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Fluxo OAuth próprio para CONECTAR CANAIS (não troca o login do TubeX).
 *
 * Por quê: se o "Reconectar" usa o login Google do Supabase e a pessoa escolhe uma conta de marca,
 * o Supabase entra em OUTRA conta TubeX (ou mantém o token antigo). Aqui a pessoa continua logada
 * na mesma conta TubeX e só adicionamos o canal escolhido na tela do Google.
 *
 * Requer GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET e, no Google Cloud (Credenciais > cliente OAuth >
 * URIs de redirecionamento autorizados): https://SEU-DOMINIO/api/youtube/oauth/callback
 */

// Mesmos escopos do login do site (o Google já aprova esse pedido; escopos extras como
// force-ssl/receita fizeram o Google mostrar "Este app está bloqueado" em conta de marca).
export const YT_BASE_SCOPES = [
  "openid", "email", "profile",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];
const ALLOWED_EXTRA = new Set<string>();

function stateSecret() {
  return `tubex-oauth-state:${process.env.GOOGLE_TOKEN_SECRET || process.env.GOOGLE_CLIENT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ""}`;
}
const b64 = (v: string | Buffer) => Buffer.from(v).toString("base64url");
const sign = (payload: string) => createHmac("sha256", stateSecret()).update(payload).digest("base64url");

export function siteOrigin(request: Request) {
  const env = String(process.env.TUBEX_OAUTH_ORIGIN || "").trim().replace(/\/+$/, "");
  if (/^https?:\/\//.test(env)) return env;
  return new URL(request.url).origin;
}
export const redirectUri = (request: Request) => `${siteOrigin(request)}/api/youtube/oauth/callback`;

export const STATE_COOKIE = "tubex_yt_oauth";
export type OAuthState = { u: string; t: string; e: number; n: string };

export function buildGoogleAuthUrl(request: Request, userId: string, opts: { tab?: string; extraScopes?: string[]; loginHint?: string } = {}) {
  const tab = /^[a-z:]{1,40}$/.test(String(opts.tab || "")) ? String(opts.tab) : "home";
  const state: OAuthState = { u: userId, t: tab, e: Date.now() + 15 * 60_000, n: randomBytes(8).toString("hex") };
  const payload = b64(JSON.stringify(state));
  const extras = (opts.extraScopes || []).filter((s) => ALLOWED_EXTRA.has(s));
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri(request),
    response_type: "code",
    scope: [...YT_BASE_SCOPES, ...extras].join(" "),
    access_type: "offline",
    // select_account: mostra a lista de contas e, depois, a escolha do canal (conta de marca).
    prompt: "select_account consent",
    include_granted_scopes: "true",
    state: `${payload}.${sign(payload)}`,
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, nonce: state.n };
}

export function verifyState(raw: string): OAuthState | null {
  const [payload, sig] = String(raw || "").split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
    if (!s?.u || !s.e || s.e < Date.now()) return null;
    return s;
  } catch { return null; }
}

export async function exchangeGoogleCode(request: Request, code: string) {
  const body = new URLSearchParams({
    code, client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirect_uri: redirectUri(request), grant_type: "authorization_code",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error(String(d?.error_description || d?.error || `Google ${r.status}`));
  return { accessToken: String(d.access_token), refreshToken: String(d.refresh_token || ""), scope: String(d.scope || "") };
}
