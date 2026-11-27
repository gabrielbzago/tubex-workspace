import { NextResponse } from "next/server";
import { registerGoogleChannels } from "@/lib/tubex-google-token";
import { exchangeGoogleCode, siteOrigin, STATE_COOKIE, verifyState } from "@/lib/tubex-google-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Volta da tela do Google: salva o canal escolhido para o usuário TubeX do "state" e o torna ativo. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = siteOrigin(request);
  const back = (tab: string, params: Record<string, string>) => {
    const to = new URL("/dashboard", origin);
    to.searchParams.set("tab", tab || "home");
    for (const [k, v] of Object.entries(params)) to.searchParams.set(k, v);
    const res = NextResponse.redirect(to, { headers: { "Cache-Control": "no-store" } });
    res.cookies.set(STATE_COOKIE, "", { path: "/api/youtube/oauth", maxAge: 0 });
    return res;
  };
  const state = verifyState(url.searchParams.get("state") || "");
  const cookieNonce = (request.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(`${STATE_COOKIE}=`))?.slice(STATE_COOKIE.length + 1) || "";
  if (!state || !cookieNonce || cookieNonce !== state.n) return back(state?.t || "home", { yt_error: "state" });
  const err = url.searchParams.get("error");
  if (err) return back(state.t, { yt_error: err === "access_denied" ? "denied" : "google" });
  const code = url.searchParams.get("code") || "";
  if (!code) return back(state.t, { yt_error: "google" });
  try {
    const tokens = await exchangeGoogleCode(request, code);
    const reg = await registerGoogleChannels(state.u, tokens.accessToken, tokens.refreshToken, tokens.scope);
    if (!reg.activeId) return back(state.t, { yt_error: "no_channel" });
    return back(state.t, { yt_channel: reg.activeId });
  } catch (e: any) {
    console.warn("[TubeX OAuth callback]", e?.message);
    return back(state.t, { yt_error: "google" });
  }
}
