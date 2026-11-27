import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tubex-backend";
import { googleRefreshConfigured } from "@/lib/tubex-google-token";
import { buildGoogleAuthUrl, STATE_COOKIE } from "@/lib/tubex-google-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/** POST { tab?, extraScopes? } → { url } da tela do Google para adicionar/reconectar um canal. */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: noStore });
  if (!googleRefreshConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 409, headers: noStore });
  const body = await request.json().catch(() => ({}));
  const { url, nonce } = buildGoogleAuthUrl(request, user.id, {
    tab: String(body?.tab || "home"),
    extraScopes: Array.isArray(body?.extraScopes) ? body.extraScopes.map(String) : [],
  });
  const res = NextResponse.json({ url }, { headers: noStore });
  // Amarra a volta do Google a ESTE navegador (evita que um link de terceiros ligue o canal a outra conta).
  res.cookies.set(STATE_COOKIE, nonce, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/youtube/oauth", maxAge: 15 * 60 });
  return res;
}
