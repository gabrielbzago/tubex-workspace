import Link from "next/link";

export default function TermsPage() {

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

            ⚡ Termos de Assinatura — TubeX

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

              1. Assinatura recorrente

            </h2>

            <p
              className="
              text-zinc-300
              text-lg
              leading-9
              "
            >

              O TubeX funciona através de assinatura mensal recorrente
              com renovação automática.

              <br /><br />

              Ao contratar qualquer plano,
              o usuário concorda com cobranças mensais automáticas
              até o cancelamento.

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

              2. Cancelamento

            </h2>

            <p
              className="
              text-zinc-300
              text-lg
              leading-9
              "
            >

              O cancelamento pode ser realizado
              a qualquer momento pelo cliente.

              <br /><br />

              Após o cancelamento,
              o acesso continuará ativo
              até o término do período já pago.

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

              3. Uso da plataforma

            </h2>

            <p
              className="
              text-zinc-300
              text-lg
              leading-9
              "
            >

              O usuário concorda em utilizar o TubeX
              de forma legítima,
              sem compartilhamento indevido de contas,
              automações abusivas
              ou tentativas de exploração da plataforma.

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

              4. Limitações

            </h2>

            <p
              className="
              text-zinc-300
              text-lg
              leading-9
              "
            >

              Os resultados obtidos com SEO,
              Inteligência Artificial
              e estratégias do TubeX
              podem variar conforme nicho,
              consistência
              e algoritmo do YouTube.

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

              5. Alterações

            </h2>

            <p
              className="
              text-zinc-300
              text-lg
              leading-9
              "
            >

              O TubeX poderá atualizar funcionalidades,
              preços e políticas
              visando melhorias contínuas da plataforma.

            </p>

          </div>

          {/* 6 */}

          <div>

            <h2
              className="
              text-3xl
              font-bold
              text-yellow-400
              mb-5
              "
            >

              6. Aceite

            </h2>

            <p
              className="
              text-zinc-300
              text-lg
              leading-9
              "
            >

              Ao assinar o TubeX,
              o usuário declara ter lido
              e aceitado integralmente estes termos.

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