import { NextResponse } from "next/server";
import { buildTubeXKeywordAnalysis } from "@/lib/tubex-seo-engine";
import { callTubeXBackend, getAuthenticatedPlan, getAuthenticatedUser, consumeKeywordUsage, releaseKeywordUsage } from "@/lib/tubex-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rawItems(data: any): any[] {
  const candidates = [data?.items, data?.data?.items, data?.videos, data?.data?.videos];
  return candidates.find(Array.isArray) || [];
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ code: "AUTH_REQUIRED", error: "Sua sessão expirou. Entre novamente para continuar usando o TubeX." }, { status: 401 });
  let usageReservationId: number | null = null;
  try {
    const body = await request.json();
    const keyword = String(body?.keyword || "").trim().replace(/\s+/g, " ").slice(0, 100);
    if (keyword.length < 2) return NextResponse.json({ code: "INVALID_KEYWORD", error: "Digite uma palavra-chave com pelo menos 2 caracteres para começar." }, { status: 400 });

    let plan = await getAuthenticatedPlan(user.id, user.email);
    if (["owner", "admin", "administrator"].includes(plan)) plan = "expert";
    if (plan === "member") plan = "pro";
    if (!["free", "pro", "expert"].includes(plan)) plan = "free";
    const dailyLimit = plan === "free" ? 5 : plan === "pro" ? 50 : 0;

    // Atomic daily quota check (São Paulo timezone) before spending backend resources.
    const quota = await consumeKeywordUsage(user.id, keyword, dailyLimit);
    usageReservationId = quota.usageId;
    if (!quota.allowed) {
      return NextResponse.json({
        code: "PLAN_LIMIT_REACHED",
        error: plan === "free"
          ? "Você usou suas 5 análises gratuitas de hoje."
          : "Você atingiu o limite de 50 análises de hoje.",
        usage: { used: quota.used, limit: dailyLimit, remaining: 0, plan },
      }, { status: 429 });
    }

    const searchData = await callTubeXBackend("/youtube", { keyword: keyword.toLowerCase(), plan });
    let items = rawItems(searchData);
    if (!items.length || !items.some((item: any) => item?.snippet && item?.statistics)) {
      try {
        const enriched = await callTubeXBackend("/youtube", { keyword: keyword.toLowerCase(), plan, includeStats: true });
        const enrichedItems = rawItems(enriched);
        if (enrichedItems.length) items = enrichedItems;
      } catch (enrichmentError) {
        console.warn("TubeX keyword stats enrichment:", enrichmentError);
      }
    }

    const analysis = buildTubeXKeywordAnalysis({ ...searchData, items }, keyword.toLowerCase());
    if (!analysis.analyzed) {
      if (usageReservationId) await releaseKeywordUsage(usageReservationId, user.id);
      usageReservationId = null;
      return NextResponse.json({ code: "NO_RESULTS", error: "Não encontramos vídeos suficientes para analisar essa expressão. Experimente uma palavra-chave mais específica ou uma variação." }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      keyword,
      analysis,
      usage: { used: quota.used, limit: dailyLimit, remaining: dailyLimit === 0 ? 0 : Math.max(0, dailyLimit - quota.used), plan },
      source: "tubex-backend-youtube",
      parity: "extension-v4.2.5",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    // Detalhes técnicos permanecem apenas nos logs do servidor.
    console.error("[TubeX Keyword Explorer]", error);
    if (usageReservationId) {
      try { await releaseKeywordUsage(usageReservationId, user.id); }
      catch (releaseError) { console.error("[TubeX Keyword Explorer] quota release failed", releaseError); }
    }
    if (String(error?.message || "").includes("tubex_keyword_usage")) {
      return NextResponse.json({
        code: "USAGE_SERVICE_UNAVAILABLE",
        error: "Estamos preparando sua experiência de pesquisa. Tente novamente em alguns instantes.",
      }, { status: 503 });
    }
    if (Number(error?.status) === 429) {
      return NextResponse.json({
        code: "SERVICE_BUSY",
        error: "A procura está alta neste momento. Aguarde um instante e continue sua análise.",
      }, { status: 429, headers: { "Retry-After": "30" } });
    }
    return NextResponse.json({
      code: "ANALYSIS_UNAVAILABLE",
      error: "Não foi possível concluir sua análise agora. Tente novamente em alguns instantes.",
    }, { status: 502 });
  }
}
