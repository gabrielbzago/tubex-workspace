import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tubex-backend";
import { resolveAccountPlan } from "@/lib/tubex-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Plano efetivo da conta logada no site, com a mesma regra da extensão:
// todos os e-mails da pessoa são consultados e o melhor plano vence.
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const resolved = await resolveAccountPlan(user);
  return NextResponse.json({
    plan: resolved.plan,
    status: resolved.status,
    // E-mail onde a assinatura foi encontrada (pode ser diferente do e-mail do login).
    planEmail: resolved.email || null,
    source: resolved.source,
    checkedEmails: resolved.checkedEmails.length,
  }, { headers: { "Cache-Control": "no-store" } });
}
