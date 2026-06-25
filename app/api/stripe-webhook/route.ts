import Stripe from "stripe";

import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";


const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!
);


const PRICE_PLAN_MAP: Record<string, string> = {
  "price_1RpubqAQLcT2SPxrl88SGiAE": "start",
  "price_1RpucTAQLcT2SPxrSfUnRPUa": "pro",
  "price_1RpudHAQLcT2SPxrJHIJsRHh": "expert",
};

export async function POST(
  req: Request
) {

  try {

    console.log(
      "🔥 WEBHOOK RECEBIDO"
    );

    // =====================================================
    // RAW BODY
    // =====================================================

    const body =
      await req.text();

    const signature =
      req.headers.get(
        "stripe-signature"
      );

    if (!signature) {

      console.log(
        "❌ SEM ASSINATURA"
      );

      return NextResponse.json(
        {
          error:
            "Sem assinatura Stripe",
        },
        {
          status: 400,
        }
      );

    }

    // =====================================================
    // EVENT
    // =====================================================

    const webhookSecret =
      process.env
        .STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {

      console.error(
        "❌ STRIPE_WEBHOOK_SECRET AUSENTE"
      );

      return NextResponse.json(
        {
          error:
            "Webhook secret missing",
        },
        {
          status: 500,
        }
      );

    }

    let event: Stripe.Event;

    try {

      event =
        stripe.webhooks.constructEvent(

          body,

          signature,

          webhookSecret

        );

    } catch (err) {

      console.error(
        "❌ WEBHOOK SIGNATURE ERROR:"
      );

      console.error(err);

      return NextResponse.json(
        {
          error:
            "Invalid webhook signature",
        },
        {
          status: 400,
        }
      );

    }

    console.log(
      "✅ EVENTO:",
      event.type
    );

    // =====================================================
    // CHECKOUT COMPLETED
    // =====================================================

    if (
      event.type ===
      "checkout.session.completed"
    ) {

      const session =
        event.data.object as Stripe.Checkout.Session;

      const affiliateCode =
        String(
          session.metadata
            ?.affiliate_code || ""
        )
          .trim()
          .toUpperCase();

      const email =

        session.customer_details
          ?.email ||

        session.customer_email ||

        session.metadata
          ?.email ||

        "";

      const normalizedEmail =
        String(email || "")
          .trim()
          .toLowerCase();

      const plan =

        session.metadata
          ?.plan ||

        "start";

      const stripeCustomerId =

        session.customer
          ?.toString() ||

        "";

      const stripeSubscriptionId =

        session.subscription
          ?.toString() ||

        "";

      console.log(
        "📦 CHECKOUT:",
        {

          affiliateCode,

          email,

          plan,

          stripeCustomerId,

          stripeSubscriptionId,

        }
      );

      const customerName =

        session.customer_details
          ?.name ||

        session.custom_fields?.find(
          (f: any) =>
            f.key === "nome"
        )?.text?.value ||

        normalizedEmail;

      console.log(
        "👤 CUSTOMER:",
        customerName
      );

      if (!normalizedEmail) {

        console.error(
          "❌ EMAIL INVÁLIDO NO CHECKOUT"
        );

        return NextResponse.json({
          received: true,
        });

      }

      const payload = {

        email:
          normalizedEmail,

        name:
          customerName ||
          normalizedEmail,

        plan:
          plan || "start",

        status:
          "active",

        stripe_customer_id:
          stripeCustomerId || null,

        stripe_subscription_id:
          stripeSubscriptionId || null,

        updated_at:
          new Date().toISOString(),

      };

      console.log(
        "📦 USER PAYLOAD:",
        payload
      );

      const {
        data: savedUser,
        error: userError,
      } = await supabaseAdmin
        .from("users")
        .upsert(
          payload,
          {
            onConflict:
              "email",
          }
        )
        .select()
        .maybeSingle();

      if (userError) {

        console.error(
          "❌ USER UPSERT ERROR:",
          userError
        );

        return NextResponse.json({
          received: true,
        });

      }

      console.log(
        "✅ USER SALVO:",
        savedUser?.email
      );

      if (
        affiliateCode &&
        stripeSubscriptionId
      ) {

        const {
          error:
            referralError,
        } =
          await supabaseAdmin
            .from(
              "affiliate_referrals"
            )
            .upsert(
              {

                affiliate_code:
                  affiliateCode,

                referred_email:
                  normalizedEmail,

                referred_name:
                  customerName,

                plan,

                stripe_customer_id:
                  stripeCustomerId,

                stripe_subscription_id:
                  stripeSubscriptionId,

                status:
                  "active",

                updated_at:
                  new Date().toISOString(),

              },
              {
                onConflict:
                  "stripe_subscription_id",
              }
            );

        if (
          referralError
        ) {

          console.error(
            "❌ REFERRAL ERROR:",
            referralError
          );

        } else {

          console.log(
            "✅ REFERRAL SALVO"
          );

        }

      } else {

        console.log(
          "⚠️ SEM AFFILIATE CODE OU SUB ID"
        );

      }

    }

    // =====================================================
    // INVOICE PAID
    // =====================================================

    if (
      event.type ===
      "invoice.paid"
    ) {

      const invoice =
        event.data.object as Stripe.Invoice;

      console.log(
        "🔥 ENTROU invoice.paid"
      );

      console.log(
        "💰 INVOICE PAGA:",
        invoice.id
      );

      const stripeCustomerId =
        String(
          invoice.customer || ""
        );

      
const subscriptionId =

  String(

    invoice.parent
      ?.subscription_details
      ?.subscription ||

    invoice.lines?.data?.[0]
      ?.parent
      ?.subscription_item_details
      ?.subscription ||

    invoice.subscription ||

    ""

  );

const amount =
  Number(
    (
      invoice.amount_paid || 0
    ) / 100
  );

console.log(
  "📦 SUBSCRIPTION ID:",
  subscriptionId
);

if (!subscriptionId) {

  console.log(
    "❌ SEM SUBSCRIPTION ID"
  );

  console.log(
    "📦 INVOICE:",
    invoice
  );

  return NextResponse.json({
    received: true,
  });

}


      // =====================================================
      // IDENTIFICA PLANO
      // =====================================================

      const line =
        invoice.lines?.data?.find(
          (l: any) =>
            l.price?.type === "recurring"
        ) ||
        invoice.lines?.data?.[0];

      if (!line) {

        console.error(
          "❌ INVOICE SEM LINE ITEMS"
        );

        return NextResponse.json({
          received: true,
        });

      }

      const stripePriceId =
        String(
          line.price?.id || ""
        ).trim();

      console.log(
        "💳 PRICE ID:",
        stripePriceId
      );

      const userPlan =
        PRICE_PLAN_MAP[
          stripePriceId
        ] || "start";

      console.log(
        "📦 PLANO:",
        userPlan
      );

      // =====================================================
      // BUSCA USER
      // =====================================================

      let {
        data: existingUser,
        error: userError,
      } =
        await supabaseAdmin
          .from("users")
          .select(`
            id,
            email,
            name,
            plan,
            status,
            stripe_customer_id,
            stripe_subscription_id
          `)
          .eq(
            "stripe_customer_id",
            stripeCustomerId
          )
          .maybeSingle();

      if (userError) {

        console.error(
          "❌ USER ERROR:",
          userError
        );

      }

      // =====================================================
      // FALLBACK EMAIL
      // =====================================================

      if (!existingUser) {

        const fallbackEmail =

          invoice.customer_email ||

          invoice.lines?.data?.[0]
            ?.metadata?.email ||

          "";

        if (fallbackEmail) {

          const {
            data: fallbackUser,
          } =
            await supabaseAdmin
              .from("users")
              .select(`
                id,
                email,
                name,
                stripe_customer_id
              `)
              .eq(
                "email",
                String(fallbackEmail)
                  .trim()
                  .toLowerCase()
              )
              .maybeSingle();

          if (fallbackUser) {

            existingUser =
              fallbackUser;

            await supabaseAdmin
              .from("users")
              .update({

                stripe_customer_id:
                  stripeCustomerId,

                updated_at:
                  new Date()
                    .toISOString(),

              })
              .eq(
                "id",
                fallbackUser.id
              );

          }

        }

      }

      if (!existingUser) {

        console.error(
          "❌ USER NÃO ENCONTRADO FINAL"
        );

        return NextResponse.json({
          received: true,
        });

      }

      // =====================================================
      // UPDATE USER
      // =====================================================

      const updatePayload = {

        name:

          existingUser.name ||

          existingUser.email ||

          "Cliente",

        plan:
          userPlan,

        status:
          "active",

        stripe_customer_id:
          stripeCustomerId ||

          existingUser.stripe_customer_id ||

          null,

        stripe_subscription_id:
          subscriptionId ||

          existingUser.stripe_subscription_id ||

          null,

        updated_at:
          new Date()
            .toISOString(),

      };

      const {
        error: updateUserError,
      } =
        await supabaseAdmin
          .from("users")
          .update(
            updatePayload
          )
          .eq(
            "id",
            existingUser.id
          );

      if (
        updateUserError
      ) {

        console.error(
          "❌ UPDATE USER ERROR:",
          updateUserError
        );

      }

      // =====================================================
      // BUSCA SUBSCRIPTION
      // =====================================================

      const subscription =
        await stripe.subscriptions.retrieve(
          subscriptionId
        );

      const {
        data: referral,
      } = await supabaseAdmin
        .from("affiliate_referrals")
        .select("*")
        .eq(
          "stripe_subscription_id",
          subscriptionId
        )
        .maybeSingle();

      const affiliateCode = String(

        subscription.metadata
          ?.affiliate_code ||

        referral
          ?.affiliate_code ||

        ""

      )
        .trim()
        .toUpperCase();

      console.log(
        "🎯 AFFILIATE:",
        affiliateCode
      );

      if (!affiliateCode) {

        return NextResponse.json({
          received: true,
        });

      }

      const safeAmount =
        Number(amount || 0);

      const safeCommission =
        Number(
          (
            safeAmount * 0.2
          ).toFixed(2)
        );

      // =====================================================
      // REFERRAL PAYLOAD
      // =====================================================

      const referralPayload = {

        affiliate_code:
          affiliateCode,

        referred_email:
          existingUser.email,

        referred_name:

          existingUser.name ||

          existingUser.email ||

          "Cliente",

        plan:
          userPlan,

        commission:
          safeCommission,

        stripe_customer_id:
          stripeCustomerId,

        stripe_subscription_id:
          subscriptionId,

        status:
          "active",

        updated_at:
          new Date()
            .toISOString(),

      };

      const {
        error: referralError,
      } =
        await supabaseAdmin
          .from(
            "affiliate_referrals"
          )
          .upsert(
            referralPayload,
            {
              onConflict:
                "stripe_subscription_id",
            }
          );

      if (referralError) {

        console.error(
          "❌ REFERRAL ERROR:",
          referralError
        );

        return NextResponse.json({
          received: true,
        });

      }

      // =====================================================
      // EVITA DUPLICAÇÃO
      // =====================================================

      const {
        data: existingSale,
      } =
        await supabaseAdmin
          .from("affiliate_sales")
          .select(`
            id,
            stripe_invoice_id
          `)
          .eq(
            "stripe_invoice_id",
            invoice.id
          )
          .maybeSingle();

      if (existingSale) {

        console.log(
          "⚠️ VENDA JÁ EXISTE:",
          invoice.id
        );

        return NextResponse.json({
          received: true,
        });

      }

      // =====================================================
      // BUSCA AFILIADO
      // =====================================================

      const {
        data: existingAffiliate,
      } = await supabaseAdmin
        .from("users")
        .select(`
          id,
          email,
          affiliate_code,
          affiliate_balance
        `)
        .eq(
          "affiliate_code",
          affiliateCode
        )
        .maybeSingle();

      if (!existingAffiliate) {

        console.log(
          "❌ AFILIADO NÃO ENCONTRADO:",
          affiliateCode
        );

        return NextResponse.json({
          received: true,
        });

      }

      // =====================================================
      // SALE PAYLOAD
      // =====================================================

      const salePayload = {

        affiliate_code:
          affiliateCode,

        customer_email:
          existingUser.email,

        customer_name:
          existingUser.name ||
          existingUser.email,

        plan:
          userPlan,

        amount:
          safeAmount,

        commission:
          safeCommission,

        commission_amount:
          safeCommission,

        stripe_invoice_id:
          invoice.id,

        stripe_payment_intent:
          String(
            invoice.payment_intent || ""
          ),

        stripe_customer_id:
          stripeCustomerId,

        stripe_subscription_id:
          subscriptionId,

        last_payment_date:
          new Date()
            .toISOString(),

        status:
          "pending",

      };

      const {
        error: saleError,
      } =
        await supabaseAdmin
          .from("affiliate_sales")
          .insert(
            salePayload
          );

      if (saleError) {

        console.error(
          "❌ SALE ERROR:",
          saleError
        );

        return NextResponse.json({
          received: true,
        });

      }

      // =====================================================
      // ATUALIZA BALANCE
      // =====================================================

      const currentBalance =
        Number(
          existingAffiliate
            .affiliate_balance || 0
        );

      const newBalance =
        Number(
          (
            currentBalance +
            safeCommission
          ).toFixed(2)
        );

      const {
        error: updateBalanceError,
      } = await supabaseAdmin
        .from("users")
        .update({

          affiliate_balance:
            newBalance,

          updated_at:
            new Date()
              .toISOString(),

        })
        .eq(
          "id",
          existingAffiliate.id
        );

      if (updateBalanceError) {

        console.error(
          "❌ UPDATE BALANCE ERROR:",
          updateBalanceError
        );

      } else {

        console.log(
          "💰 NOVO SALDO:",
          newBalance
        );

      }

    }

    // =====================================================
    // SUB CANCELADA
    // =====================================================

    if (
      event.type ===
      "customer.subscription.deleted"
    ) {

      const subscription =
        event.data.object as Stripe.Subscription;

      console.log(
        "❌ ASSINATURA CANCELADA:",
        subscription.id
      );

      if (
        process.env.NODE_ENV ===
        "development"
      ) {

        console.log(
          "⚠️ CANCELAMENTO IGNORADO LOCAL"
        );

        return NextResponse.json({
          received: true,
        });

      }

      await supabaseAdmin
        .from("affiliate_referrals")
        .update({

          status:
            "canceled",

          updated_at:
            new Date()
              .toISOString(),

        })
        .eq(
          "stripe_subscription_id",
          subscription.id
        );

      const {
        data: canceledSale
      } = await supabaseAdmin
        .from("affiliate_sales")
        .select(`
          affiliate_code,
          commission_amount
        `)
        .eq(
          "stripe_subscription_id",
          subscription.id
        )
        .maybeSingle();

      if (canceledSale) {

        const {
          data: affiliateUser
        } = await supabaseAdmin
          .from("users")
          .select(`
            id,
            affiliate_balance
          `)
          .eq(
            "affiliate_code",
            canceledSale.affiliate_code
          )
          .maybeSingle();

        if (affiliateUser) {

          const newBalance =
            Math.max(
              0,
              Number(
                affiliateUser.affiliate_balance || 0
              ) -
              Number(
                canceledSale.commission_amount || 0
              )
            );

          await supabaseAdmin
            .from("affiliate_sales")
            .update({

              status:
                "canceled",

              commission:
                0,

              commission_amount:
                0,

              updated_at:
                new Date()
                  .toISOString(),

            })
            .eq(
              "stripe_subscription_id",
              subscription.id
            );

          await supabaseAdmin
            .from("users")
            .update({

              affiliate_balance:
                Number(
                  newBalance.toFixed(2)
                ),

            })
            .eq(
              "id",
              affiliateUser.id
            );

        }

      }

      await supabaseAdmin
        .from("users")
        .update({

          plan:
            "free",

          status:
            "inactive",

          updated_at:
            new Date()
              .toISOString(),

        })
        .eq(
          "stripe_subscription_id",
          subscription.id
        );

    }

    // =====================================================
    // PAYMENT FAILED
    // =====================================================

    if (
      event.type ===
      "invoice.payment_failed"
    ) {

      const invoice =
        event.data.object as Stripe.Invoice;

      console.log(
        "⚠️ PAGAMENTO FALHOU"
      );

      await supabaseAdmin
        .from(
          "affiliate_sales"
        )
        .update({

          status:
            "failed",

          updated_at:
            new Date()
              .toISOString(),

        })
        .eq(
          "stripe_invoice_id",
          invoice.id
        );

      await supabaseAdmin
        .from("users")
        .update({

          status:
            "past_due",

          updated_at:
            new Date()
              .toISOString(),

        })
        .eq(
          "stripe_customer_id",
          String(invoice.customer)
        );

      await supabaseAdmin
        .from("affiliate_referrals")
        .update({

          status:
            "past_due",

          updated_at:
            new Date()
              .toISOString(),

        })
        .eq(
          "stripe_customer_id",
          String(invoice.customer)
        );

    }

    // =====================================================
    // CHARGEBACK
    // =====================================================

    if (
      event.type ===
      "charge.dispute.created"
    ) {

      const dispute =
        event.data.object as Stripe.Dispute;

      const paymentIntent =
        String(
          dispute.payment_intent || ""
        );

      console.log(
        "🚨 CHARGEBACK:",
        paymentIntent
      );

      const {
        data: disputedSale,
        error: disputedSaleError,
      } = await supabaseAdmin
        .from("affiliate_sales")
        .select(`
          id,
          affiliate_code,
          commission,
          commission_amount,
          stripe_payment_intent
        `)
        .eq(
          "stripe_payment_intent",
          paymentIntent
        )
        .maybeSingle();

      if (disputedSaleError) {

        console.error(
          "❌ DISPUTED SALE ERROR:",
          disputedSaleError
        );

      }

      if (!disputedSale) {

        console.log(
          "⚠️ VENDA NÃO ENCONTRADA"
        );

        return NextResponse.json({
          received: true,
        });

      }

      const {
        data: affiliateUser,
      } = await supabaseAdmin
        .from("users")
        .select(`
          id,
          affiliate_balance
        `)
        .eq(
          "affiliate_code",
          disputedSale.affiliate_code
        )
        .maybeSingle();

      if (affiliateUser) {

        const currentBalance =
          Number(
            affiliateUser
              .affiliate_balance || 0
          );

        const commissionToRemove =
          Number(
            disputedSale
              .commission_amount || 0
          );

        const newBalance =
          Math.max(
            0,
            Number(
              (
                currentBalance -
                commissionToRemove
              ).toFixed(2)
            )
          );

        await supabaseAdmin
          .from("users")
          .update({

            affiliate_balance:
              newBalance,

            updated_at:
              new Date()
                .toISOString(),

          })
          .eq(
            "id",
            affiliateUser.id
          );

      }

      const {
        error: chargebackError,
      } = await supabaseAdmin
        .from("affiliate_sales")
        .update({

          status:
            "chargeback",

          commission:
            0,

          commission_amount:
            0,

          updated_at:
            new Date()
              .toISOString(),

        })
        .eq(
          "stripe_payment_intent",
          paymentIntent
        );

      if (chargebackError) {

        console.error(
          "❌ CHARGEBACK ERROR:",
          chargebackError
        );

      } else {

        console.log(
          "✅ CHARGEBACK PROCESSADO"
        );

      }

    }

    // =====================================================
    // SUCCESS
    // =====================================================

    return NextResponse.json({
      received: true,
    });

  } catch (error) {

    console.error(
      "🔥 WEBHOOK ERROR:"
    );

    console.error(error);

    return NextResponse.json(
      {
        error:
          "Webhook error",
      },
      {
        status: 400,
      }
    );

  }

}
