"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { supabase }
from "@/lib/supabase";

import DashboardLayout
from "@/components/dashboard-layout";

export default function AuthProvider() {

  const [user, setUser] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(true);

  // =========================
  // INIT
  // =========================

  useEffect(() => {

    checkUser();

  }, []);

  async function checkUser() {

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {

      setUser(session.user);

    }

    setLoading(false);

  }

  // =========================
  // LOGIN GOOGLE
  // =========================

  async function signInGoogle() {

await supabase.auth.signInWithOAuth({

  provider: "google",

  options: {

    redirectTo:
      `${window.location.origin}/dashboard`,

    scopes:
      "openid email profile https://www.googleapis.com/auth/youtube.readonly",

    queryParams: {

      access_type: "offline",

      prompt: "consent"

    }

  }

});

  }

  // =========================
  // CHECKOUT
  // =========================

  async function subscribe(
  plan: string
) {

  try {

    // =========================
    // MEMBER
    // =========================

    if (plan === "member") {

      window.open(
        "https://www.youtube.com/channel/UCjqKi0RrxQCxmoQ8FzDWq5w/join",
        "_blank"
      );

      return;

    }

    // =========================
    // LOGIN OBRIGATÓRIO
    // =========================

    if (!user?.email) {

      alert(
        "Faça login com Google antes de assinar."
      );

      return;

    }

    console.log(
      "✅ USER:",
      user.email
    );

    // =========================
    // AFILIADO
    // =========================

    const affiliateCode =
      localStorage.getItem(
        "affiliate_ref"
      );

    console.log(
      "🎯 AFFILIATE:",
      affiliateCode
    );

    // =========================
    // CHECKOUT
    // =========================

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

            affiliateCode,

            email:
              user.email,

          }),

        }
      );

    const data =
      await response.json();

    console.log(
      "💳 CHECKOUT:",
      data
    );

    if (!response.ok) {

      alert(
        data.error ||
        "Erro ao criar checkout"
      );

      return;

    }

    if (!data.url) {

      alert(
        "Checkout inválido"
      );

      return;

    }

    // =========================
    // REDIRECT STRIPE
    // =========================

    window.location.href =
      data.url;

  } catch (err) {

    console.error(
      "ERRO CHECKOUT:",
      err
    );

    alert(
      "Erro interno no checkout."
    );

  }

}
  
  // =========================
  // LOADING
  // =========================

  if (loading) {

    return (

      <div
        className="
        min-h-screen
        bg-black
        flex
        items-center
        justify-center
        text-white
        text-2xl
        "
      >

        Carregando...

      </div>

    );

  }

  // =========================
  // LANDING
  // =========================

  return (

    <div
      className="
      min-h-screen
      bg-black
      text-white
      overflow-hidden
      "
    >

      {/* HEADER */}

      <header
        className="
        fixed
        top-0
        left-0
        w-full
        z-50
        border-b
        border-zinc-900
        bg-black/95
        backdrop-blur
        "
      >

        <div
          className="
          max-w-7xl
          mx-auto
          px-6
          py-5
          flex
          items-center
          justify-between
          "
        >

 {/* ======================================================
    LOGO
====================================================== */}

<div
  className="
    flex
    items-center
  "
>

  <img
    src="/logo.png"
    alt="TubeX"
    className="
      h-16
      w-auto
      object-contain
      transition-all
      duration-300
      hover:scale-105
    "
    draggable={false}
  />

</div>

          {/* MENU */}

          <nav
            className="
            hidden
            lg:flex
            items-center
            gap-8
            text-lg
            font-semibold
            "
          >

            <Link
              href="/"
              className="hover:text-yellow-400 transition"
            >
              🏠 Início
            </Link>

            <Link
              href="/updates"
              className="hover:text-yellow-400 transition"
            >
              📝 Atualizações
            </Link>

            <Link
              href="/plans"
              className="hover:text-yellow-400 transition"
            >
              💳 Planos
            </Link>

            <Link
              href="/consultoria"
              className="hover:text-yellow-400 transition"
            >
              📌 Consultorias
            </Link>

            <Link
              href="/privacy"
              className="hover:text-yellow-400 transition"
            >
              🔒 Privacidade
            </Link>

            <a
              href="https://youtube.com/@gabrielbzago"
              target="_blank"
              className="hover:text-yellow-400 transition"
            >
              🎥 Canal
            </a>

          </nav>

          {/* LOGIN */}

          <button
            onClick={signInGoogle}
            className="
            bg-yellow-400
            hover:bg-yellow-300
            transition
            px-7
            py-4
            rounded-2xl
            text-black
            font-bold
            "
          >
            Entrar com Google
          </button>

        </div>

      </header>

    {/* HERO */}

<section
  className="
    pt-48
    pb-28
    px-6
  "
>

  <div
    className="
      max-w-6xl
      mx-auto
      text-center
    "
  >

    {/* LOGO */}

    <div className="mb-10 flex justify-center">

      <img
        src="/logo.png"
        alt="TubeX"
        className="
          w-full
          max-w-[340px]
          h-auto
          object-contain
        "
      />

    </div>

    <h2
      className="
        text-5xl
        md:text-7xl
        font-bold
        leading-tight
      "
    >

      O Workspace definitivo
      para criadores de conteúdo

    </h2>

 <p
      className="
        text-zinc-400
        text-xl
        md:text-2xl
        mt-10
        max-w-4xl
        mx-auto
      "
    >
      SEO, IA, analytics, thumbnails,
      afiliados e automações
      em um só lugar.
    </p>

  </div>

</section>


      {/* PLANOS */}

      <section
        className="
        max-w-7xl
        mx-auto
        px-6
        pb-32
        grid
        grid-cols-1
        md:grid-cols-2
        xl:grid-cols-4
        gap-8
        "
      >

        {/* START */}

        <PlanCard
          title="START"
          price="9,90"
          features={[
            "SEO AI",
            "Dashboard",
            "Keywords",
            "Analytics",
          ]}
          onClick={() =>
            subscribe("start")
          }
        />

        {/* MEMBER */}

        <PlanCard
          title="MEMBER"
          price="19,90"
          button="Virar membro"
          features={[
            "Apoio ao canal",
            "Badge exclusivo",
            "Lives privadas",
          ]}
          onClick={() =>
            subscribe("member")
          }
        />

        {/* PRO */}

        <PlanCard
          title="PRO"
          price="49,90"
          popular
          features={[
            "Tudo MEMBER",
            "Thumbnail AI",
            "Workspace IA",
            "Afiliados",
          ]}
          onClick={() =>
            subscribe("pro")
          }
        />

        {/* EXPERT */}

        <PlanCard
          title="EXPERT"
          price="99,90"
          features={[
            "Tudo PRO",
            "IA avançada",
            "Automações",
            "Calendário IA",
          ]}
          onClick={() =>
            subscribe("expert")
          }
        />

      </section>

      {/* FEATURES */}

      <section
        className="
        max-w-7xl
        mx-auto
        px-6
        pb-32
        grid
        md:grid-cols-3
        gap-8
        "
      >

        <FeatureCard
          title="SEO Inteligente"
          description="Análises avançadas de títulos, tags, CTR e performance."
        />

        <FeatureCard
          title="Thumbnail AI"
          description="Ferramentas inteligentes para thumbnails de alta conversão."
        />

        <FeatureCard
          title="Sistema de Afiliados"
          description="Comissões automáticas integradas ao Stripe."
        />

      </section>

      {/* FOOTER */}

      <footer
        className="
        border-t
        border-zinc-900
        py-20
        px-6
        "
      >

        <div
          className="
          max-w-6xl
          mx-auto
          text-center
          "
        >

          <h3
            className="
            text-4xl
            font-bold
            text-yellow-400
            "
          >
            Contato
          </h3>

          <div
            className="
            mt-8
            text-xl
            text-zinc-300
            "
          >

            <p>
              Suporte:
              gabrielbzago@gmail.com
            </p>

            <p className="mt-2">
              WhatsApp:
              19 99203-6896
            </p>

          </div>

          <div
            className="
            mt-16
            text-zinc-500
            text-xl
            "
          >
            ⚡ TubeX —
            Desenvolvido por
            Gabriel Zago
          </div>

          <div
            className="
            mt-12
            flex
            flex-wrap
            justify-center
            gap-6
            text-lg
            "
          >

            <Link
              href="/terms"
              className="text-yellow-400 hover:underline"
            >
              Termos
            </Link>

            <Link
              href="/refund"
              className="text-yellow-400 hover:underline"
            >
              Reembolso
            </Link>

            <Link
              href="/privacy"
              className="text-yellow-400 hover:underline"
            >
              Privacidade
            </Link>

            <Link
              href="/faq"
              className="text-yellow-400 hover:underline"
            >
              FAQ
            </Link>

          </div>

        </div>

      </footer>

    </div>

  );

}

// =========================
// PLAN CARD
// =========================

function PlanCard({
  title,
  price,
  features,
  onClick,
  popular,
  button = "Assinar",
}: any) {

  return (

    <div
      className={`
      rounded-3xl
      p-10
      bg-zinc-950
      relative
      transition
      hover:-translate-y-2
      hover:border-yellow-400
      ${
        popular
          ? "border-2 border-yellow-400"
          : "border border-zinc-800"
      }
      `}
    >

      {popular && (

        <div
          className="
          absolute
          top-5
          right-5
          bg-yellow-400
          text-black
          px-4
          py-2
          rounded-full
          font-bold
          "
        >
          POPULAR
        </div>

      )}

      <h3 className="text-5xl font-bold">
        {title}
      </h3>

      <div
        className="
        mt-8
        text-7xl
        font-bold
        text-yellow-400
        "
      >
        R${price}
      </div>

      <p className="text-zinc-500 mt-2">
        /mês
      </p>

      <div
        className="
        mt-10
        space-y-4
        text-xl
        "
      >

        {features.map(
          (
            item: string,
            index: number
          ) => (

            <p key={index}>
              ✓ {item}
            </p>

          )
        )}

      </div>

      <button
        onClick={onClick}
        className="
        mt-12
        w-full
        bg-yellow-400
        hover:bg-yellow-300
        transition
        text-black
        font-bold
        py-5
        rounded-2xl
        text-xl
        "
      >
        {button}
      </button>

    </div>

  );

}

// =========================
// FEATURE CARD
// =========================

function FeatureCard({
  title,
  description,
}: any) {

  return (

    <div
      className="
      bg-zinc-950
      border
      border-zinc-800
      rounded-3xl
      p-10
      "
    >

      <h3
        className="
        text-3xl
        font-bold
        text-yellow-400
        "
      >
        {title}
      </h3>

      <p
        className="
        mt-6
        text-zinc-400
        text-lg
        leading-relaxed
        "
      >
        {description}
      </p>

    </div>

  );

}