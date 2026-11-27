import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tubex-backend";
import { googleRefreshConfigured, refreshGoogleAccessToken, saveGoogleRefreshToken } from "@/lib/tubex-google-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * POST { action: "save", refreshToken, scopes? } → guarda o refresh token do Google (após o login OAuth).
 * POST { action: "refresh" }                     → devolve um access token novo do Google.
 */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: noStore });
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "refresh");

  if (action === "save") {
    const refreshToken = String(body?.refreshToken || "").trim();
    if (!refreshToken || refreshToken.length > 2048) return NextResponse.json({ error: "Token inválido." }, { status: 400, headers: noStore });
    const saved = await saveGoogleRefreshToken(user.id, refreshToken, String(body?.scopes || ""));
    return NextResponse.json({ saved: saved.ok, refreshConfigured: googleRefreshConfigured() }, { headers: noStore });
  }

  const r = await refreshGoogleAccessToken(user.id);
  if (!r.ok) return NextResponse.json({ error: r.message, reason: r.reason }, { status: r.reason === "error" ? 502 : 409, headers: noStore });
  return NextResponse.json({ accessToken: r.accessToken, expiresIn: r.expiresIn, scope: r.scope }, { headers: noStore });
}
