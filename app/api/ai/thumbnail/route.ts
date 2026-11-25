import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tubex-backend";
import { resolveAccountPlan } from "@/lib/tubex-plan";
import { AI_CREDIT_LIMITS, AI_PLAN_LABELS, AI_CREDIT_COSTS, readCreditUsage, reserveCredits, releaseCredits } from "@/lib/tubex-ai-credits";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Configure OPENAI_API_KEY na Vercel para gerar thumbnails." }, { status: 503 });

  let reserved = false;
  try {
    const { prompt, title, channelContext } = await request.json();
    const brief = String(prompt || title || "").trim();
    if (brief.length < 5 || brief.length > 1800) return NextResponse.json({ error: "Descreva a thumbnail em pelo menos 5 caracteres (máximo 1.800)." }, { status: 400 });

    const resolved = await resolveAccountPlan(user);
    const plan = resolved.plan in AI_CREDIT_LIMITS ? resolved.plan : "free";
    const limit = AI_CREDIT_LIMITS[plan];
    const usedBefore = await readCreditUsage(user.id);
    const cost = AI_CREDIT_COSTS.thumbnail;
    const reservation = await reserveCredits(user.id, cost, limit);
    if (!reservation?.allowed) {
      const used = Number(reservation?.used ?? usedBefore);
      return NextResponse.json({
        error: `Seus créditos são insuficientes para gerar uma thumbnail. A geração custa ${cost} créditos e você tem ${Math.max(0, limit - used)} disponíveis. Faça upgrade para continuar.`,
        upgradeRequired: true,
        quota: { plan, planLabel: AI_PLAN_LABELS[plan], used, limit, remaining: Math.max(0, limit - used), cost },
      }, { status: 429 });
    }
    reserved = true;

    const channel = channelContext?.channelName ? `Canal: ${String(channelContext.channelName).slice(0,100)}.` : "";
    const imagePrompt = `Crie uma thumbnail profissional para YouTube, proporção horizontal 16:9, resolução alta, composição cinematográfica, leitura imediata em tela pequena, foco visual único, contraste forte e acabamento premium. Evite excesso de elementos, marcas d'água, logotipos inventados e textos longos. Se houver texto solicitado, escreva exatamente e corretamente em português. Brief: ${brief}. ${channel}`;
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-2.5-flare", prompt: imagePrompt, size: "1536x1024", quality: "high", n: 1 }), cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      await releaseCredits(user.id, cost); reserved = false;
      return NextResponse.json({ error: data?.error?.message || `Falha ao gerar imagem (${response.status}). Os créditos foram devolvidos.` }, { status: response.status });
    }
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("O serviço não retornou a imagem.");
    const used = Number(reservation.used || usedBefore + cost);
    reserved = false;
    return NextResponse.json({
      image: `data:image/png;base64,${b64}`,
      quota: { plan, planLabel: AI_PLAN_LABELS[plan], used, limit, remaining: Math.max(0, limit - used), cost, action: "thumbnail" },
    });
  } catch (error: any) {
    if (reserved) { try { await releaseCredits(user.id, AI_CREDIT_COSTS.thumbnail); } catch {} }
    return NextResponse.json({ error: `${error?.message || "Não foi possível gerar a thumbnail."} Se houve falha na geração, os créditos reservados foram devolvidos.` }, { status: 500 });
  }
}
