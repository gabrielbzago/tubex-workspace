import Link from "next/link";

export default function PlansPage() {

  const plans = [

    {
      name: "START",
      price: "R$9,90",
      color: "border-zinc-700",
      button: "bg-yellow-400 text-black",
      features: [

        "SEO básico para vídeos",
        "Tags inteligentes",
        "Sugestões de títulos",
        "Análise básica de SEO",
        "Ferramentas iniciais",
        "Dashboard web",
        "Acesso ao sistema de afiliados",
        "Link de afiliado próprio",
        "Painel de comissões",
        "Suporte padrão",

      ],
    },

    {
      name: "MEMBER",
      price: "R$19,90",
      color: "border-zinc-700",
      button: "bg-zinc-800 text-white",
      features: [

        "Benefícios exclusivos do canal",
        "Lives privadas",
        "Conteúdo antecipado",
        "Acesso à comunidade",
        "Bastidores",
        "Grupo exclusivo",
        "Não utiliza Stripe",
        "Pagamento via YouTube",

      ],
    },

    {
      name: "PRO",
      price: "R$49,90",
      color: "border-yellow-400",
      button: "bg-yellow-400 text-black",
      popular: true,
      features: [

        "Tudo do START",
        "SEO avançado",
        "Thumbnail AI",
        "Workspace IA",
        "Análise avançada",
        "Diagnóstico completo",
        "Estratégias virais",
        "Pesquisa de concorrentes",
        "Automação SEO",
        "Histórico de análises",
        "Painel afiliados completo",
        "Comissões automáticas",
        "Dashboard premium",
        "IA avançada",
        "Suporte prioritário",

      ],
    },

    {
      name: "EXPERT",
      price: "R$99,90",
      color: "border-yellow-400",
      button: "bg-yellow-400 text-black",
      features: [

        "Tudo do PRO",
        "IA avançada ilimitada",
        "Automação completa",
        "Calendário IA",
        "Planejamento estratégico",
        "Analytics avançado",
        "Ferramentas futuras",
        "Prioridade máxima",
        "Recursos beta",
        "Insights avançados",
        "Painel profissional",
        "Recursos exclusivos",
        "Suporte VIP",

      ],
    },

  ];

  return (

    <main className="min-h-screen bg-[#070b10] text-white">

      {/* HERO */}

      <section className="px-6 py-24 text-center">

        <h1
          className="
          text-5xl
          md:text-7xl
          font-black
          leading-tight
          "
        >

          Planos TubeX

        </h1>

        <p
          className="
          text-zinc-400
          text-xl
          mt-8
          max-w-3xl
          mx-auto
          leading-9
          "
        >

          Escolha o plano ideal para acelerar
          o crescimento do seu canal com SEO,
          Inteligência Artificial, analytics,
          automações e sistema de afiliados.

        </p>

      </section>

      {/* PLANS */}

      <section
        className="
        max-w-7xl
        mx-auto
        px-6
        pb-24
        grid
        grid-cols-1
        md:grid-cols-2
        xl:grid-cols-4
        gap-8
        "
      >

        {plans.map((plan, index)=>(

          <div
            key={index}
            className={`
            relative
            bg-[#0d1117]
            border
            ${plan.color}
            rounded-3xl
            p-8
            flex
            flex-col
            `}
          >

            {/* POPULAR */}

            {plan.popular && (

              <div
                className="
                absolute
                top-5
                right-5
                bg-yellow-400
                text-black
                text-sm
                font-bold
                px-4
                py-2
                rounded-full
                "
              >

                POPULAR

              </div>

            )}

            {/* TITLE */}

            <h2
              className="
              text-5xl
              font-black
              "
            >

              {plan.name}

            </h2>

            {/* PRICE */}

            <div className="mt-8">

              <span
                className="
                text-6xl
                font-black
                text-yellow-400
                "
              >

                {plan.price}

              </span>

              <span
                className="
                text-zinc-500
                text-lg
                "
              >

                /mês

              </span>

            </div>

            {/* FEATURES */}

            <div
              className="
              mt-10
              space-y-5
              flex-1
              "
            >

              {plan.features.map(
                (
                  feature,
                  i
                ) => (

                  <div
                    key={i}
                    className="
                    flex
                    items-start
                    gap-3
                    "
                  >

                    <span
                      className="
                      text-yellow-400
                      mt-1
                      "
                    >

                      ✓

                    </span>

                    <p
                      className="
                      text-zinc-300
                      leading-7
                      "
                    >

                      {feature}

                    </p>

                  </div>

                )
              )}

            </div>

            {/* BUTTON */}

            <button
              className={`
              mt-10
              w-full
              py-4
              rounded-2xl
              font-bold
              text-lg
              transition
              hover:scale-[1.02]
              ${plan.button}
              `}
            >

              Assinar

            </button>

          </div>

        ))}

      </section>

      {/* COMPARISON */}

      <section
        className="
        max-w-6xl
        mx-auto
        px-6
        pb-24
        "
      >

        <div
          className="
          bg-[#0d1117]
          border
          border-zinc-800
          rounded-3xl
          p-10
          "
        >

          <h2
            className="
            text-4xl
            font-black
            mb-8
            "
          >

            Qual plano escolher?

          </h2>

          <div className="space-y-8">

            <div>

              <h3
                className="
                text-2xl
                font-bold
                text-yellow-400
                "
              >

                START

              </h3>

              <p
                className="
                text-zinc-400
                mt-3
                leading-8
                "
              >

                Ideal para iniciantes que querem
                melhorar SEO, títulos e tags
                sem investir muito.

              </p>

            </div>

            <div>

              <h3
                className="
                text-2xl
                font-bold
                text-yellow-400
                "
              >

                PRO

              </h3>

              <p
                className="
                text-zinc-400
                mt-3
                leading-8
                "
              >

                Melhor custo-benefício para
                criadores que querem escalar
                com IA, thumbnails, automações
                e estratégias avançadas.

              </p>

            </div>

            <div>

              <h3
                className="
                text-2xl
                font-bold
                text-yellow-400
                "
              >

                EXPERT

              </h3>

              <p
                className="
                text-zinc-400
                mt-3
                leading-8
                "
              >

                Feito para criadores profissionais
                que desejam máximo desempenho,
                IA avançada e prioridade total.

              </p>

            </div>

          </div>

        </div>

      </section>

      {/* FOOTER */}

      <footer
        className="
        border-t
        border-zinc-800
        py-10
        px-6
        text-center
        "
      >

        <div
          className="
          flex
          flex-wrap
          justify-center
          gap-6
          mb-6
          "
        >

          <Link
            href="/"
            className="
            text-zinc-400
            hover:text-yellow-400
            "
          >

            Início

          </Link>

          <Link
            href="/faq"
            className="
            text-zinc-400
            hover:text-yellow-400
            "
          >

            FAQ

          </Link>

          <Link
            href="/privacy"
            className="
            text-zinc-400
            hover:text-yellow-400
            "
          >

            Privacidade

          </Link>

          <Link
            href="/terms"
            className="
            text-zinc-400
            hover:text-yellow-400
            "
          >

            Termos

          </Link>

          <Link
            href="/refund"
            className="
            text-zinc-400
            hover:text-yellow-400
            "
          >

            Reembolso

          </Link>

        </div>

        <p className="text-zinc-500">

          © 2026 TubeX — Todos os direitos reservados.

        </p>

      </footer>

    </main>

  );

}