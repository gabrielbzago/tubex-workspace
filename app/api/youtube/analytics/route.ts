import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tubex-backend";
import { resolveGoogleToken } from "@/lib/tubex-google-token";
import { checkGoogleScopes, fetchChannelAnalytics, fetchVideoAnalytics, summarizeChannelAnalytics, summarizeVideoAnalytics } from "@/lib/tubex-yt-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Analytics do canal/vídeo pelo servidor (útil para o chat da IA e outras rotas).
 *   GET /api/youtube/analytics?type=channel&days=28
 *   GET /api/youtube/analytics?type=video&id=VIDEO_ID[&days=28][&publishedAt=ISO]
 *   &format=summary → devolve só o texto resumido para prompt.
 * Headers: Authorization: Bearer <access_token do Supabase>; opcional X-Google-Token.
 */
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const token = await resolveGoogleToken(request, user.id);
  if (!token) return NextResponse.json({ error: "Conecte o canal do YouTube novamente.", reason: "no_google_token" }, { status: 409 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "channel";
  const days = Math.min(3650, Math.max(0, Number(url.searchParams.get("days") || 0))) || undefined;
  const summary = url.searchParams.get("format") === "summary";
  const scopes = await checkGoogleScopes(token);
  const skipRevenue = !scopes.monetary;

  if (type === "video") {
    const id = String(url.searchParams.get("id") || "");
    if (!/^[\w-]{6,20}$/.test(id)) return NextResponse.json({ error: "ID de vídeo inválido." }, { status: 400 });
    const report = await fetchVideoAnalytics(token, id, { days, publishedAt: url.searchParams.get("publishedAt") || undefined, skipRevenue });
    return NextResponse.json(summary ? { summary: summarizeVideoAnalytics(report), scopes } : { report, scopes }, { headers: { "Cache-Control": "no-store" } });
  }
  const report = await fetchChannelAnalytics(token, { days: days || 28, skipRevenue });
  return NextResponse.json(summary ? { summary: summarizeChannelAnalytics(report), scopes } : { report, scopes }, { headers: { "Cache-Control": "no-store" } });
}
