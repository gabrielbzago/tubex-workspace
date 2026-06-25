export default function FAQ() {

  const faqs = [

    {
      q:"O TubeX funciona para canais pequenos?",
      a:"Sim. O sistema foi criado principalmente para acelerar canais pequenos e médios.",
    },

    {
      q:"Precisa instalar extensão?",
      a:"Não. Agora o TubeX funciona totalmente via plataforma web.",
    },

    {
      q:"Tem IA integrada?",
      a:"Sim. O TubeX possui IA avançada para SEO, títulos, thumbnails e estratégias.",
    },

    {
      q:"Tem sistema de afiliados?",
      a:"Sim. Você recebe comissões automáticas indicando usuários.",
    },

  ];

  return (

    <section className="max-w-5xl mx-auto py-32 px-6">

      <h2 className="text-5xl font-bold mb-20 text-center">

        Perguntas Frequentes

      </h2>

      <div className="space-y-6">

        {faqs.map((faq, index)=>(

          <div
            key={index}
            className="
            border
            border-zinc-800
            rounded-3xl
            p-8
            bg-zinc-950
            "
          >

            <h3 className="text-2xl font-bold mb-4">

              {faq.q}

            </h3>

            <p className="text-zinc-400 text-lg">

              {faq.a}

            </p>

          </div>

        ))}

      </div>

    </section>

  );

}