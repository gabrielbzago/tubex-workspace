import { supabaseAdmin } from "@/lib/supabase-admin";
import { isTubeXOwner } from "@/lib/tubex-owner";

/**
 * Busca de plano do TubeX — a MESMA regra da extensão (background.js 4.4.6).
 *
 * A assinatura pode estar em qualquer e-mail da pessoa (o e-mail do login no
 * site, o e-mail da conta Google vinculada, o e-mail da instalação da extensão
 * ligada a esta conta). Consultamos TODOS e fica o melhor plano. Empate: o
 * primeiro e-mail da lista (o do login) é o preferido.
 *
 * Cada e-mail é consultado no mesmo endpoint que a extensão usa
 * (tubex-backend /api/planoSB, que inclui o fallback do Sheets). Se esse
 * endpoint falhar por rede/erro técnico, repetimos a mesma regra direto no
 * Supabase, para que uma queda do backend nunca rebaixe um assinante.
 */

export const PLAN_RANK: Record<string, number> = { free: 0, start: 1, member: 2, pro: 3, expert: 4, owner: 5 };
export const VALID_PAID_STATUSES = new Set(["active", "approved", "trialing", "past_due"]);
export const OWNER_EMAILS = new Set(
  [process.env.NEXT_PUBLIC_OWNER_EMAIL || "", "gabrielbzago@gmail.com"].map(v => v.trim().toLowerCase()).filter(Boolean)
);

const PLANO_SB_URL = "https://tubex-backend.vercel.app/api/planoSB";
// Mesma chave interna que a extensão já envia para o planoSB.
const PLANO_SB_KEY = "tubex_secure_2026_ultra";
const CACHE_MS = 60_000;

export type PlanLookup = {
  email: string;
  plan: string;
  status: string | null;
  source: "owner_allowlist" | "planoSB" | "sheets" | "supabase" | "none";
  /** false = não deu para saber (erro técnico em todas as fontes). */
  ok: boolean;
};

export type ResolvedPlan = {
  plan: string;
  email: string;
  status: string | null;
  source: PlanLookup["source"];
  checkedEmails: string[];
  results: PlanLookup[];
};

const cache = new Map<string, { at: number; value: PlanLookup }>();

export function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function normalizePlanName(value: unknown) {
  let plan = String(value || "free").toLowerCase().trim();
  if (plan === "basic" || plan === "starter") plan = "start";
  if (plan === "admin" || plan === "administrator") plan = "owner";
  // Legend/Corporate (futuros) usam os recursos do Expert.
  if (plan === "legend" || plan === "corporate") plan = "expert";
  return PLAN_RANK[plan] === undefined ? "free" : plan;
}

export function planRank(plan: unknown) {
  return PLAN_RANK[normalizePlanName(plan)] ?? 0;
}

/** Escapa curingas do ILIKE (`_` é comum em e-mails e casaria com qualquer caractere). */
function ilikeExact(email: string) {
  return email.replace(/[\\%_]/g, ch => `\\${ch}`);
}

/** Mesma regra do planoSB: owner é permanente; plano pago só vale com status válido. */
export function effectivePlanFromRow(row: { plan?: unknown; status?: unknown } | null | undefined) {
  if (!row) return { plan: "free", status: null as string | null };
  const plan = normalizePlanName(row.plan);
  const status = String(row.status || "inactive").toLowerCase().trim();
  if (plan === "owner") return { plan: "owner", status: "active" };
  if (!VALID_PAID_STATUSES.has(status)) return { plan: "free", status };
  return { plan, status };
}

async function lookupInSupabase(email: string): Promise<PlanLookup> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("email,plan,status")
    .ilike("email", ilikeExact(email))
    .limit(5);
  if (error) return { email, plan: "free", status: null, source: "none", ok: false };
  // Linhas duplicadas para o mesmo e-mail: fica a melhor (o planoSB quebraria com maybeSingle).
  let best: PlanLookup = { email, plan: "free", status: null, source: "supabase", ok: true };
  for (const row of data || []) {
    const effective = effectivePlanFromRow(row);
    if (planRank(effective.plan) > planRank(best.plan)) best = { email, ...effective, source: "supabase", ok: true };
    else if (best.status === null) best.status = effective.status;
  }
  return best;
}

async function lookupInPlanoSB(email: string): Promise<PlanLookup | null> {
  try {
    const response = await fetch(PLANO_SB_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": PLANO_SB_KEY },
      body: JSON.stringify({ email }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    // Mesma leitura da extensão: success:false ou fallback técnico com free = "não sei".
    if (!data || data.success === false) return null;
    const rawPlan = data.plan || data.plano || "free";
    if (data.fallback === true && data.source !== "sheets" && normalizePlanName(rawPlan) === "free") return null;
    const status = data.status ? String(data.status).toLowerCase().trim() : null;
    let plan = normalizePlanName(rawPlan);
    if (plan !== "owner" && status && !VALID_PAID_STATUSES.has(status)) plan = "free";
    return { email, plan, status, source: data.source === "sheets" ? "sheets" : "planoSB", ok: true };
  } catch {
    return null;
  }
}

export async function lookupPlanByEmail(rawEmail: string): Promise<PlanLookup> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { email: "", plan: "free", status: null, source: "none", ok: true };
  if (OWNER_EMAILS.has(email)) return { email, plan: "owner", status: "active", source: "owner_allowlist", ok: true };

  const hit = cache.get(email);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  // O planoSB não vê linhas duplicadas e não lê o Supabase quando cai; por isso
  // a leitura direta também entra na disputa e o melhor resultado vence.
  const [remote, local] = await Promise.all([lookupInPlanoSB(email), lookupInSupabase(email)]);
  let value: PlanLookup = local;
  if (remote && (planRank(remote.plan) > planRank(local.plan) || !local.ok)) value = remote;
  if (value.ok) cache.set(email, { at: Date.now(), value });
  return value;
}

export async function resolveBestPlan(emails: string[]): Promise<ResolvedPlan> {
  const unique = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  if (!unique.length) return { plan: "free", email: "", status: null, source: "none", checkedEmails: [], results: [] };
  const results = await Promise.all(unique.map(email => lookupPlanByEmail(email)));
  let best = results[0];
  for (const result of results) {
    if (planRank(result.plan) > planRank(best.plan)) best = result;
  }
  return { plan: best.plan, email: best.email, status: best.status, source: best.source, checkedEmails: unique, results };
}

type AuthLikeUser = {
  id?: string | null;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: Array<{ identity_data?: Record<string, unknown> | null; email?: string | null }> | null;
};

/**
 * Todos os e-mails que comprovadamente pertencem a esta conta:
 * 1. e-mail do login no site (Supabase Auth) — preferido em empate;
 * 2. e-mails das identidades vinculadas (Google, e-mail/senha);
 * 3. e-mail da linha em `users` com o mesmo id;
 * 4. e-mails Google verificados das instalações da extensão ligadas a esta conta.
 */
export async function collectAccountEmails(user: AuthLikeUser): Promise<string[]> {
  const emails: string[] = [normalizeEmail(user.email)];
  emails.push(normalizeEmail(user.user_metadata?.email));
  for (const identity of user.identities || []) {
    emails.push(normalizeEmail(identity?.identity_data?.email));
    emails.push(normalizeEmail(identity?.email));
  }

  const userIds = new Set<string>();
  if (user.id) {
    userIds.add(user.id);
    try {
      const { data } = await supabaseAdmin.from("users").select("id,email").eq("id", user.id).maybeSingle();
      if (data?.email) emails.push(normalizeEmail(data.email));
    } catch {}
  }
  const loginEmail = normalizeEmail(user.email);
  if (loginEmail) {
    try {
      const { data } = await supabaseAdmin.from("users").select("id").ilike("email", ilikeExact(loginEmail)).limit(5);
      for (const row of data || []) if (row?.id) userIds.add(String(row.id));
    } catch {}
  }
  if (userIds.size) {
    try {
      const { data } = await supabaseAdmin
        .from("tubex_installations")
        .select("email")
        .in("user_id", [...userIds])
        .limit(20);
      for (const row of data || []) emails.push(normalizeEmail(row?.email));
    } catch {}
  }
  return [...new Set(emails.filter(Boolean))];
}

export async function resolveAccountPlan(user: AuthLikeUser): Promise<ResolvedPlan> {
  const checkedEmails = await collectAccountEmails(user);
  // Owner é uma permissão da conta TubeX (Supabase Auth), não do canal YouTube ativo.
  if (await isTubeXOwner(user)) {
    return {
      plan: "owner",
      email: normalizeEmail(user.email) || checkedEmails[0] || "",
      status: "active",
      source: "owner_allowlist",
      checkedEmails,
      results: checkedEmails.map(email => ({
        email, plan: "owner", status: "active", source: "owner_allowlist" as const, ok: true,
      })),
    };
  }
  return resolveBestPlan(checkedEmails);
}

/** Plano usado pelos recursos do site (owner/admin contam como expert). */
export function featurePlan(plan: string) {
  const normalized = normalizePlanName(plan);
  if (normalized === "owner") return "expert";
  if (normalized === "member") return "pro";
  return normalized;
}
