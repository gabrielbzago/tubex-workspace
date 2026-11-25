import { supabaseAdmin } from "@/lib/supabase-admin";

export const AI_CREDIT_LIMITS: Record<string, number> = {
  free: 150,
  start: 600,
  member: 1000,
  pro: 2000,
  expert: 6000,
  owner: 100000,
};

export const AI_PLAN_LABELS: Record<string, string> = {
  free: "Free", start: "Start", member: "Membro", pro: "Pro", expert: "Expert", owner: "Admin",
};

export const AI_CREDIT_COSTS = {
  chat_fast: 1,
  chat_deep: 3,
  titles: 3,
  description: 1,
  script: 5,
  thumbnail: 22,
} as const;

export function aiMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function classifyChatCost(message: string, mode: "fast" | "deep") {
  const value = message.toLocaleLowerCase("pt-BR");
  if (/\b(t[ií]tulos?|ideias de t[ií]tulos?|headline)\b/.test(value)) return { action: "titles", cost: AI_CREDIT_COSTS.titles };
  if (/\b(descri[cç][aã]o|description|meta description)\b/.test(value)) return { action: "description", cost: AI_CREDIT_COSTS.description };
  if (/\b(roteiro|script|narra[cç][aã]o completa)\b/.test(value)) return { action: "script", cost: AI_CREDIT_COSTS.script };
  return { action: mode === "deep" ? "chat_deep" : "chat_fast", cost: mode === "deep" ? AI_CREDIT_COSTS.chat_deep : AI_CREDIT_COSTS.chat_fast };
}

export async function readCreditUsage(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("tubex_ai_credit_usage")
    .select("used")
    .eq("user_id", userId)
    .eq("month_key", aiMonthKey())
    .maybeSingle();
  if (error) throw new Error(`Não foi possível consultar os créditos da IA: ${error.message}`);
  return Number(data?.used || 0);
}

export async function reserveCredits(userId: string, cost: number, limit: number) {
  const result = await supabaseAdmin.rpc("consume_tubex_ai_credits", {
    p_user_id: userId, p_month_key: aiMonthKey(), p_monthly_limit: limit, p_cost: cost,
  });
  if (result.error) throw new Error(`Falha no controle de créditos: ${result.error.message}`);
  return Array.isArray(result.data) ? result.data[0] : result.data;
}

export async function releaseCredits(userId: string, cost: number) {
  const result = await supabaseAdmin.rpc("release_tubex_ai_credits", {
    p_user_id: userId, p_month_key: aiMonthKey(), p_cost: cost,
  });
  if (result.error) throw new Error(`Falha ao devolver créditos: ${result.error.message}`);
}
