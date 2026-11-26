export default function PrivacyPage() {

  return (

    <main className="min-h-screen bg-[#0b0f17] text-zinc-200">

      <section className="max-w-5xl mx-auto px-6 py-20">

        {/* HEADER */}
        <div className="text-center mb-14">

          <h1 className="text-5xl md:text-6xl font-extrabold mb-5 text-white">

            Política de Privacidade

          </h1>

          <p className="text-zinc-400 text-lg">

            TubeX • Plataforma de SEO e Inteligência para YouTube

          </p>

          <p className="text-zinc-500 text-sm mt-2">

            Última atualização: 07/05/2026

          </p>

        </div>

        {/* HIGHLIGHT */}
        <div className="bg-[#1f2937] border border-[#2c3445] rounded-2xl p-6 mb-8">

          <p className="text-zinc-200 text-lg leading-8">

            O TubeX respeita sua privacidade e processa dados apenas mediante consentimento explícito.

          </p>

        </div>

        {/* CARD */}
        <div className="space-y-6">

          {/* 1 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-7">

            <h2 className="text-2xl font-bold mb-4 text-white">

              1. Autenticação e Identificação

            </h2>

            <p className="text-zinc-400 leading-8 mb-4">

              O TubeX utiliza autenticação segura via Google OAuth.
              Ao fazer login, podemos acessar:

            </p>

            <ul className="list-disc pl-6 space-y-2 text-zinc-300">

              <li>Nome</li>
              <li>Email</li>

            </ul>

            <p className="text-zinc-400 leading-8 mt-4">

              Esses dados são usados exclusivamente para identificação,
              autenticação e controle de acesso.

            </p>

          </div>

          {/* 2 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-7">

            <h2 className="text-2xl font-bold mb-4 text-white">

              2. Uso da API do YouTube

            </h2>

            <p className="text-zinc-400 leading-8 mb-4">

              O TubeX utiliza a API oficial do YouTube para acessar dados do canal e vídeos do usuário autenticado.

            </p>

            <ul className="list-disc pl-6 space-y-2 text-zinc-300">

              <li>Informações do canal</li>
              <li>Dados de vídeos e desempenho</li>
              <li>Elementos necessários para análise de SEO</li>

            </ul>

            <p className="text-zinc-400 leading-8 mt-4">

              Os dados são utilizados exclusivamente dentro da plataforma e não são vendidos ou compartilhados.

            </p>

          </div>

          {/* 3 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-7">

            <h2 className="text-2xl font-bold mb-4 text-white">

              3. Dados Coletados

            </h2>

            <ul className="list-disc pl-6 space-y-2 text-zinc-300">

              <li>Dados da conta Google (OAuth)</li>
              <li>Dados públicos do YouTube</li>
              <li>Dados técnicos (cache, tokens e armazenamento local)</li>

            </ul>

          </div>

          {/* 4 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-7">

            <h2 className="text-2xl font-bold mb-4 text-white">

              4. Finalidade do Uso

            </h2>

            <ul className="list-disc pl-6 space-y-2 text-zinc-300">

              <li>Fornecer funcionalidades do TubeX</li>
              <li>Gerar análises com Inteligência Artificial</li>
              <li>Validar planos e acessos</li>
              <li>Melhorar a experiência do usuário</li>

            </ul>

          </div>

          {/* 5 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-7">

            <h2 className="text-2xl font-bold mb-4 text-white">

              5. Inteligência Artificial

            </h2>

            <p className="text-zinc-400 leading-8">

              O TubeX utiliza sistemas de IA para gerar insights,
              sugestões e análises avançadas.
              Os dados são processados de forma segura e não são armazenados permanentemente.

            </p>

          </div>

          {/* 6 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-7">

            <h2 className="text-2xl font-bold mb-4 text-white">

              6. Compartilhamento de Dados

            </h2>

            <ul className="list-disc pl-6 space-y-2 text-zinc-300">

              <li>Google APIs (YouTube Data API)</li>
              <li>Serviços de Inteligência Artificial</li>
              <li>Plataformas de pagamento</li>

            </ul>

            <p className="text-zinc-400 leading-8 mt-4">

              O TubeX não vende dados pessoais.

            </p>

          </div>

          {/* 7 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-7">

            <h2 className="text-2xl font-bold mb-4 text-white">

              7. Base Legal (LGPD)

            </h2>

            <ul className="list-disc pl-6 space-y-2 text-zinc-300">

              <li>Consentimento do usuário</li>
              <li>Execução de contrato</li>
              <li>Interesse legítimo</li>

            </ul>

          </div>

          {/* 8 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-7">

            <h2 className="text-2xl font-bold mb-4 text-white">

              8. Armazenamento e Retenção

            </h2>

            <ul className="list-disc pl-6 space-y-2 text-zinc-300">

              <li>Dados armazenados apenas quando necessário</li>
              <li>Cache temporário com expiração automática</li>
              <li>Dados podem ser removidos mediante solicitação</li>

            </ul>

          </div>

          {/* 9 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-7">

            <h2 className="text-2xl font-bold mb-4 text-white">

              9. Segurança

            </h2>

            <ul className="list-disc pl-6 space-y-2 text-zinc-300">

              <li>Autenticação via Google</li>
              <li>Proteção contra acessos não autorizados</li>
              <li>Validação de requisições e rate limiting</li>

            </ul>

          </div>

          {/* 10 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-7">

            <h2 className="text-2xl font-bold mb-4 text-white">

              10. Direitos do Usuário

            </h2>

            <ul className="list-disc pl-6 space-y-2 text-zinc-300">

              <li>Acesso, correção e exclusão de dados</li>
              <li>Revogação de consentimento</li>

            </ul>

          </div>

          {/* 11 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-7">

            <h2 className="text-2xl font-bold mb-4 text-white">

              11. Cookies e Armazenamento

            </h2>

            <ul className="list-disc pl-6 space-y-2 text-zinc-300">

              <li>Uso de armazenamento local para performance</li>
              <li>Sem rastreamento publicitário</li>

            </ul>

          </div>

          {/* 12 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-7">

            <h2 className="text-2xl font-bold mb-4 text-white">

              12. Alterações

            </h2>

            <p className="text-zinc-400 leading-8">

              Esta política pode ser atualizada periodicamente.

            </p>

          </div>

          {/* 13 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-7">

            <h2 className="text-2xl font-bold mb-4 text-white">

              13. Contato

            </h2>

            <p className="text-zinc-300 text-lg">

              Email: gabrielbzago@gmail.com

            </p>

          </div>

        </div>

        {/* FOOTER */}
        <div className="mt-16 text-center border-t border-zinc-800 pt-8">

          <p className="text-zinc-500 text-sm">

            TubeX © 2026 • Todos os direitos reservados

          </p>

        </div>

      </section>

    </main>

  );

}