import { NextResponse } from "next/server";
import { callTubeXBackend, getAuthenticatedUser } from "@/lib/tubex-backend";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  try {
    const body = await request.json();
    const niche = String(body?.niche || "").trim().slice(0, 160);
    const channelId = String(body?.channelId || "").slice(0, 80);
    const videos = Array.isArray(body?.videos) ? body.videos.slice(0, 20).map((v: any) => ({
      title: String(v?.title || "").slice(0, 180), views: Number(v?.views || 0), publishedAt: String(v?.publishedAt || "").slice(0, 40),
    })) : [];
    const trends = Array.isArray(body?.trends) ? body.trends.slice(0, 10) : [];
    if (niche.length < 2) return NextResponse.json({ error: "Informe ou detecte o nicho do canal." }, { status: 400 });
    const prompt = `Você é estrategista de crescimento no YouTube e analista editorial. Gere 8 ideias de vídeos para o nicho: ${niche}.\n\nCONTEXTO REAL DO CANAL (últimos vídeos):\n${videos.map((v: any) => `- ${v.title} | ${v.views} visualizações | ${v.publishedAt}`).join("\n") || "Ainda não há vídeos disponíveis."}\n\nSINAIS RECENTES DE BUSCA/TRENDS DO YOUTUBE (índice Google Trends 0–100, quando disponível):\n${trends.map((v: any) => `- ${String(v.keyword || "")} | média ${v.average ?? "sem série"}/100 | variação ${v.change ?? "n/d"}`).join("\n") || "Sem série Trends disponível; não invente tendências."}\n\nREGRAS: produza 8 pautas realmente distintas, não repita os títulos recentes; priorize sinais de tendência comprovados e dores do público do nicho; não afirme que algo está em alta sem sinal Trends/autocomplete; títulos em português com promessa clara e bom potencial de CTR, sem clickbait enganoso. Retorne somente JSON válido como array de objetos {"title":"...","angle":"...","trendEvidence":"..."}. Cada title com até 14 palavras. Se os dados recentes forem insuficientes, sinalize isso em trendEvidence.`;
    const ai = await callTubeXBackend("/ai", {
      tipo: "ideas",
      channelId,
      email: user.email || "",
      context: { channelId, niche, videos, trends },
      prompt,
    });
    const rawIdeas = ai?.ideas || ai?.data?.ideas || null;
    const text = (typeof ai?.text === "string" ? ai.text : typeof ai?.data?.text === "string" ? ai.data.text : rawIdeas ? JSON.stringify(rawIdeas) : "").trim();
    if (!text) throw new Error("O backend de IA não retornou ideias.");
    return NextResponse.json({ success: true, text, ideas: Array.isArray(rawIdeas) ? rawIdeas : null });
  } catch (error: any) {
    const status = String(error?.message || "").includes("TUBEX_BACKEND_API_KEY") ? 503 : 502;
    return NextResponse.json({ error: error?.message || "Não foi possível gerar ideias." }, { status });
  }
}
