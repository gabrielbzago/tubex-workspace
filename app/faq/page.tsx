import Link from "next/link";

export default function FAQPage() {

  const faqs = [

    {
      question:
        "O que é o TubeX?",

      answer:
        "O TubeX é uma plataforma SaaS completa focada em SEO, Inteligência Artificial, analytics e crescimento para criadores de conteúdo no YouTube.",
    },

    {
      question:
        "O TubeX funciona para canais pequenos?",

      answer:
        "Sim. O sistema foi desenvolvido principalmente para acelerar canais pequenos e médios utilizando SEO inteligente e IA avançada.",
    },

    {
      question:
        "Preciso instalar extensão?",

      answer:
        "Não. O novo TubeX funciona totalmente via plataforma web, sem necessidade de extensão.",
    },

    {
      question:
        "Como funciona o login?",

      answer:
        "O login é feito com autenticação oficial Google OAuth via Supabase, garantindo segurança total.",
    },

    {
      question:
        "O TubeX usa Inteligência Artificial?",

      answer:
        "Sim. O TubeX possui IA avançada para títulos virais, descrições, SEO, ideias de vídeos, diagnósticos e estratégias.",
    },

    {
      question:
        "Os dados do YouTube são reais?",

      answer:
        "Sim. O sistema utiliza a API oficial do YouTube para análises reais de SEO, concorrência, tags e desempenho.",
    },

    {
      question:
        "Como funciona o plano MEMBER?",

      answer:
        "O plano MEMBER é feito diretamente pelo sistema de membros do YouTube e não utiliza Stripe.",
    },

    {
      question:
        "Quais planos possuem afiliados?",

      answer:
        "Os planos START, PRO e EXPERT possuem sistema de afiliados automático integrado ao Stripe.",
    },

    {
      question:
        "Como funciona o sistema de afiliados?",

      answer:
        "Cada usuário recebe um link exclusivo. Quando alguém assina usando esse link, a comissão é registrada automaticamente.",
    },

    {
      question:
        "Como recebo minhas comissões?",

      answer:
        "As comissões ficam registradas no dashboard do afiliado e os pagamentos podem ser realizados conforme política da plataforma.",
    },

    {
      question:
        "Posso cancelar quando quiser?",

      answer:
        "Sim. As assinaturas podem ser canceladas a qualquer momento.",
    },

    {
      question:
        "Após cancelar perco acesso imediatamente?",

      answer:
        "Não. O acesso permanece ativo até o término do período já pago.",
    },

    {
      question:
        "Existe reembolso?",

      answer:
        "Sim. O cliente pode solicitar reembolso conforme as regras da Política de Reembolso do TubeX.",
    },

    {
      question:
        "O TubeX vende meus dados?",

      answer:
        "Não. O TubeX não vende dados pessoais e segue práticas alinhadas à LGPD.",
    },

    {
      question:
        "Os pagamentos são seguros?",

      answer:
        "Sim. Todos os pagamentos são processados pela Stripe com segurança avançada.",
    },

    {
      question:
        "O TubeX possui suporte?",

      answer:
        "Sim. Você pode entrar em contato via email ou WhatsApp para suporte e consultorias.",
    },

    {
      question:
        "O TubeX possui consultorias?",

      answer:
        "Sim. Existem consultorias focadas em SEO, thumbnails, crescimento de canal e estratégias avançadas.",
    },

    {
      question:
        "O TubeX terá aplicativo mobile?",

      answer:
        "Sim. O roadmap inclui versão mobile completa com IA integrada.",
    },

  ];

  return (

    <main className="min-h-screen bg-[#0b0f14] text-zinc-200">

      <section className="max-w-5xl mx-auto px-6 py-20">

        {/* HEADER */}

        <div className="text-center mb-16">

          <h1
            className="
            text-5xl
            md:text-6xl
            font-extrabold
            text-white
            mb-6
            "
          >

            FAQ • Perguntas Frequentes

          </h1>

          <p
            className="
            text-zinc-400
            text-xl
            max-w-3xl
            mx-auto
            "
          >

            Tudo que você precisa saber sobre
            o TubeX, planos, IA, afiliados,
            pagamentos e funcionalidades.

          </p>

        </div>

        {/* FAQ LIST */}

        <div className="space-y-6">

          {faqs.map((faq, index)=>(

            <div
              key={index}
              className="
              bg-[#111827]
              border
              border-[#1f2937]
              rounded-3xl
              p-8
              "
            >

              <h2
                className="
                text-2xl
                font-bold
                text-yellow-400
                mb-5
                "
              >

                {faq.question}

              </h2>

              <p
                className="
                text-zinc-300
                text-lg
                leading-9
                "
              >

                {faq.answer}

              </p>

            </div>

          ))}

        </div>

        {/* SUPPORT */}

        <div
          className="
          mt-16
          bg-[#111827]
          border
          border-yellow-400
          rounded-3xl
          p-10
          text-center
          "
        >

          <h2
            className="
            text-4xl
            font-bold
            text-white
            "
          >

            Ainda possui dúvidas?

          </h2>

          <p
            className="
            text-zinc-400
            text-lg
            mt-6
            "
          >

            Entre em contato diretamente com o suporte TubeX.

          </p>

          <div
            className="
            mt-10
            flex
            flex-col
            md:flex-row
            justify-center
            gap-6
            "
          >

            <a
              href="mailto:gabrielbzago@gmail.com"
              className="
              bg-yellow-400
              hover:bg-yellow-300
              transition
              text-black
              font-bold
              px-8
              py-4
              rounded-2xl
              "
            >

              Email Suporte

            </a>

            <a
              href="https://wa.me/5519992036896"
              target="_blank"
              className="
              border
              border-yellow-400
              hover:bg-yellow-400
              hover:text-black
              transition
              text-yellow-400
              font-bold
              px-8
              py-4
              rounded-2xl
              "
            >

              WhatsApp

            </a>

          </div>

        </div>

        {/* FOOTER */}

        <div
          className="
          mt-16
          text-center
          border-t
          border-zinc-800
          pt-8
          "
        >

          <div
            className="
            flex
            flex-wrap
            justify-center
            gap-6
            mb-8
            "
          >

            <Link
              href="/privacy"
              className="text-yellow-400 hover:underline"
            >
              Privacidade
            </Link>

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
              href="/updates"
              className="text-yellow-400 hover:underline"
            >
              Atualizações
            </Link>

          </div>

          <p className="text-zinc-500 text-sm">

            TubeX © 2026 • FAQ Oficial

          </p>

        </div>

      </section>

    </main>

  );

}