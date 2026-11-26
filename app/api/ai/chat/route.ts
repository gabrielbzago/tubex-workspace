import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tubex-backend";
import { resolveAccountPlan } from "@/lib/tubex-plan";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createHash } from "node:crypto";
import {
  AI_CREDIT_LIMITS, AI_PLAN_LABELS, classifyChatCost, buildQuota,
  readCreditUsage, readPackBalance, reserveCredits, releaseCredits, type CreditReservation,
} from "@/lib/tubex-ai-credits";
import { AI_CREDIT_PACKS, AI_UPGRADE_PATH } from "@/lib/tubex-ai-packs";

export const runtime = "nodejs";
export const maxDuration = 45;

const MODEL = process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-20b";
const TPM_LIMIT = Math.max(1000, Number(process.env.GROQ_TPM_LIMIT || 6800));
const WINDOW_SECONDS = 60;
const PROMPT_CHAR_BUDGET = 12000;
// Os modelos gpt-oss "pensam" antes de responder e esse raciocínio consome o mesmo
// limite de saída. Com 600 tokens a resposta era cortada no meio (ex.: tabela pela metade).
const OUTPUT_BUDGET = { fast: 2400, deep: 4200 } as const;
const MIN_OUTPUT_TOKENS = 900;
const IS_REASONING_MODEL = /gpt-oss|qwen3|deepseek-r1/i.test(MODEL);

/** Remove o pedaço final incompleto quando o modelo bate no limite de saída. */
function trimTruncatedAnswer(text: string) {
  const lines = text.replace(/\s+$/, "").split("\n");
  // Tabela que ficou só no cabeçalho, ou linha de tabela/lista interrompida.
  while (lines.length && /^\s*\|/.test(lines[lines.length - 1])) lines.pop();
  // Último parágrafo sem pontuação final costuma ser frase cortada.
  const last = lines[lines.length - 1] || "";
  if (last && !/[.!?:)…*]\s*$/.test(last) && lines.length > 3) lines.pop();
  // Título ou linhas vazias que ficaram sem conteúdo depois do corte.
  while (lines.length > 1 && /^\s*(#{1,6}\s.*)?$/.test(lines[lines.length - 1])) lines.pop();
  return lines.join("\n").replace(/\s+$/, "");
}

async function getPlanAndUsage(user: any) {
  const resolved = await resolveAccountPlan(user);
  const plan = resolved.plan in AI_CREDIT_LIMITS ? resolved.plan : "free";
  const limit = AI_CREDIT_LIMITS[plan];
  const [used, packBalance] = await Promise.all([readCreditUsage(user.id), readPackBalance(user.id)]);
  return { ...buildQuota(plan, used, packBalance), planLabel: AI_PLAN_LABELS[plan], limit };
}

function trimMessages(input: any[]) {
  const recent = input.slice(-8).filter((m: any) =>
    ["user", "assistant"].includes(m?.role) && typeof m?.content === "string"
  );
  let remaining = PROMPT_CHAR_BUDGET;
  const output: { role: "user" | "assistant"; content: string }[] = [];
  for (let i = recent.length - 1; i >= 0; i--) {
    const content = recent[i].content.slice(-Math.min(5000, remaining));
    if (!content || remaining <= 0) continue;
    output.unshift({ role: recent[i].role, content });
    remaining -= content.length;
  }
  return output;
}

function estimateTokens(value: unknown) {
  // Estimativa conservadora para português, JSON e instruções. A reserva é ajustada
  // para o uso real retornado pelo provedor quando a chamada termina.
  const chars = JSON.stringify(value).length;
  return Math.ceil(chars / 3.5);
}

async function reserveProviderTokens(tokens: number) {
  const { data, error } = await supabaseAdmin.rpc("reserve_tubex_groq_tokens", {
    p_model: MODEL,
    p_token_limit: TPM_LIMIT,
    p_requested_tokens: tokens,
    p_window_seconds: WINDOW_SECONDS,
  });
  if (error) throw new Error(`Falha no limitador global da IA: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("O limitador global da IA não retornou uma reserva.");
  return {
    allowed: Boolean(row.allowed),
    reservationId: row.reservation_id ? String(row.reservation_id) : null,
    usedTokens: Number(row.used_tokens || 0),
    waitSeconds: Math.max(1, Number(row.wait_seconds || 1)),
  };
}

async function releaseProviderTokens(reservationId: string | null) {
  if (!reservationId) return;
  const { error } = await supabaseAdmin.rpc("release_tubex_groq_tokens", {
    p_reservation_id: reservationId,
  });
  if (error) console.error("[TubeX AI] Não foi possível liberar reserva Groq:", error.message);
}

async function settleProviderTokens(reservationId: string | null, actualTokens: number) {
  if (!reservationId || !Number.isFinite(actualTokens) || actualTokens <= 0) return;
  const { error } = await supabaseAdmin.rpc("settle_tubex_groq_tokens", {
    p_reservation_id: reservationId,
    p_actual_tokens: Math.ceil(actualTokens),
  });
  if (error) console.error("[TubeX AI] Não foi possível ajustar reserva Groq:", error.message);
}

async function recordChatEvent(request: Request, user: any, eventName: string, properties: Record<string, unknown> = {}) {
  try {
    const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const sessionId = bearer ? createHash("sha256").update(bearer).digest("hex").slice(0, 32) : null;
    const planInfo = await resolveAccountPlan(user).catch(() => ({ plan: "free" } as any));
    const { error } = await supabaseAdmin.from("tubex_events").insert({
      user_id: user.id,
      install_id: `web-${user.id}`,
      session_id: sessionId,
      event_name: eventName,
      module: "ai_chat",
      properties: { source: "web_dashboard", plan: planInfo.plan || "free", ...properties },
    });
    if (error) console.warn("[TubeX AI analytics] event not recorded", error.message);
  } catch (error: any) {
    console.warn("[TubeX AI analytics] event not recorded", error?.message || error);
  }
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  try {
    await recordChatEvent(request, user, "chat_opened");
    const quota = await getPlanAndUsage(user);
    return NextResponse.json({
      ...quota,
      packs: AI_CREDIT_PACKS.map(({ envPriceKey, ...pack }) => pack),
      upgrade: AI_UPGRADE_PATH[quota.plan] ?? null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Falha ao consultar o plano." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Groq ainda não configurada. Cadastre GROQ_API_KEY nas variáveis de ambiente da Vercel." }, { status: 503 });

  let creditReserved = false;
  let reservedCost = 0;
  let reservation: CreditReservation | null = null;
  let providerReservationId: string | null = null;

  try {
    const body = await request.json();
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    if (!rawMessages.length || rawMessages.length > 40 || rawMessages.some((m: any) =>
      !["user", "assistant"].includes(m?.role) || typeof m?.content !== "string" || m.content.length > 12000
    )) {
      return NextResponse.json({ error: "Envie uma conversa válida. Cada mensagem pode ter até 12.000 caracteres." }, { status: 400 });
    }

    const messages = trimMessages(rawMessages);
    const context = body.channelContext && typeof body.channelContext === "object" ? body.channelContext : {};
    const compactContext = JSON.stringify(context).slice(0, 4000);
    const mode = body.mode === "deep" ? "deep" : "fast";
    let maxCompletionTokens: number = OUTPUT_BUDGET[mode];

    const planInfo = await getPlanAndUsage(user);
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";
    const charge = classifyChatCost(lastUserMessage, mode);
    const quotaRow = await reserveCredits(user.id, charge.cost, planInfo.limit);
    if (!quotaRow.allowed) {
      const quota = buildQuota(planInfo.plan, quotaRow.used, quotaRow.packBalance, { cost: charge.cost });
      return NextResponse.json({
        error: `Seus créditos acabaram. Esta solicitação custa ${charge.cost} ${charge.cost === 1 ? "crédito" : "créditos"} e você tem ${quota.remaining} disponíveis. Compre um pacote de créditos ou faça upgrade para continuar usando o TubeX AI.`,
        upgradeRequired: true,
        code: "AI_CREDITS_EXHAUSTED",
        quota,
        upgrade: AI_UPGRADE_PATH[planInfo.plan] ?? null,
      }, { status: 429 });
    }
    reservation = quotaRow;
    creditReserved = true;
    reservedCost = charge.cost;

    const system = `Você é o TubeX AI, copiloto especialista em crescimento de canais do YouTube. Responda em português do Brasil, com clareza, precisão e apresentação profissional. Não prometa viralização. Diferencie fatos fornecidos, hipóteses e recomendações. Nunca invente métricas, concorrentes, tendências ou acesso a ferramentas. O contexto recebido pode estar incompleto; informe claramente quando faltarem dados. Use números apenas quando estiverem presentes no contexto.

FORMATAÇÃO:
- Markdown simples: títulos curtos com ##, negrito, listas e parágrafos curtos.
- Tabelas só quando ajudarem de verdade: no máximo 4 colunas e 6 linhas, células curtas. Nunca deixe uma tabela incompleta.
- Termine sempre a resposta com uma conclusão ou "Próximos passos" numerados. Prefira uma resposta completa e enxuta a uma longa que fique pela metade.
- Não mostre sintaxe ou instruções de formatação como texto.
- Não repita a pergunta. Comece pela resposta principal.

PEDIDOS DE TÍTULOS:
- Entregue de 5 a 10 opções, salvo quantidade diferente solicitada.
- Títulos específicos, emocionais e não genéricos; explique brevemente o ângulo.
- Destaque uma aposta principal sem prometer CTR ou viralização.

${mode === "deep"
      ? "MODO PROFUNDO: diagnóstico, evidências, hipóteses, prioridades e próximos passos. Até cerca de 900 palavras."
      : "MODO RÁPIDO: resposta direta e orientada à ação, até cerca de 400 palavras. Em pedidos de diagnóstico, traga os 3 a 5 pontos mais importantes e as prioridades."}

CONTEXTO DO CANAL:
${compactContext}

CAPACIDADES:
Analise o contexto enviado, explique métricas e sugira títulos, pautas, roteiros e estratégias. Se faltarem dados privados, solicite conexão/permissão. Não afirme que gerou thumbnail; geração de imagem é serviço separado.`;

    const requestBody = {
      model: MODEL,
      messages: [{ role: "system", content: system }, ...messages],
      max_completion_tokens: maxCompletionTokens,
      temperature: 0.4,
      stream: false,
      ...(IS_REASONING_MODEL ? { reasoning_effort: mode === "deep" ? "medium" : "low" } : {}),
    };

    // A Groq conta entrada + saída máxima no limite por minuto. Se a conversa já é
    // grande, a saída é reduzida para caber, sem nunca ficar abaixo do mínimo.
    const promptTokens = Math.ceil(estimateTokens(requestBody.messages) * 1.12) + 60;
    maxCompletionTokens = Math.min(maxCompletionTokens, Math.max(MIN_OUTPUT_TOKENS, TPM_LIMIT - promptTokens - 100));
    requestBody.max_completion_tokens = maxCompletionTokens;
    const requestedTokens = promptTokens + maxCompletionTokens;
    if (requestedTokens > TPM_LIMIT) {
      await releaseCredits(user.id, reservation);
      creditReserved = false;
      return NextResponse.json({
        error: "Esta conversa contém contexto demais para a capacidade atual da IA. Inicie uma nova conversa ou reduza o histórico e tente novamente.",
        code: "PROMPT_TOO_LARGE",
      }, { status: 413 });
    }

    const providerQuota = await reserveProviderTokens(requestedTokens);
    if (!providerQuota.allowed) {
      await releaseCredits(user.id, reservation);
      creditReserved = false;
      return NextResponse.json({
        error: `O TubeX AI está processando outras solicitações. Aguarde aproximadamente ${providerQuota.waitSeconds} segundos e tente novamente. Seus créditos não foram consumidos.`,
        code: "AI_CAPACITY_BUSY",
        retryAfterSeconds: providerQuota.waitSeconds,
      }, {
        status: 429,
        headers: { "Retry-After": String(providerQuota.waitSeconds) },
      });
    }
    providerReservationId = providerQuota.reservationId;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      cache: "no-store",
      signal: AbortSignal.timeout(38000),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      await releaseProviderTokens(providerReservationId);
      providerReservationId = null;
      if (creditReserved) {
        await releaseCredits(user.id, reservation);
        creditReserved = false;
      }
      const providerMessage = String(data?.error?.message || "");
      const retryMatch = providerMessage.match(/(?:try again in|retry after)\s*([\d.]+)\s*s?/i);
      const retryAfter = response.status === 429 ? Math.max(2, Math.ceil(Number(retryMatch?.[1] || 10))) : undefined;
      const status = response.status === 429 ? 503 : response.status;
      return NextResponse.json({
        error: response.status === 429
          ? `A capacidade da Groq está temporariamente ocupada. Tente novamente em ${retryAfter} segundos. Seus créditos foram devolvidos.`
          : providerMessage || `Groq respondeu com erro (${response.status}). Tente novamente em instantes.`,
        code: response.status === 429 ? "GROQ_RATE_LIMIT" : "GROQ_PROVIDER_ERROR",
        ...(retryAfter ? { retryAfterSeconds: retryAfter } : {}),
      }, {
        status,
        headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
      });
    }

    const choice = data?.choices?.[0];
    let answer: string = String(choice?.message?.content || "").trim();
    const truncated = choice?.finish_reason === "length";
    if (truncated && answer) {
      answer = `${trimTruncatedAnswer(answer)}\n\n_Resposta resumida por limite de tamanho. Peça "continue" para ver o restante._`;
    }
    if (!answer) {
      throw new Error(truncated
        ? "A análise ficou grande demais para uma resposta. Seus créditos foram devolvidos; tente pedir um ponto específico ou use a Análise profunda."
        : "Groq não retornou uma resposta válida.");
    }

    const actualTokens = Number(data?.usage?.total_tokens || 0);
    if (actualTokens > 0) await settleProviderTokens(providerReservationId, actualTokens);
    // A reserva permanece na janela compartilhada por até 60s após a resposta.
    providerReservationId = null;

    creditReserved = false;
    await recordChatEvent(request, user, "chat_message_sent", {
      plan: planInfo.plan,
      mode,
      action: charge.action,
      credits: reservedCost,
      prompt_chars: lastUserMessage.length,
      total_tokens: actualTokens || null,
      truncated,
    });
    return NextResponse.json({
      answer,
      model: data.model || MODEL,
      quota: buildQuota(planInfo.plan, quotaRow.used, quotaRow.packBalance, { cost: reservedCost, action: charge.action }),
      usage: data.usage || null,
    });
  } catch (error: any) {
    await releaseProviderTokens(providerReservationId);
    if (creditReserved) {
      try { await releaseCredits(user.id, reservation); } catch {}
    }
    const isTimeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    return NextResponse.json({
      error: isTimeout ? "A IA demorou mais que o esperado. Seus créditos foram devolvidos; tente novamente." : error?.message || "Não foi possível processar sua mensagem.",
      code: isTimeout ? "AI_TIMEOUT" : "AI_REQUEST_FAILED",
    }, { status: isTimeout ? 504 : 500 });
  }
}
