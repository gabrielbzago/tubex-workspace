import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tubex-backend";
import { resolveAccountPlan } from "@/lib/tubex-plan";
import { AI_CREDIT_LIMITS, AI_CREDIT_COSTS, buildQuota, reserveCredits, releaseCredits, type CreditReservation } from "@/lib/tubex-ai-credits";
import { AI_UPGRADE_PATH } from "@/lib/tubex-ai-packs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Configure OPENAI_API_KEY na Vercel para gerar thumbnails." }, { status: 503 });

  let reserved = false;
  let reservation: CreditReservation | null = null;
  try {
    const { prompt, title, channelContext } = await request.json();
    const brief = String(prompt || title || "").trim();
    if (brief.length < 5 || brief.length > 1800) return NextResponse.json({ error: "Descreva a thumbnail em pelo menos 5 caracteres (máximo 1.800)." }, { status: 400 });

    const resolved = await resolveAccountPlan(user);
    const plan = resolved.plan in AI_CREDIT_LIMITS ? resolved.plan : "free";
    const limit = AI_CREDIT_LIMITS[plan];
    const cost = AI_CREDIT_COSTS.thumbnail;
    const attempt = await reserveCredits(user.id, cost, limit);
    if (!attempt.allowed) {
      const quota = buildQuota(plan, attempt.used, attempt.packBalance, { cost });
      return NextResponse.json({
        error: `Seus créditos são insuficientes para gerar uma thumbnail. A geração custa ${cost} créditos e você tem ${quota.remaining} disponíveis. Compre um pacote de créditos ou faça upgrade para continuar.`,
        upgradeRequired: true,
        code: "AI_CREDITS_EXHAUSTED",
        quota,
        upgrade: AI_UPGRADE_PATH[plan] ?? null,
      }, { status: 429 });
    }
    reservation = attempt;
    reserved = true;

    const channel = channelContext?.channelName ? `Canal: ${String(channelContext.channelName).slice(0,100)}.` : "";
    const imagePrompt = `Crie uma thumbnail profissional para YouTube, proporção horizontal 16:9, resolução alta, composição cinematográfica, leitura imediata em tela pequena, foco visual único, contraste forte e acabamento premium. Evite excesso de elementos, marcas d'água, logotipos inventados e textos longos. Se houver texto solicitado, escreva exatamente e corretamente em português. Brief: ${brief}. ${channel}`;
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-2.5-flare", prompt: imagePrompt, size: "1536x1024", quality: "medium", n: 1 }), cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      await releaseCredits(user.id, reservation); reserved = false;
      return NextResponse.json({ error: data?.error?.message || `Falha ao gerar imagem (${response.status}). Os créditos foram devolvidos.` }, { status: response.status });
    }
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("O serviço não retornou a imagem.");
    reserved = false;
    return NextResponse.json({
      image: `data:image/png;base64,${b64}`,
      quota: buildQuota(plan, attempt.used, attempt.packBalance, { cost, action: "thumbnail" }),
    });
  } catch (error: any) {
    if (reserved) { try { await releaseCredits(user.id, reservation); } catch {} }
    return NextResponse.json({ error: `${error?.message || "Não foi possível gerar a thumbnail."} Se houve falha na geração, os créditos reservados foram devolvidos.` }, { status: 500 });
  }
}
