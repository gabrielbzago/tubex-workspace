"use client";

import { useState } from "react";

import {
  Crown,
  Rocket,
  Sparkles,
  Star,
} from "lucide-react";

const plans = [

  {
    name: "START",

    price: "9,90",

    plan: "start",

    icon: Sparkles,

    description:
      "Ideal para criadores iniciando.",

    features: [
      "SEO básico",
      "Tags inteligentes",
      "Analytics inicial",
      "Workspace básico",
    ],
  },

  {
    name: "MEMBER",

    price: "19,90",

    plan: "member",

    icon: Star,

    description:
      "Acesso para membros oficiais.",

    features: [
      "Tudo START",
      "Templates exclusivos",
      "Comunidade privada",
      "Benefícios de membro",
    ],

    popular: false,
  },

  {
    name: "PRO",

    price: "49,90",

    plan: "pro",

    icon: Crown,

    description:
      "Ferramentas avançadas para escala.",

    features: [
      "Tudo MEMBER",
      "Thumbnail AI",
      "Workspace IA",
      "Afiliados",
      "SEO avançado",
    ],

    popular: true,
  },

  {
    name: "EXPERT",

    price: "99,90",

    plan: "expert",

    icon: Rocket,

    description:
      "Ecossistema completo TubeX.",

    features: [
      "Tudo PRO",
      "IA avançada",
      "Automações",
      "Calendário IA",
      "Consultorias",
    ],
  },

];

type Props = {
  user: any;
};

export default function PricingPage({
  user,
}: Props) {

  const [
    loading,
    setLoading,
  ] = useState("");

  // =====================================================
  // CHECKOUT
  // =====================================================

  async function subscribe(
    plan: string
  ) {

    try {

      console.log(
        "👤 USER:",
        user
      );

      // =====================================================
      // MEMBER
      // =====================================================

      if (plan === "member") {

        window.open(
          "https://www.youtube.com/channel/UCjqKi0RrxQCxmoQ8FzDWq5w/join",
          "_blank"
        );

        return;

      }

      // =====================================================
      // LOGIN
      // =====================================================

      if (
        !user ||
        !user.email
      ) {

        alert(
          "Faça login antes de assinar."
        );

        console.error(
          "❌ USER SEM EMAIL"
        );

        return;

      }

      setLoading(plan);

      // =====================================================
      // AFILIADO
      // =====================================================

      const affiliateCode =
        localStorage.getItem(
          "affiliate_ref"
        ) || "";

      console.log(
        "📦 ENVIANDO CHECKOUT:",
        {

          plan,

          email:
            user.email,

          affiliateCode,

        }
      );

      // =====================================================
      // REQUEST
      // =====================================================

      const response =
        await fetch(
          "/api/create-checkout-session",
          {

            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({

              plan,

              email:
                user.email,

              affiliateCode,

            }),

          }
        );

      const data =
        await response.json();

      console.log(
        "💳 CHECKOUT RESPONSE:",
        data
      );

      // =====================================================
      // ERRO
      // =====================================================

      if (!response.ok) {

        console.error(
          "❌ CHECKOUT ERROR:",
          data
        );

        alert(
          data.error ||
          "Erro ao gerar checkout."
        );

        setLoading("");

        return;

      }

      // =====================================================
      // REDIRECT
      // =====================================================

      if (!data.url) {

        alert(
          "Checkout inválido."
        );

        setLoading("");

        return;

      }

      window.location.href =
        data.url;

    } catch (err) {

      console.error(
        "🔥 ERRO CHECKOUT:",
        err
      );

      alert(
        "Erro interno."
      );

      setLoading("");

    }

  }

  return (

    <section
      id="planos"
      className="
        py-24
        px-6
      "
    >

      <div
        className="
          max-w-7xl
          mx-auto
        "
      >

        {/* ===================================== */}
        {/* HEADER */}
        {/* ===================================== */}

        <div
          className="
            text-center
            mb-20
          "
        >

          <h2
            className="
              text-5xl
              font-black
              text-white
            "
          >
            Planos TubeX
          </h2>

          <p
            className="
              text-zinc-400
              mt-6
              text-xl
            "
          >
            Escolha o plano ideal
            para acelerar seu canal.
          </p>

        </div>

        {/* ===================================== */}
        {/* GRID */}
        {/* ===================================== */}

        <div
          className="
            grid
            grid-cols-1
            md:grid-cols-2
            xl:grid-cols-4
            gap-8
          "
        >

          {plans.map((plan) => {

            const Icon =
              plan.icon;

            return (

              <div
                key={plan.name}
                className={`
                  relative
                  rounded-3xl
                  border
                  bg-zinc-950
                  p-8
                  transition-all
                  duration-300
                  hover:-translate-y-2
                  hover:border-yellow-400
                  ${
                    plan.popular
                      ? "border-yellow-400"
                      : "border-white/10"
                  }
                `}
              >

                {/* ===================================== */}
                {/* POPULAR */}
                {/* ===================================== */}

                {plan.popular && (

                  <div
                    className="
                      absolute
                      top-5
                      right-5
                      bg-yellow-400
                      text-black
                      text-xs
                      font-bold
                      px-4
                      py-1
                      rounded-full
                    "
                  >
                    POPULAR
                  </div>

                )}

                {/* ===================================== */}
                {/* ICON */}
                {/* ===================================== */}

                <Icon
                  size={40}
                  className="
                    text-yellow-400
                    mb-6
                  "
                />

                {/* ===================================== */}
                {/* NAME */}
                {/* ===================================== */}

                <h2
                  className="
                    text-4xl
                    font-black
                    text-white
                  "
                >
                  {plan.name}
                </h2>

                {/* ===================================== */}
                {/* DESCRIPTION */}
                {/* ===================================== */}

                <p
                  className="
                    text-zinc-400
                    mt-4
                    min-h-[48px]
                  "
                >
                  {plan.description}
                </p>

                {/* ===================================== */}
                {/* PRICE */}
                {/* ===================================== */}

                <div
                  className="
                    mt-8
                  "
                >

                  <span
                    className="
                      text-5xl
                      font-black
                      text-yellow-400
                    "
                  >
                    R$ {plan.price}
                  </span>

                  <span
                    className="
                      text-zinc-500
                      ml-2
                    "
                  >
                    /mês
                  </span>

                </div>

                {/* ===================================== */}
                {/* FEATURES */}
                {/* ===================================== */}

                <ul
                  className="
                    mt-10
                    space-y-4
                  "
                >

                  {plan.features.map(
                    (feature) => (

                      <li
                        key={feature}
                        className="
                          text-zinc-300
                          flex
                          items-center
                          gap-3
                        "
                      >
                        ✓ {feature}
                      </li>

                    )
                  )}

                </ul>

                {/* ===================================== */}
                {/* BUTTON */}
                {/* ===================================== */}

                <button
                  onClick={() =>
                    subscribe(
                      plan.plan
                    )
                  }
                  disabled={
                    loading ===
                    plan.plan
                  }
                  className="
                    w-full
                    mt-12
                    rounded-2xl
                    bg-yellow-400
                    text-black
                    py-4
                    font-bold
                    text-lg
                    cursor-pointer
                    hover:scale-105
                    transition-all
                    duration-200
                    disabled:opacity-50
                  "
                >

                  {loading ===
                  plan.plan
                    ? "Carregando..."
                    : plan.plan ===
                      "member"
                    ? "Virar Membro"
                    : "Assinar"}

                </button>

              </div>

            );

          })}

        </div>

      </div>

    </section>

  );

}