import { NextResponse } from "next/server";
import { callTubeXBackend, getAuthenticatedPlan, getAuthenticatedUser, getTrendSeries } from "@/lib/tubex-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  let plan = await getAuthenticatedPlan(user.id, user.email);
  if (["owner", "admin", "administrator"].includes(plan)) plan = "expert";
  if (plan === "member") plan = "pro";
  if (!["pro", "expert"].includes(plan)) {
    return NextResponse.json({
      success: false,
      error: "PLAN_UPGRADE_REQUIRED",
      message: "O Google Trends faz parte do TubeX Pro. Faça upgrade para desbloquear o histórico de interesse no YouTube.",
    }, { status: 403 });
  }

  try {
    const body = await request.json();
    const keyword = String(body?.keyword || "").trim().slice(0, 100);
    const range = (["7d", "30d", "12m"].includes(body?.range) ? body.range : "30d") as "7d" | "30d" | "12m";
    if (!keyword) return NextResponse.json({ error: "Palavra-chave obrigatória." }, { status: 400 });

    const result = await callTubeXBackend("/trends", {
      keyword,
      geo: "",
      property: "youtube",
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
    return NextResponse.json({ success: true, keyword, range, geo: "", trend }, {
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
