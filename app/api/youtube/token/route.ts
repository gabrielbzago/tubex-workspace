import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tubex-backend";
import { googleRefreshConfigured, refreshGoogleAccessToken, saveGoogleConsent } from "@/lib/tubex-google-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * POST { action: "save", refreshToken?, accessToken?, scopes? } → após o login OAuth: descobre o canal
 *   escolhido, guarda o refresh token dele e o torna ativo. Devolve { saved, channelId }.
 * POST { action: "refresh", channelId? } → access token novo do Google para o canal (ou o ativo).
 */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: noStore });
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "refresh");

  if (action === "save") {
    const refreshToken = String(body?.refreshToken || "").trim();
    const accessToken = String(body?.accessToken || "").trim();
    if ((!refreshToken && !accessToken) || refreshToken.length > 2048 || accessToken.length > 4096) return NextResponse.json({ error: "Token inválido." }, { status: 400, headers: noStore });
    const saved = await saveGoogleConsent(user.id, { refreshToken, accessToken, scopes: String(body?.scopes || "") });
    return NextResponse.json({ ...saved, refreshConfigured: googleRefreshConfigured() }, { headers: noStore });
  }

  const channelId = String(body?.channelId || "").trim();
  const r = await refreshGoogleAccessToken(user.id, /^UC[\w-]{10,}$/.test(channelId) ? channelId : "");
  if (!r.ok) return NextResponse.json({ error: r.message, reason: r.reason, channelId: r.channelId || "" }, { status: r.reason === "error" ? 502 : 409, headers: noStore });
  return NextResponse.json({ accessToken: r.accessToken, expiresIn: r.expiresIn, scope: r.scope, channelId: r.channelId }, { headers: noStore });
}
