import Stripe from "stripe";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY não configurada.");
  return new Stripe(key);
}

const PRICE_PLAN_MAP: Record<string, string> = {
  "price_1RpubqAQLcT2SPxrl88SGiAE": "start", // legacy
  "price_1RpucTAQLcT2SPxrSfUnRPUa": "pro",
  "price_1RpudHAQLcT2SPxrJHIJsRHh": "expert",
};

const COMMISSION_RATE = 0.2;

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}
function normalizeCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}
function money(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const i = invoice as any;
  const candidates = [
    i.parent?.subscription_details?.subscription,
    i.lines?.data?.find((line: any) =>
      Boolean(line?.parent?.subscription_item_details?.subscription)
    )?.parent?.subscription_item_details?.subscription,
    i.subscription,
    i.lines?.data?.[0]?.subscription,
  ];

  return String(candidates.find((value) => value) || "").trim();
}

function getInvoicePriceId(invoice: Stripe.Invoice) {
  const line: any =
    invoice.lines?.data?.find((item: any) => item.price?.type === "recurring") ||
    invoice.lines?.data?.[0];

  return String(
    line?.price?.id || line?.pricing?.price_details?.price || ""
  ).trim();
}

function inferPlan(amount: number, priceId: string, metadataPlan?: string) {
  if (PRICE_PLAN_MAP[priceId]) return PRICE_PLAN_MAP[priceId];
  if (metadataPlan) return String(metadataPlan).toLowerCase();

  // Fallback only for the current TubeX annual/monthly prices.
  if (Math.abs(amount - 29.99) < 0.02 || Math.abs(amount - 299.9) < 0.05) return "pro";
  if (Math.abs(amount - 49.99) < 0.02 || Math.abs(amount - 499.9) < 0.05) return "expert";

  return "free";
}

async function findUser(customerId: string, email: string) {
  if (customerId) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id,email,name,plan,status,stripe_customer_id,stripe_subscription_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (data) return data;
  }

  if (email) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id,email,name,plan,status,stripe_customer_id,stripe_subscription_id")
      .eq("email", email)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const subscriptionId = String(session.subscription || "").trim();
  const customerId = String(session.customer || "").trim();
  const email = normalize(
    session.customer_details?.email ||
      session.customer_email ||
      session.metadata?.email ||
      ""
  );

  if (!email) {
    console.warn("⚠️ CHECKOUT SEM E-MAIL:", session.id);
    return;
  }

  const customerName =
    session.customer_details?.name ||
    session.custom_fields?.find((field: any) => field.key === "nome")?.text?.value ||
    email;

  const affiliateCode = normalizeCode(
    session.metadata?.affiliate_code ||
      session.client_reference_id ||
      ""
  );

  let plan = String(session.metadata?.plan || "free").toLowerCase();

  // Payment Links não carregam necessariamente metadata de plano.
  if (subscriptionId) {
    try {
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      const priceId = String(subscription.items.data[0]?.price?.id || "");
      const unitAmount = Number(subscription.items.data[0]?.price?.unit_amount || 0) / 100;
      plan = inferPlan(unitAmount, priceId, plan === "free" ? undefined : plan);

      if (affiliateCode) {
        await getStripe().subscriptions.update(subscriptionId, {
          metadata: {
            ...subscription.metadata,
            affiliate_code: affiliateCode,
            plan,
            email,
          },
        });
      }
    } catch (error) {
      console.error("❌ CHECKOUT SUBSCRIPTION UPDATE ERROR:", error);
    }
  }

  const { error: userError } = await supabaseAdmin
    .from("users")
    .upsert(
      {
        email,
        name: customerName,
        plan,
        status: "active",
        stripe_customer_id: customerId || null,
        stripe_subscription_id: subscriptionId || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );

  if (userError) {
    console.error("❌ CHECKOUT USER UPSERT ERROR:", userError);
    return;
  }

  if (!affiliateCode || !subscriptionId) return;

  const { data: existingReferral } = await supabaseAdmin
    .from("affiliate_referrals")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (existingReferral) return;

  const { data: affiliate } = await supabaseAdmin
    .from("users")
    .select("id,email,affiliate_code")
    .eq("affiliate_code", affiliateCode)
    .maybeSingle();

  if (!affiliate) {
    console.warn("⚠️ AFILIADO NÃO ENCONTRADO NO CHECKOUT:", affiliateCode);
    return;
  }

  const { error } = await supabaseAdmin.from("affiliate_referrals").insert({
    affiliate_code: affiliateCode,
    referred_email: email,
    referred_name: customerName,
    plan,
    commission: 0,
    stripe_customer_id: customerId || null,
    stripe_subscription_id: subscriptionId,
    status: "active",
    updated_at: new Date().toISOString(),
  });

  if (error) console.error("❌ CHECKOUT REFERRAL ERROR:", error);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = String(invoice.customer || "").trim();
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    console.warn("⚠️ invoice.paid sem subscription:", invoice.id);
    return;
  }

  const invoiceAny = invoice as any;
  const rawAmountPaid =
    Number(invoiceAny.amount_paid ?? 0) ||
    Number(invoiceAny.total ?? 0) ||
    Number(invoiceAny.subtotal ?? 0);

  const amount = money(rawAmountPaid / 100);
  const priceId = getInvoicePriceId(invoice);

  let subscription: Stripe.Subscription;
  try {
    subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.error("❌ SUBSCRIPTION RETRIEVE ERROR:", error);
    throw error;
  }

  const metadata = (subscription.metadata || {}) as Record<string, string>;
  const email = normalize(
    invoiceAny.customer_email ||
      invoiceAny.customer_details?.email ||
      metadata.email ||
      ""
  );

  let user: any = await findUser(customerId, email);

  if (!user && email) {
    const plan = inferPlan(amount, priceId, metadata.plan);
    const { data, error } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          email,
          name: invoiceAny.customer_details?.name || email,
          plan,
          status: "active",
          stripe_customer_id: customerId || null,
          stripe_subscription_id: subscriptionId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      )
      .select("id,email,name,plan,status,stripe_customer_id,stripe_subscription_id")
      .single();

    if (error) throw error;
    user = data;
  }

  if (!user) {
    console.error("❌ USUÁRIO NÃO ENCONTRADO:", { invoice: invoice.id, email });
    return;
  }

  const { data: referral, error: referralLookupError } = await supabaseAdmin
    .from("affiliate_referrals")
    .select("*")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (referralLookupError) throw referralLookupError;

  const affiliateCode = normalizeCode(
    metadata.affiliate_code || referral?.affiliate_code || ""
  );

  const userPlan = inferPlan(amount, priceId, metadata.plan || referral?.plan || user.plan);

  await supabaseAdmin
    .from("users")
    .update({
      plan: userPlan,
      status: "active",
      stripe_customer_id: customerId || user.stripe_customer_id || null,
      stripe_subscription_id: subscriptionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (!affiliateCode) return;

  // A successful recurring payment reactivates a referral that may have
  // previously entered past_due after a failed invoice.
  await supabaseAdmin
    .from("affiliate_referrals")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscriptionId)
    .neq("status", "canceled");

  const { data: affiliate, error: affiliateError } = await supabaseAdmin
    .from("users")
    .select("id,email,affiliate_code,affiliate_balance")
    .eq("affiliate_code", affiliateCode)
    .maybeSingle();

  if (affiliateError) throw affiliateError;
  if (!affiliate) {
    console.warn("⚠️ AFILIADO NÃO ENCONTRADO:", affiliateCode);
    return;
  }

  // The database function performs the invoice-level idempotency check,
  // inserts the commission and increments the affiliate balance in one
  // PostgreSQL transaction. This is important when Stripe retries or when
  // two billing events arrive close together.
  if (amount <= 0) {
    console.log("ℹ️ INVOICE SEM VALOR DE COBRANÇA:", invoice.id);
    return;
  }

  const commission = money(amount * COMMISSION_RATE);
  const paymentIntent = String(
    invoiceAny.payment_intent ||
      invoiceAny.payments?.data?.[0]?.payment?.payment_intent ||
      ""
  );

  const { data: recorded, error: recordError } = await supabaseAdmin.rpc(
    "record_affiliate_sale",
    {
      p_affiliate_code: affiliateCode,
      p_customer_email: user.email,
      p_customer_name: user.name || user.email || "Cliente",
      p_plan: userPlan,
      p_amount: amount,
      p_commission: commission,
      p_invoice_id: invoice.id,
      p_payment_intent: paymentIntent,
      p_customer_id: customerId,
      p_subscription_id: subscriptionId,
      p_payment_date: new Date().toISOString(),
    }
  );

  if (recordError) {
    console.error("❌ AFFILIATE SALE TRANSACTION ERROR:", recordError);
    throw recordError;
  }

  if (!recorded) {
    console.log("ℹ️ INVOICE JÁ PROCESSADA:", invoice.id);
    return;
  }

  console.log("✅ COMISSÃO REGISTRADA:", {
    invoice: invoice.id,
    affiliate: affiliateCode,
    amount,
    commission,
  });
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;
  const now = new Date().toISOString();

  const { error: referralError } = await supabaseAdmin
    .from("affiliate_referrals")
    .update({ status: "canceled", updated_at: now })
    .eq("stripe_subscription_id", subscriptionId);

  if (referralError) throw referralError;

  const { error: userError } = await supabaseAdmin
    .from("users")
    .update({
      plan: "free",
      status: "inactive",
      updated_at: now,
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (userError) throw userError;
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const invoiceId = invoice.id;
  const customerId = String(invoice.customer || "").trim();

  await supabaseAdmin
    .from("affiliate_sales")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("stripe_invoice_id", invoiceId);

  if (customerId) {
    await supabaseAdmin
      .from("users")
      .update({ status: "past_due", updated_at: new Date().toISOString() })
      .eq("stripe_customer_id", customerId);

    await supabaseAdmin
      .from("affiliate_referrals")
      .update({ status: "past_due", updated_at: new Date().toISOString() })
      .eq("stripe_customer_id", customerId);
  }
}

async function handleChargeback(dispute: Stripe.Dispute) {
  const paymentIntent = String((dispute as any).payment_intent || "").trim();
  if (!paymentIntent) return;

  const { data: sale, error: saleError } = await supabaseAdmin
    .from("affiliate_sales")
    .select("id,affiliate_code,commission_amount,status")
    .eq("stripe_payment_intent", paymentIntent)
    .maybeSingle();

  if (saleError) throw saleError;
  if (!sale) return;

  if (String(sale.status).toLowerCase() === "chargeback") return;

  const commission = money(sale.commission_amount);

  if (commission > 0) {
    const { data: affiliate } = await supabaseAdmin
      .from("users")
      .select("id,affiliate_balance")
      .eq("affiliate_code", sale.affiliate_code)
      .maybeSingle();

    if (affiliate) {
      const newBalance = money(
        Math.max(0, Number(affiliate.affiliate_balance || 0) - commission)
      );

      await supabaseAdmin
        .from("users")
        .update({
          affiliate_balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", affiliate.id);
    }
  }

  // Preserve the original commission amount for financial history.
  await supabaseAdmin
    .from("affiliate_sales")
    .update({
      status: "chargeback",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sale.id);
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature) {
      return NextResponse.json({ error: "Sem assinatura Stripe" }, { status: 400 });
    }
    if (!webhookSecret) {
      console.error("❌ STRIPE_WEBHOOK_SECRET AUSENTE");
      return NextResponse.json({ error: "Webhook secret missing" }, { status: 500 });
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error("❌ WEBHOOK SIGNATURE ERROR:", error);
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      // Both event names are handled; DB idempotency prevents double commission.
      case "invoice.paid":
      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;
      case "charge.dispute.created":
        await handleChargeback(event.data.object as Stripe.Dispute);
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("🔥 WEBHOOK ERROR:", error);
    // Return non-2xx so Stripe retries transient processing failures.
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
