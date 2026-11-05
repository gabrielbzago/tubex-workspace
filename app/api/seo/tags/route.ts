import { NextResponse } from "next/server";
import {
  callTubeXBackend,
  getAuthenticatedPlan,
  getAuthenticatedUser,
  consumeKeywordUsage,
  releaseKeywordUsage,
} from "@/lib/tubex-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const normalize = (value: string) => String(value || "")
  .toLocaleLowerCase("pt-BR")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\p{L}\p{N}\s]/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({
      code: "AUTH_REQUIRED",
      error: "Sua sessão expirou. Entre novamente para continuar usando o TubeX.",
    }, { status: 401 });
  }

  let usageReservationId: number | null = null;
  try {
    const body = await request.json();
    const keyword = String(body?.keyword || "").trim().replace(/\s+/g, " ").slice(0, 180);
    const source = body?.source === "title" ? "title" : "niche";
    if (keyword.length < 2) {
      return NextResponse.json({
        code: "INVALID_KEYWORD",
        error: source === "title"
          ? "Digite o título do vídeo para encontrar palavras-chave."
          : "Informe o nicho do canal para encontrar palavras-chave.",
      }, { status: 400 });
    }

    let plan = await getAuthenticatedPlan(user.id, user.email);
    if (["owner", "admin", "administrator"].includes(plan)) plan = "expert";
    if (plan === "member") plan = "pro";
    if (!["free", "pro", "expert"].includes(plan)) plan = "free";
    const dailyLimit = plan === "free" ? 5 : plan === "pro" ? 50 : 0;

    const quota = await consumeKeywordUsage(user.id, `tags:${source}:${keyword}`, dailyLimit);
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

    // Mesmo motor utilizado pelo TubeX Analyzer: tags públicas de vídeos relevantes
    // combinadas com sugestões do autocomplete do YouTube. Nenhuma IA é utilizada.
    const result = await callTubeXBackend("/youtube", {
      mode: "tag_suggestions",
      keyword,
      plan,
    });
    const rawTags = Array.isArray(result?.tags) ? result.tags : [];
    const seen = new Set<string>();
    const tags = rawTags.map((item: any) => {
      const keywordValue = String(typeof item === "string" ? item : item?.keyword || item?.tag || "").trim().replace(/\s+/g, " ");
      const scoreValue = Number(typeof item === "string" ? 70 : item?.score ?? item?.relevance ?? 70);
      return {
        keyword: keywordValue,
        score: Number.isFinite(scoreValue) ? Math.max(1, Math.min(100, Math.round(scoreValue))) : 70,
      };
    }).filter((item: { keyword: string; score: number }) => {
      const key = normalize(item.keyword);
      if (key.length < 2 || key.length > 100 || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a: any, b: any) => b.score - a.score).slice(0, 120);

    if (!tags.length) {
      if (usageReservationId) await releaseKeywordUsage(usageReservationId, user.id);
      usageReservationId = null;
      return NextResponse.json({
        success: true,
        tags: [],
        message: "Não encontramos sugestões suficientes para esse termo. Experimente outra expressão.",
      }, { headers: { "Cache-Control": "no-store" } });
    }

    // Free recebe três sugestões utilizáveis e uma pequena prévia bloqueada.
    // Pro e Expert recebem a lista completa, conforme o editor da extensão.
    const visibleLimit = plan === "free" ? 3 : tags.length;
    const responseTags = plan === "free" ? tags.slice(0, 13) : tags;

    return NextResponse.json({
      success: true,
      tags: responseTags,
      visibleLimit,
      totalAvailable: tags.length,
      lockedCount: Math.max(0, tags.length - visibleLimit),
      plan,
      source,
      researchMethod: "youtube_public_video_tags_and_autocomplete",
      usage: {
        used: quota.used,
        limit: dailyLimit,
        remaining: dailyLimit === 0 ? 0 : Math.max(0, dailyLimit - quota.used),
        plan,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("[TubeX Tag Research]", error);
    if (usageReservationId) {
      try { await releaseKeywordUsage(usageReservationId, user.id); }
      catch (releaseError) { console.error("[TubeX Tag Research] quota release failed", releaseError); }
    }
    if (String(error?.message || "").includes("tubex_keyword_usage")) {
      return NextResponse.json({
        code: "USAGE_SERVICE_UNAVAILABLE",
        error: "Não foi possível iniciar sua pesquisa agora. Tente novamente em instantes.",
      }, { status: 503 });
    }
    if (Number(error?.status) === 429) {
      return NextResponse.json({
        code: "SERVICE_BUSY",
        error: "O YouTube está recebendo muitas consultas neste momento. Aguarde um instante e tente novamente.",
      }, { status: 429, headers: { "Retry-After": "30" } });
    }
    return NextResponse.json({
      code: "TAG_RESEARCH_UNAVAILABLE",
      error: "Não foi possível gerar as palavras-chave agora. Tente novamente em instantes.",
    }, { status: 502 });
  }
}
