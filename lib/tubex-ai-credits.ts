import { supabaseAdmin } from "@/lib/supabase-admin";

/** Franquia mensal de créditos por plano (renova todo dia 1, horário UTC). */
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

/** Função/tabela nova ainda não criada no banco (migração de pacotes não rodada). */
function isMissingObject(error: any) {
  const text = `${error?.code || ""} ${error?.message || ""}`;
  return /PGRST202|PGRST205|42883|42P01|does not exist|Could not find/i.test(text);
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

/** Saldo de créditos comprados em pacotes (não expira na virada do mês). */
export async function readPackBalance(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("tubex_ai_credit_wallet")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingObject(error)) return 0;
    throw new Error(`Não foi possível consultar o saldo de pacotes: ${error.message}`);
  }
  return Number(data?.balance || 0);
}

export type CreditReservation = {
  allowed: boolean;
  /** Créditos do plano usados neste mês, depois da reserva. */
  used: number;
  fromPlan: number;
  fromPack: number;
  packBalance: number;
  monthKey: string;
};

/** Reserva créditos: franquia do mês primeiro, depois o saldo de pacotes. */
export async function reserveCredits(userId: string, cost: number, limit: number): Promise<CreditReservation> {
  const monthKey = aiMonthKey();
  const v2 = await supabaseAdmin.rpc("consume_tubex_ai_credits_v2", {
    p_user_id: userId, p_month_key: monthKey, p_monthly_limit: limit, p_cost: cost,
  });
  if (!v2.error) {
    const row: any = Array.isArray(v2.data) ? v2.data[0] : v2.data;
    return {
      allowed: Boolean(row?.allowed),
      used: Number(row?.used || 0),
      fromPlan: Number(row?.from_plan || 0),
      fromPack: Number(row?.from_pack || 0),
      packBalance: Number(row?.pack_balance || 0),
      monthKey,
    };
  }
  if (!isMissingObject(v2.error)) throw new Error(`Falha no controle de créditos: ${v2.error.message}`);

  // Compatibilidade: enquanto a migração de pacotes não roda, só existe a franquia do plano.
  const result = await supabaseAdmin.rpc("consume_tubex_ai_credits", {
    p_user_id: userId, p_month_key: monthKey, p_monthly_limit: limit, p_cost: cost,
  });
  if (result.error) throw new Error(`Falha no controle de créditos: ${result.error.message}`);
  const row: any = Array.isArray(result.data) ? result.data[0] : result.data;
  const allowed = Boolean(row?.allowed);
  return { allowed, used: Number(row?.used || 0), fromPlan: allowed ? cost : 0, fromPack: 0, packBalance: 0, monthKey };
}

/** Devolve exatamente o que a reserva tirou de cada lado. */
export async function releaseCredits(userId: string, reservation: CreditReservation | null | undefined) {
  if (!reservation?.allowed || (reservation.fromPlan <= 0 && reservation.fromPack <= 0)) return;
  if (reservation.fromPack > 0) {
    const result = await supabaseAdmin.rpc("release_tubex_ai_credits_v2", {
      p_user_id: userId, p_month_key: reservation.monthKey, p_from_plan: reservation.fromPlan, p_from_pack: reservation.fromPack,
    });
    if (result.error) throw new Error(`Falha ao devolver créditos: ${result.error.message}`);
    return;
  }
  const result = await supabaseAdmin.rpc("release_tubex_ai_credits", {
    p_user_id: userId, p_month_key: reservation.monthKey, p_cost: reservation.fromPlan,
  });
  if (result.error) throw new Error(`Falha ao devolver créditos: ${result.error.message}`);
}

export type AIQuotaPayload = {
  plan: string;
  planLabel: string;
  /** Créditos do plano usados no mês. */
  used: number;
  /** Franquia mensal do plano. */
  limit: number;
  planRemaining: number;
  packBalance: number;
  /** Total disponível agora (plano + pacotes). */
  remaining: number;
  cost?: number;
  action?: string;
};

export function buildQuota(plan: string, used: number, packBalance: number, extra: { cost?: number; action?: string } = {}): AIQuotaPayload {
  const limit = AI_CREDIT_LIMITS[plan] ?? AI_CREDIT_LIMITS.free;
  const planRemaining = Math.max(0, limit - used);
  return {
    plan, planLabel: AI_PLAN_LABELS[plan] || plan, used, limit,
    planRemaining, packBalance, remaining: planRemaining + packBalance, ...extra,
  };
}
