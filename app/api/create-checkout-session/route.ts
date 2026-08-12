export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";

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
    const affiliateCode = String(
      body?.affiliateCode || ""
    )
      .trim()
      .toUpperCase();

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
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      (process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : "https://tubex.app.br");

    const metadata: Record<string, string> = {
      plan,
    };

    if (affiliateCode) {
      metadata.affiliate_code = affiliateCode;
    }

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

      line_items: [
        {
          price: PRICE_IDS[plan],
          quantity: 1,
        },
      ],

      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/#planos`,

      allow_promotion_codes: true,

      metadata,

      subscription_data: {
        metadata,
      },
    });

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
