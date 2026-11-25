import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tubex-backend";
import { resolveAccountPlan } from "@/lib/tubex-plan";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 45;

const PLAN_LIMITS: Record<string, number> = {
  free: 25,
  start: 200,
  pro: 600,
  expert: 1600,
  owner: 100000,
};
const PLAN_LABELS: Record<string, string> = {
  free: "Free", start: "Start", pro: "Pro", expert: "Expert", owner: "Admin",
};
const MODEL = process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-20b";

function monthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function getPlanAndUsage(user: any) {
  const resolved = await resolveAccountPlan(user);
  const plan = resolved.plan in PLAN_LIMITS ? resolved.plan : "free";
  const limit = PLAN_LIMITS[plan];
  const { data, error } = await supabaseAdmin
    .from("tubex_ai_usage")
    .select("used")
    .eq("user_id", user.id)
    .eq("month_key", monthKey())
    .maybeSingle();
  if (error) throw new Error(`Não foi possível consultar o consumo da IA: ${error.message}`);
  return { plan, planLabel: PLAN_LABELS[plan], used: Number(data?.used || 0), limit };
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  try {
    return NextResponse.json(await getPlanAndUsage(user));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Falha ao consultar o plano." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Groq ainda não configurada. Cadastre GROQ_API_KEY nas variáveis de ambiente da Vercel." }, { status: 503 });

  let reserved = false;
  try {
    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    const context = body.channelContext && typeof body.channelContext === "object" ? body.channelContext : {};
    const mode = body.mode === "deep" ? "deep" : "fast";

    if (!messages.length || messages.length > 12 || messages.some((m: any) =>
      !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 8000
    )) return NextResponse.json({ error: "Envie uma conversa válida. Cada mensagem pode ter até 8.000 caracteres." }, { status: 400 });

    const planInfo = await getPlanAndUsage(user);
    const quota = await supabaseAdmin.rpc("consume_tubex_ai_usage", {
      p_user_id: user.id,
      p_month_key: monthKey(),
      p_monthly_limit: planInfo.limit,
    });
    if (quota.error) throw new Error(`Falha no controle de créditos: ${quota.error.message}`);
    const quotaRow = Array.isArray(quota.data) ? quota.data[0] : quota.data;
    if (!quotaRow?.allowed) {
      return NextResponse.json({
        error: `Você atingiu o limite mensal do TubeX AI no plano ${planInfo.planLabel} (${planInfo.limit} mensagens). Faça upgrade para continuar.`,
        quota: { plan: planInfo.plan, planLabel: planInfo.planLabel, used: Number(quotaRow?.used || planInfo.used), limit: planInfo.limit, remaining: 0 },
      }, { status: 429 });
    }
    reserved = true;

    const system = `Você é o TubeX AI, copiloto especialista em crescimento de canais do YouTube. Responda em português do Brasil, com clareza, precisão e apresentação profissional. Não prometa viralização. Diferencie fatos fornecidos, hipóteses e recomendações. Nunca invente métricas, concorrentes, tendências ou acesso a ferramentas. O contexto recebido pode estar incompleto; informe claramente quando faltarem dados. Use números apenas quando estiverem presentes no contexto.

FORMATAÇÃO OBRIGATÓRIA:
- Escreva em Markdown simples e válido: use títulos curtos com ##, negrito com **texto**, listas com - ou 1., e parágrafos curtos.
- Não escreva tabelas com barras verticais, a menos que uma comparação realmente exija tabela.
- Nunca mostre delimitadores de tabela, separadores, sintaxe ou instruções de formatação como texto.
- Evite blocos longos. Organize a resposta em seções pequenas e escaneáveis.
- Não use mais de 2 níveis de títulos. Não repita a pergunta do usuário.
- Comece pela resposta ou recomendação principal, sem introduções genéricas.

PADRÃO PARA PEDIDOS DE TÍTULOS:
- Entregue de 5 a 10 opções numeradas, a menos que o usuário peça outra quantidade.
- Cada opção deve ter o título em negrito e, abaixo, uma justificativa curta com o ângulo (descoberta, curiosidade, problema, transformação ou prova).
- Destaque apenas uma opção como "Minha aposta" e explique brevemente o motivo.
- Não invente dados de desempenho nem diga que um título terá CTR garantido.
- Evite títulos genéricos, repetitivos ou que prometam resultados não comprovados.

${mode === "deep"
      ? "MODO PROFUNDO: organize a análise em diagnóstico, evidências disponíveis, hipóteses, prioridades e próximos passos. Avalie limitações dos dados."
      : "MODO RÁPIDO: responda de forma concisa, priorizando as ações mais importantes."}

CONTEXTO DISPONÍVEL DO CANAL:
${JSON.stringify(context).slice(0, 12000)}

CAPACIDADES ATUAIS:
Você pode analisar o contexto enviado pelo Workspace, explicar métricas, sugerir títulos, pautas, roteiros e estratégias. Se pedirem dados privados que não aparecem no contexto, não diga que consultou o YouTube Analytics; solicite a conexão/permissão necessária. Não afirme que gerou uma thumbnail: geração de imagem é um serviço separado.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, ...messages.map((m: any) => ({ role: m.role, content: m.content }))],
        max_completion_tokens: mode === "deep" ? 1800 : 1000,
        temperature: 0.4,
        stream: false,
      }),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (reserved) {
        await supabaseAdmin.rpc("release_tubex_ai_usage", { p_user_id: user.id, p_month_key: monthKey() });
        reserved = false;
      }
      const status = response.status === 429 ? 503 : response.status;
      return NextResponse.json({ error: data?.error?.message || `Groq respondeu com erro (${response.status}). Tente novamente em instantes.` }, { status });
    }
    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("Groq não retornou uma resposta válida.");
    const used = Number(quotaRow.used || 0);
    return NextResponse.json({
      answer,
      model: data.model || MODEL,
      quota: { plan: planInfo.plan, planLabel: planInfo.planLabel, used, limit: planInfo.limit, remaining: Math.max(0, planInfo.limit - used) },
      usage: data.usage || null,
    });
  } catch (error: any) {
    if (reserved) {
      try { await supabaseAdmin.rpc("release_tubex_ai_usage", { p_user_id: user.id, p_month_key: monthKey() }); } catch {}
    }
    return NextResponse.json({ error: error?.message || "Não foi possível processar sua mensagem." }, { status: 500 });
  }
}
