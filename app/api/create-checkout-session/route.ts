export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY não configurada.");
  return new Stripe(key);
}

/*
 * IDs existentes na sua API atual.
 * Não alteramos nem inventamos Price IDs.
 *
 * START continua reconhecido apenas para compatibilidade com
 * clientes/fluxos antigos. O novo checkout público deve usar
 * Pro ou Expert.
 */
const PRICE_IDS: Record<string, string> = {
  start: "price_1RpubqAQLcT2SPxrl88SGiAE",
  pro: "price_1RpucTAQLcT2SPxrSfUnRPUa",
  expert: "price_1RpudHAQLcT2SPxrJHIJsRHh",
};

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const plan = String(body?.plan || "").trim().toLowerCase();
    const email = normalizeEmail(body?.email);
    let affiliateCode = String(body?.affiliateCode || body?.affiliate_code || "")
      .trim().toUpperCase();

    if (!plan) {
      return NextResponse.json(
        { error: "Plano não enviado." },
        { status: 400 }
      );
    }

    /*
     * Member não é mais um plano do TubeX.
     * O novo produto possui Free/Pro/Expert.
     */
    if (plan === "member") {
      return NextResponse.json(
        { error: "O plano Member foi descontinuado." },
        { status: 400 }
      );
    }

    if (!PRICE_IDS[plan]) {
      return NextResponse.json(
        { error: "Plano inválido." },
        { status: 400 }
      );
    }

    /*
     * Os links anuais continuam sendo os Payment Links Stripe já
     * existentes na landing. Este endpoint continua responsável
     * pelos checkouts de assinatura que usam os Price IDs da API atual.
     */
    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL ||
      (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://www.tubexai.com.br");
    let appUrl = configuredAppUrl;
    try {
      const parsedAppUrl = new URL(configuredAppUrl);
      if (["tubex.app.br", "tubexai.com.br"].includes(parsedAppUrl.hostname)) parsedAppUrl.hostname = "www.tubexai.com.br";
      appUrl = parsedAppUrl.origin;
    } catch { appUrl = "https://www.tubexai.com.br"; }

    // If a returning customer starts checkout from the extension/dashboard,
    // recover the first-touch attribution stored on their TubeX profile.
    if (!affiliateCode && email) {
      const { data: referredUser, error: referredUserError } = await supabaseAdmin
        .from("users").select("referred_by").ilike("email", email).maybeSingle();
      if (referredUserError) throw referredUserError;
      affiliateCode = String(referredUser?.referred_by || "").trim().toUpperCase();
    }

    // Never trust a referral code supplied by the browser without resolving it.
    if (affiliateCode) {
      if (!/^[A-Z0-9_-]{4,40}$/.test(affiliateCode)) affiliateCode = "";
      else {
        const { data: affiliate, error: affiliateError } = await supabaseAdmin
          .from("users").select("id,email").eq("affiliate_code", affiliateCode).maybeSingle();
        if (affiliateError) throw affiliateError;
        if (!affiliate || (email && String(affiliate.email || "").toLowerCase() === email)) affiliateCode = "";
      }
    }

    const metadata: Record<string, string> = { plan };
    if (affiliateCode) metadata.affiliate_code = affiliateCode;

    if (email) {
      metadata.email = email;
    }

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",

      phone_number_collection: {
        enabled: true,
      },

      billing_address_collection: "required",

      custom_fields: [
        {
          key: "nome",
          label: {
            type: "custom",
            custom: "Nome completo",
          },
          type: "text",
        },
      ],

      ...(email
        ? {
            customer_email: email,
          }
        : {}),

      ...(affiliateCode ? { client_reference_id: affiliateCode } : {}),
      line_items: [
        { price: PRICE_IDS[plan], quantity: 1 },
      ],

      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/#planos`,

      allow_promotion_codes: true,

      metadata,

      subscription_data: {
        metadata,
      },
    });

    // Record checkout creation only after Stripe successfully creates the session.
    try {
      if (email) {
        const { data: user } = await supabaseAdmin.from("users").select("id").ilike("email", email).maybeSingle();
        await supabaseAdmin.from("tubex_events").insert({
          user_id: user?.id || null,
          install_id: `web-${email.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0,40) || "anonymous"}`,
          session_id: null,
          event_name: "checkout_started",
          module: "billing",
          properties: { plan, source: "web_checkout", stripe_session_id: session.id }
        });
      }
    } catch (analyticsError) {
      console.warn("[TubeX analytics] checkout event not recorded", analyticsError);
    }

    return NextResponse.json({
      url: session.url,
    });
  } catch (error: any) {
    console.error("🔥 STRIPE CHECKOUT ERROR:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Erro interno ao criar checkout.",
      },
      { status: 500 }
    );
  }
}
