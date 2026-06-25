import { NextResponse } from "next/server";

import Stripe from "stripe";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!
);

export async function POST(
  req: Request
) {

  try {

    // BODY
    const body =
      await req.json();

    const {
      plan,
      email,
      affiliateCode,
    } = body;

    console.log(
      "📦 BODY:",
      body
    );

    // VALIDAÇÃO
    if (!plan) {

      return NextResponse.json(
        {
          error:
            "Plano não enviado",
        },
        {
          status: 400,
        }
      );

    }

    // PRICE IDS
    let priceId = "";

    // START
    if (plan === "start") {

      priceId =
        "price_1RpubqAQLcT2SPxrl88SGiAE";

    }

    // PRO
    else if (
      plan === "pro"
    ) {

      priceId =
        "price_1RpucTAQLcT2SPxrSfUnRPUa";

    }

    // EXPERT
    else if (
      plan === "expert"
    ) {

      priceId =
        "price_1RpudHAQLcT2SPxrJHIJsRHh";

    }

    // MEMBER NÃO USA STRIPE
    else if (
      plan === "member"
    ) {

      return NextResponse.json({

        url:
          "https://www.youtube.com/channel/UCjqKi0RrxQCxmoQ8FzDWq5w/join",

      });

    }

    // PLANO INVÁLIDO
    else {

      return NextResponse.json(
        {
          error:
            "Plano inválido",
        },
        {
          status: 400,
        }
      );

    }

    console.log(
      "💳 PRICE:",
      priceId
    );
// CHECKOUT STRIPE
const session =
  await stripe.checkout.sessions.create({

    mode:
      "subscription",

      phone_number_collection: {
      enabled: true,
    },

    billing_address_collection:
      "required",

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

    // EMAIL OPCIONAL
    ...(email
      ? {
          customer_email:
            email,
        }
      : {}),

    line_items: [
      {
        price:
          priceId,

        quantity: 1,
      },
    ],

    success_url:
      "http://localhost:3000/success",

    cancel_url:
      "http://localhost:3000/",

    allow_promotion_codes:
      true,

    metadata: {

      affiliate_code:
        affiliateCode || "",

      email:
        email || "",

      plan,

    },

    subscription_data: {

      metadata: {

        affiliate_code:
          affiliateCode || "",

        email:
          email || "",

        plan,

      },

    },

  });
    
    console.log(
      "✅ CHECKOUT:",
      session.id
    );

    // RETORNO
    return NextResponse.json({

      url:
        session.url,

    });

  } catch (error: any) {

    console.error(
      "🔥 STRIPE ERROR:"
    );

    console.error(error);

    return NextResponse.json(
      {
        error:
          error.message ||
          "Erro interno Stripe",
      },
      {
        status: 500,
      }
    );

  }

}