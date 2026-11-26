import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuthenticatedUser } from "@/lib/tubex-backend";
import { AI_CREDIT_PACKS, findCreditPack } from "@/lib/tubex-ai-packs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY não configurada.");
  return new Stripe(key);
}

/**
 * Checkout de pacote de créditos do TubeX AI (compra única, mode=payment).
 * O crédito NÃO é dado aqui: só o webhook (checkout.session.completed /
 * async_payment_succeeded) credita, depois que a Stripe confirma o pagamento.
 */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const pack = findCreditPack(body?.pack);
    if (!pack) {
      return NextResponse.json({ error: "Pacote inválido.", packs: AI_CREDIT_PACKS.map(p => p.id) }, { status: 400 });
    }

    const email = String(user.email || "").trim().toLowerCase();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://tubex.app.br");

    const metadata: Record<string, string> = {
      kind: "ai_credit_pack",
      pack: pack.id,
      credits: String(pack.credits),
      user_id: String(user.id),
      ...(email ? { email } : {}),
    };

    // Price ID cadastrado na Stripe (opcional). Sem ele, o preço é criado na hora.
    const priceId = String(process.env[pack.envPriceKey] || "").trim();
    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: pack.currency,
            unit_amount: pack.amountCents,
            product_data: {
              name: `TubeX AI · ${pack.name}`,
              description: `${pack.credits.toLocaleString("pt-BR")} créditos avulsos para o TubeX AI. Não expiram na virada do mês.`,
            },
          },
        };

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [lineItem],
      ...(email ? { customer_email: email } : {}),
      customer_creation: "always",
      metadata,
      payment_intent_data: { metadata, description: `TubeX AI · ${pack.name} (${pack.credits} créditos)` },
      allow_promotion_codes: false,
      success_url: `${appUrl}/dashboard?tab=ai&credits=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard?tab=ai&credits=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("[TubeX AI] Falha ao criar checkout de créditos:", error);
    return NextResponse.json({ error: error?.message || "Não foi possível abrir o pagamento." }, { status: 500 });
  }
}
