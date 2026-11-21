import { NextResponse } from "next/server";
import { callTubeXBackend, getAuthenticatedUser, getTrendSeries } from "@/lib/tubex-backend";
import { recordServerProductEvent } from "@/lib/tubex-server-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  // Google Trends public-interest data is available on all plans.
  // It is a relative 0–100 index, never an absolute search count.

  try {
    const body = await request.json();
    const keyword = String(body?.keyword || "").trim().slice(0, 100);
    const range = (["7d", "30d", "60d", "90d", "12m"].includes(body?.range) ? body.range : "30d") as "7d" | "30d" | "60d" | "90d" | "12m";
    if (!keyword) return NextResponse.json({ error: "Palavra-chave obrigatória." }, { status: 400 });

    const result = await callTubeXBackend("/trends", {
      keyword,
      geo: "",
      property: body?.property === "google" ? "" : "youtube",
      range,
    });
    const trend = getTrendSeries(result, range);
    if (!trend) {
      return NextResponse.json({
        success: false,
        error: "no_timeseries",
        message: "O Google Trends não disponibilizou uma série para esta pesquisa agora. Tente novamente mais tarde.",
      }, { status: 200, headers: { "Cache-Control": "private, max-age=0, must-revalidate" } });
    }
    await recordServerProductEvent(request, user.id, "trend_search_completed", "keyword_trends");
    return NextResponse.json({ success: true, keyword, range, geo: "", property: body?.property === "google" ? "google" : "youtube", metric: "relative_interest_index_0_100", isSearchCount: false, trend }, {
      headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
    });
  } catch (error: any) {
    const status = Number(error?.status) || 502;
    if (status === 429) {
      return NextResponse.json({
        success: false,
        error: "upstream_rate_limited",
        message: "O Google Trends está limitando temporariamente as consultas. Sua análise SEO continua disponível; tente novamente em alguns minutos.",
      }, { status: 429, headers: { "Retry-After": "120", "Cache-Control": "no-store" } });
    }
    return NextResponse.json({
      success: false,
      error: "trends_unavailable",
      message: "Não foi possível consultar as tendências agora. Tente novamente em instantes.",
    }, { status: 502 });
  }
}
