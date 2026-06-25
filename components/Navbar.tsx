export default function FAQ() {

  const faqs = [

    {
      question:
        "O TubeX funciona para canais pequenos?",

      answer:
        "Sim. O sistema foi desenvolvido principalmente para acelerar canais pequenos e médios.",
    },

    {
      question:
        "Precisa instalar extensão?",

      answer:
        "Não. O novo TubeX funciona totalmente via plataforma web.",
    },

    {
      question:
        "Tem IA integrada?",

      answer:
        "Sim. O TubeX possui IA avançada para SEO, títulos, thumbnails e estratégias.",
    },

    {
      question:
        "O sistema de afiliados é automático?",

      answer:
        "Sim. As comissões são registradas automaticamente via Stripe + Supabase.",
    },

  ];

  return (

    <section
      className="
      max-w-5xl
      mx-auto
      py-32
      px-6
      "
    >

      <h2
        className="
        text-6xl
        font-bold
        text-center
        mb-20
        "
      >

        FAQ

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

            <h3
              className="
              text-2xl
              font-bold
              mb-4
              "
            >
              {faq.question}
            </h3>

            <p
              className="
              text-zinc-400
              text-lg
              leading-8
              "
            >
              {faq.answer}
            </p>

          </div>

        ))}

      </div>

    </section>

  );

}