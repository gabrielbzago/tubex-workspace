export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const FALLBACK_OWNER_EMAIL = "gabrielbzago@gmail.com";

async function getOwner(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) return null;

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !authData.user?.email) return null;

  const email = authData.user.email.trim().toLowerCase();

  const configuredOwners = String(
    process.env.OWNER_EMAILS ||
      process.env.NEXT_PUBLIC_OWNER_EMAIL ||
      FALLBACK_OWNER_EMAIL
  )
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (configuredOwners.includes(email)) {
    return authData.user;
  }

  const { data: row, error } = await supabaseAdmin
    .from("users")
    .select("id, email, plan")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("❌ OWNER LOOKUP ERROR:", error);
    return null;
  }

  const role = String(row?.plan || "").trim().toLowerCase();

  return role === "owner" || role === "admin"
    ? authData.user
    : null;
}

function money(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function monthKey(value: unknown) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "Sem data";

  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1
  ).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const owner = await getOwner(request);

  if (!owner) {
    return NextResponse.json(
      { error: "Acesso restrito ao Owner." },
      { status: 403 }
    );
  }

  const [users, sales, referrals, payouts] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select(
        "id, name, email, affiliate_code, pix_key, affiliate_balance, affiliate_paid"
      )
      .not("affiliate_code", "is", null),

    supabaseAdmin
      .from("affiliate_sales")
      .select(
        "id, affiliate_code, customer_email, customer_name, plan, amount, commission, commission_amount, stripe_invoice_id, stripe_subscription_id, last_payment_date, created_at, status"
      )
      .order("last_payment_date", { ascending: false }),

    supabaseAdmin
      .from("affiliate_referrals")
      .select(
        "id, affiliate_code, referred_email, referred_name, plan, status, stripe_subscription_id, updated_at, created_at"
      )
      .order("updated_at", { ascending: false }),

    supabaseAdmin
      .from("affiliate_payouts")
      .select(
        "id, affiliate_code, amount, status, created_at"
      )
      .order("created_at", { ascending: false }),
  ]);

  const firstError =
    users.error || sales.error || referrals.error || payouts.error;

  if (firstError) {
    console.error("❌ ADMIN AFFILIATE QUERY ERROR:", firstError);

    return NextResponse.json(
      { error: firstError.message },
      { status: 500 }
    );
  }

  const affiliates = users.data || [];
  const saleRows = sales.data || [];
  const referralRows = referrals.data || [];
  const payoutRows = payouts.data || [];

  const pendingCommission = affiliates.reduce(
    (sum: number, item: any) => sum + money(item.affiliate_balance),
    0
  );

  const paidCommission = affiliates.reduce(
    (sum: number, item: any) => sum + money(item.affiliate_paid),
    0
  );

  const totalRevenue = saleRows.reduce(
    (sum: number, item: any) => sum + money(item.amount),
    0
  );

  const totalCommissionGenerated = saleRows.reduce(
    (sum: number, item: any) => sum + money(item.commission_amount ?? item.commission),
    0
  );

  const activeReferrals = referralRows.filter(
    (item: any) => String(item.status).toLowerCase() === "active"
  ).length;

  const canceledReferrals = referralRows.filter(
    (item: any) => String(item.status).toLowerCase() === "canceled"
  ).length;

  const failedSales = saleRows.filter(
    (item: any) => String(item.status).toLowerCase() === "failed"
  ).length;

  const chargebacks = saleRows.filter(
    (item: any) => String(item.status).toLowerCase() === "chargeback"
  ).length;

  // Resumo mensal real baseado nas competências de affiliate_sales.
  const monthlyMap = new Map<
    string,
    {
      month: string;
      sales: number;
      revenue: number;
      commission: number;
      pending: number;
      failed: number;
      chargebacks: number;
      canceled: number;
    }
  >();

  for (const sale of saleRows as any[]) {
    const key = monthKey(sale.last_payment_date || sale.created_at);

    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, {
        month: key,
        sales: 0,
        revenue: 0,
        commission: 0,
        pending: 0,
        failed: 0,
        chargebacks: 0,
        canceled: 0,
      });
    }

    const row = monthlyMap.get(key)!;
    const status = String(sale.status || "").toLowerCase();

    row.sales += 1;
    row.revenue += money(sale.amount);
    row.commission += money(sale.commission_amount ?? sale.commission);

    if (status === "pending") row.pending += money(sale.commission_amount);
    if (status === "failed") row.failed += 1;
    if (status === "chargeback") row.chargebacks += 1;
    if (status === "canceled") row.canceled += 1;
  }

  // Cancelamentos são eventos da referral, não vendas.
  for (const referral of referralRows as any[]) {
    if (String(referral.status || "").toLowerCase() !== "canceled") continue;

    const key = monthKey(referral.updated_at || referral.created_at);

    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, {
        month: key,
        sales: 0,
        revenue: 0,
        commission: 0,
        pending: 0,
        failed: 0,
        chargebacks: 0,
        canceled: 0,
      });
    }

    monthlyMap.get(key)!.canceled += 1;
  }

  const monthly = Array.from(monthlyMap.values()).sort((a, b) =>
    b.month.localeCompare(a.month)
  );

  return NextResponse.json({
    owner: {
      id: owner.id,
      email: owner.email,
    },

    summary: {
      affiliates: affiliates.length,
      activeReferrals,
      canceledReferrals,
      sales: saleRows.length,
      failedSales,
      chargebacks,
      revenue: money(totalRevenue),
      commissionGenerated: money(totalCommissionGenerated),
      pendingCommission: money(pendingCommission),
      paidCommission: money(paidCommission),
      payouts: payoutRows.length,
    },

    affiliates,
    sales: saleRows,
    referrals: referralRows,
    payouts: payoutRows,
    monthly,
  });
}

export async function POST(request: Request) {
  const owner = await getOwner(request);

  if (!owner) {
    return NextResponse.json(
      { error: "Acesso restrito ao Owner." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);

  if (body?.action !== "mark_paid" || !body?.affiliate_id) {
    return NextResponse.json(
      { error: "Ação inválida." },
      { status: 400 }
    );
  }

  const { data: affiliate, error: affiliateError } = await supabaseAdmin
    .from("users")
    .select(
      "id, email, affiliate_code, pix_key, affiliate_balance, affiliate_paid"
    )
    .eq("id", body.affiliate_id)
    .maybeSingle();

  if (affiliateError || !affiliate) {
    return NextResponse.json(
      {
        error:
          affiliateError?.message || "Afiliado não encontrado.",
      },
      { status: 404 }
    );
  }

  const amount = money(affiliate.affiliate_balance);

  if (amount <= 0) {
    return NextResponse.json(
      { error: "Não existe saldo pendente para este afiliado." },
      { status: 400 }
    );
  }

  const { data: paidAmount, error: payoutError } = await supabaseAdmin.rpc(
    "mark_affiliate_paid",
    { p_affiliate_id: String(affiliate.id) }
  );

  if (payoutError) {
    console.error("❌ PAYOUT TRANSACTION ERROR:", payoutError);
    return NextResponse.json(
      { error: payoutError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    amount: money(paidAmount),
  });
}
