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
      .select("id,email,name,plan,status,stripe_customer_id,stripe_subscription_id,referred_by")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (data) return data;
  }

  if (email) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id,email,name,plan,status,stripe_customer_id,stripe_subscription_id,referred_by")
      .eq("email", email)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId = String(subscription.customer || "").trim();
  const price = subscription.items.data[0]?.price;
  const priceId = String(price?.id || "");
  const amount = Number(price?.unit_amount || 0) / 100;
  const metadataPlan = String(subscription.metadata?.plan || price?.metadata?.plan || "");
  const lookupPlan = String((price as any)?.lookup_key || (price as any)?.nickname || "")
    .toLowerCase().match(/(start|pro|expert)/)?.[1] || "";
  const plan = inferPlan(amount, priceId, metadataPlan || lookupPlan || undefined);
  const status = subscription.status === "active" || subscription.status === "trialing"
    ? "active"
    : subscription.status === "past_due" || subscription.status === "unpaid"
      ? "past_due"
      : "inactive";

  let email = normalize(subscription.metadata?.email || "");
  if (!email && customerId) {
    try {
      const customer = await getStripe().customers.retrieve(customerId);
      if (!customer.deleted) email = normalize(customer.email || "");
    } catch (error) {
      console.warn("⚠️ CUSTOMER EMAIL LOOKUP FAILED:", customerId, error);
    }
  }
  const user = await findUser(customerId, email);
  const patch = {
    ...(email ? { email } : {}),
    ...(user?.name ? {} : email ? { name: email } : {}),
    plan: status === "active" ? plan : "free",
    status,
    stripe_customer_id: customerId || user?.stripe_customer_id || null,
    stripe_subscription_id: subscription.id,
    updated_at: new Date().toISOString(),
  };
  if (user) {
    const { error } = await supabaseAdmin.from("users").update(patch).eq("id", user.id);
    if (error) throw error;
  } else if (email) {
    const { error } = await supabaseAdmin.from("users").upsert(patch, { onConflict: "email" });
    if (error) throw error;
  } else {
    console.warn("⚠️ SUBSCRIPTION SEM E-MAIL PARA VINCULAR:", subscription.id);
  }
}

async function writeProductAnalytics(emailValue: string, eventName: string, module = "billing", properties: Record<string, unknown> = {}) {
  const email = String(emailValue || "").trim().toLowerCase();
  if (!email) return;
  try {
    const { data: user } = await supabaseAdmin.from("users").select("id").ilike("email", email).maybeSingle();
    await supabaseAdmin.from("tubex_events").insert({
      user_id: user?.id || null,
      install_id: `web-${email.replace(/[^a-z0-9]/g, "").slice(0,40) || "anonymous"}`,
      session_id: null,
      event_name: eventName,
      module,
      properties
    });
  } catch (error) {
    console.warn("[TubeX analytics] billing event not recorded", eventName, error);
  }
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

  let affiliateCode = normalizeCode(
    session.metadata?.affiliate_code || session.client_reference_id || ""
  );
  if (!affiliateCode && email) {
    const { data: referredUser, error: referredUserError } = await supabaseAdmin
      .from("users").select("referred_by").ilike("email", email).maybeSingle();
    if (referredUserError) throw referredUserError;
    affiliateCode = normalizeCode(referredUser?.referred_by || "");
  }
  if (affiliateCode) {
    const { data: affiliateCheck, error: affiliateCheckError } = await supabaseAdmin
      .from("users").select("email").eq("affiliate_code", affiliateCode).maybeSingle();
    if (affiliateCheckError) throw affiliateCheckError;
    if (!affiliateCheck || String(affiliateCheck.email || "").trim().toLowerCase() === email) {
      console.warn("⚠️ CÓDIGO INVÁLIDO OU AUTOINDICAÇÃO BLOQUEADA:", affiliateCode);
      affiliateCode = "";
    }
  }

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

  try {
    const { data: authUser } = await supabaseAdmin.from("users").select("id").ilike("email", email).maybeSingle();
    const { data: alreadyTracked } = await supabaseAdmin.from("tubex_events")
      .select("id").eq("event_name", "subscription_activated")
      .contains("properties", { stripe_session_id: session.id }).maybeSingle();
    if (!alreadyTracked) await writeProductAnalytics(email, "subscription_activated", "billing", { plan, source: "stripe_webhook", stripe_session_id: session.id });
  } catch (analyticsError) {
    console.warn("[TubeX analytics] subscription activation not recorded", analyticsError);
  }

  if (!affiliateCode || !subscriptionId) return;

  const { data: affiliate, error: affiliateLookupError } = await supabaseAdmin
    .from("users").select("id,email,affiliate_code").eq("affiliate_code", affiliateCode).maybeSingle();
  if (affiliateLookupError) throw affiliateLookupError;
  if (!affiliate) {
    console.warn("⚠️ AFILIADO NÃO ENCONTRADO NO CHECKOUT:", affiliateCode);
    return;
  }
  if (String(affiliate.email || "").trim().toLowerCase() === email) {
    console.warn("⚠️ AUTOINDICAÇÃO BLOQUEADA:", affiliateCode);
    return;
  }

  const { error } = await supabaseAdmin.from("affiliate_referrals").upsert({
    affiliate_code: affiliateCode,
    referred_email: email,
    referred_name: customerName,
    plan,
    commission: 0,
    stripe_customer_id: customerId || null,
    stripe_subscription_id: subscriptionId,
    status: "active",
    updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_subscription_id", ignoreDuplicates: true });
  if (error) throw error;
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = String(invoice.customer || "").trim();
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    console.warn("⚠️ invoice.paid sem subscription:", invoice.id);
    return;
  }

  const invoiceAny = invoice as any;
  // Commission is based on money actually collected. A zero amount_paid
  // (for example a 100% coupon or trial invoice) must never fall back to total.
  const rawAmountPaid = invoiceAny.amount_paid !== null && invoiceAny.amount_paid !== undefined
    ? Number(invoiceAny.amount_paid)
    : Number(invoiceAny.total ?? invoiceAny.subtotal ?? 0);

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
      .select("id,email,name,plan,status,stripe_customer_id,stripe_subscription_id,referred_by")
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
    metadata.affiliate_code || referral?.affiliate_code || user.referred_by || ""
  );

  const invoicePrice = subscription.items.data[0]?.price;
  const invoicePricePlan = String(invoicePrice?.metadata?.plan || (invoicePrice as any)?.lookup_key || (invoicePrice as any)?.nickname || "")
    .toLowerCase().match(/(start|pro|expert)/)?.[1];
  const userPlan = inferPlan(amount, priceId, invoicePricePlan || metadata.plan || referral?.plan || user.plan);

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
  if (String(affiliate.email || "").trim().toLowerCase() === String(user.email || email).trim().toLowerCase()) {
    console.warn("⚠️ COMISSÃO DE AUTOINDICAÇÃO BLOQUEADA:", affiliateCode, invoice.id);
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
  const paymentIntentValue = invoiceAny.payment_intent || invoiceAny.payments?.data?.[0]?.payment?.payment_intent || "";
  const paymentIntent = typeof paymentIntentValue === "string"
    ? paymentIntentValue
    : String(paymentIntentValue?.id || "");

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

async function recordAnalyticsEvent(
  userId: string,
  eventName: string,
  module = "billing",
  properties: Record<string, unknown> = {},
  installId = `web-${userId}`
) {
  if (!userId) return;
  try {
    const { error } = await supabaseAdmin.from("tubex_events").insert({
      user_id: userId,
      install_id: installId,
      session_id: null,
      event_name: eventName,
      module,
      properties,
    });
    if (error) console.warn("[TubeX analytics] event not recorded", eventName, error);
  } catch (error) {
    // Analytics must never cause Stripe webhook delivery to fail.
    console.warn("[TubeX analytics] event not recorded", eventName, error);
  }
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;
  const now = new Date().toISOString();

  const { error: referralError } = await supabaseAdmin
    .from("affiliate_referrals")
    .update({ status: "canceled", updated_at: now })
    .eq("stripe_subscription_id", subscriptionId);

  if (referralError) throw referralError;

  const { data: canceledUser } = await supabaseAdmin
    .from("users").select("id,plan").eq("stripe_subscription_id",subscriptionId).maybeSingle();
  const { error: userError } = await supabaseAdmin
    .from("users")
    .update({
      plan: "free",
      status: "inactive",
      updated_at: now,
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (userError) throw userError;
  if (canceledUser?.id) await recordAnalyticsEvent(canceledUser.id,"subscription_cancelled","billing",{
    plan: canceledUser.plan || "unknown",
    reason: subscription.cancellation_details?.reason || "not_provided",
    feedback: subscription.cancellation_details?.feedback || "not_provided",
    comment: String(subscription.cancellation_details?.comment || "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 240),
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const invoiceId = invoice.id;
  const customerId = String(invoice.customer || "").trim();

  const { error: saleError } = await supabaseAdmin
    .from("affiliate_sales")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("stripe_invoice_id", invoiceId);
  if (saleError) throw saleError;

  if (customerId) {
    const { error: userError } = await supabaseAdmin
      .from("users").update({ status: "past_due", updated_at: new Date().toISOString() })
      .eq("stripe_customer_id", customerId);
    if (userError) throw userError;
    const { error: referralError } = await supabaseAdmin
      .from("affiliate_referrals").update({ status: "past_due", updated_at: new Date().toISOString() })
      .eq("stripe_customer_id", customerId);
    if (referralError) throw referralError;
  }
}

async function reverseCommission(paymentIntentValue: unknown, reason: string, eventId: string) {
  const paymentIntent = typeof paymentIntentValue === "string"
    ? paymentIntentValue
    : String((paymentIntentValue as any)?.id || "");
  if (!paymentIntent) return;
  const { data, error } = await supabaseAdmin.rpc("reverse_affiliate_sale", {
    p_payment_intent: paymentIntent,
    p_reason: reason,
    p_stripe_event_id: eventId,
  });
  if (error) throw error;
  console.log(data ? "✅ COMISSÃO ESTORNADA:" : "ℹ️ ESTORNO JÁ PROCESSADO OU VENDA NÃO LOCALIZADA:", paymentIntent, reason);
}

async function handleChargeback(dispute: Stripe.Dispute, eventId: string) {
  await reverseCommission((dispute as any).payment_intent, "chargeback", eventId);
}

async function handleDisputeClosed(dispute: Stripe.Dispute, eventId: string) {
  if (String(dispute.status || "").toLowerCase() !== "won") return;
  const paymentIntentValue = (dispute as any).payment_intent;
  const paymentIntent = typeof paymentIntentValue === "string" ? paymentIntentValue : String(paymentIntentValue?.id || "");
  if (!paymentIntent) return;
  const { data, error } = await supabaseAdmin.rpc("restore_affiliate_sale", {
    p_payment_intent: paymentIntent,
    p_stripe_event_id: eventId,
  });
  if (error) throw error;
  console.log(data ? "✅ COMISSÃO RESTAURADA APÓS DISPUTA GANHA:" : "ℹ️ DISPUTA SEM COMISSÃO A RESTAURAR:", paymentIntent);
}

async function handleRefund(refund: Stripe.Refund, eventId: string) {
  const paymentIntent = (refund as any).payment_intent;
  const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : String(paymentIntent?.id || "");
  if (!paymentIntentId || Number(refund.amount || 0) <= 0) return;
  const { data, error } = await supabaseAdmin.rpc("reverse_affiliate_refund", {
    p_payment_intent: paymentIntentId,
    p_refund_amount: Number(refund.amount) / 100,
    p_stripe_event_id: eventId,
  });
  if (error) throw error;
  console.log(data ? "✅ REEMBOLSO DE COMISSÃO REGISTRADO:" : "ℹ️ REEMBOLSO JÁ PROCESSADO OU VENDA NÃO LOCALIZADA:", refund.id);
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
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case "charge.dispute.created":
      case "charge.dispute.funds_withdrawn":
        await handleChargeback(event.data.object as Stripe.Dispute, event.id);
        break;
      case "charge.dispute.closed":
        await handleDisputeClosed(event.data.object as Stripe.Dispute, event.id);
        break;
      case "refund.created":
        await handleRefund(event.data.object as Stripe.Refund, event.id);
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
