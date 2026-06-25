import Stripe from "stripe";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!
);

export async function POST(
  req: Request
) {

  const body =
    await req.json();

  const {
    priceId,
    email,
    affiliateCode,
  } = body;

  const session =
    await stripe.checkout.sessions.create({

      mode: "subscription",

      customer_email: email,

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      success_url:
        "https://tubex.app/success",

      cancel_url:
        "https://tubex.app/pricing",

      metadata: {

        affiliate_code:
          affiliateCode || "",

        email,

      },

    });

  return Response.json({
    url: session.url,
  });

}