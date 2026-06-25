import Link from "next/link";

export default function RefundPage() {

  return (

    <main className="min-h-screen bg-[#0b0f14] text-zinc-200">

      <section className="max-w-5xl mx-auto px-6 py-20">

        {/* HEADER */}

        <div className="mb-12">

          <h1
            className="
            text-5xl
            md:text-6xl
            font-extrabold
            text-yellow-400
            "
          >

            ⚡ Política de Devolução — TubeX

          </h1>

        </div>

        {/* CARD */}

        <div
          className="
          bg-[#111827]
          border
          border-[#1f2937]
          rounded-3xl
          p-10
          space-y-10
          "
        >

          {/* UPDATE */}

          <div>

            <p className="text-zinc-400 text-lg">

              <span className="font-bold text-white">

                Última atualização:

              </span>

              {" "}16/05/2026

            </p>

          </div>

          {/* 1 */}

          <div>

            <h2
              className="
              text-3xl
              font-bold
              text-yellow-400
              mb-5
              "
            >

              1. Produto digital

            </h2>

            <p
              className="
              text-zinc-300
              text-lg
              leading-9
              "
            >

              O TubeX é uma plataforma digital por assinatura
              e não realiza envio de produtos físicos.

            </p>

          </div>

          {/* 2 */}

          <div>

            <h2
              className="
              text-3xl
              font-bold
              text-yellow-400
              mb-5
              "
            >

              2. Devoluções

            </h2>

            <p
              className="
              text-zinc-300
              text-lg
              leading-9
              "
            >

              Por se tratar de serviço digital com liberação imediata de acesso,
              não existem devoluções físicas de produtos.

            </p>

          </div>

          {/* 3 */}

          <div>

            <h2
              className="
              text-3xl
              font-bold
              text-yellow-400
              mb-5
              "
            >

              3. Reembolsos

            </h2>

            <p
              className="
              text-zinc-300
              text-lg
              leading-9
              "
            >

              Solicitações de reembolso seguem as regras descritas
              na Política de Reembolso do TubeX.

            </p>

          </div>

          {/* 4 */}

          <div>

            <h2
              className="
              text-3xl
              font-bold
              text-yellow-400
              mb-5
              "
            >

              4. Direito de arrependimento

            </h2>

            <p
              className="
              text-zinc-300
              text-lg
              leading-9
              "
            >

              Conforme o artigo 49 do Código de Defesa do Consumidor,
              o cliente poderá solicitar cancelamento e reembolso
              em até 7 dias corridos após a primeira contratação.

            </p>

          </div>

          {/* 5 */}

          <div>

            <h2
              className="
              text-3xl
              font-bold
              text-yellow-400
              mb-5
              "
            >

              5. Utilização da plataforma

            </h2>

            <p
              className="
              text-zinc-300
              text-lg
              leading-9
              mb-6
              "
            >

              O TubeX libera acesso imediato a ferramentas digitais,
              recursos premium, consultas SEO, inteligência artificial
              e funcionalidades avançadas logo após a contratação.

            </p>

            <p
              className="
              text-zinc-300
              text-lg
              leading-9
              mb-6
              "
            >

              Em casos de utilização significativa da plataforma
              durante o período inicial da assinatura,
              o pedido de reembolso poderá ser analisado individualmente,
              considerando o consumo efetivo dos recursos digitais disponibilizados.

            </p>

            <p
              className="
              text-zinc-300
              text-lg
              leading-9
              "
            >

              O uso abusivo da plataforma com objetivo de obtenção indevida
              de benefícios, consultas, análises, geração massiva de conteúdo
              ou exploração dos recursos premium poderá resultar
              na recusa do reembolso e no cancelamento da conta.

            </p>

          </div>

          {/* LINKS */}

          <div
            className="
            border-t
            border-zinc-800
            pt-8
            flex
            flex-col
            gap-5
            "
          >

            <Link
              href="/refund"
              className="
              text-yellow-400
              hover:underline
              text-lg
              "
            >

              Ver política de reembolso

            </Link>

            <Link
              href="/"
              className="
              text-yellow-400
              hover:underline
              text-lg
              "
            >

              ← Voltar ao site

            </Link>

          </div>

        </div>

      </section>

    </main>

  );

}