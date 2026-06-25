"use client";

import {
  useMemo,
  useState,
  useEffect
} from "react";

import {

  BarChart3,
  TrendingUp,
  Eye,
  Users,
  Clock,
  Search,
  Loader2,
  Check,
  Copy,
  Sparkles

} from "lucide-react";

/* ======================================================
   TYPES
====================================================== */

interface AnalyticsResponse {

  success: boolean;

  score: number;

  ctr: number;

  retention: number;

  views30Days: number;

  subscribers: number;

  subscribersGained: number;

  strengths: string[];

  weaknesses: string[];

  opportunities: string[];

  nextVideos: string[];

  recommendations: string[];

}

/* ======================================================
   COMPONENT
====================================================== */

export default function AnalyticsAI({
  userData
}:any) {


  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [copied, setCopied] =
    useState("");

  const [result, setResult] =
    useState<AnalyticsResponse | null>(null);

/* ======================================================
   RESTORE SESSION
====================================================== */

useEffect(() => {

  const saved =
    sessionStorage.getItem(
      "tubex-analytics-result"
    );

  if (!saved) return;

  try {

    setResult(
      JSON.parse(saved)
    );

  }

  catch {

    sessionStorage.removeItem(
      "tubex-analytics-result"
    );

  }

}, []);

const channelId =
  userData?.youtube_channel_id;

const channelName =
  userData?.youtube_channel_name;

  /* ======================================================
     COPY
  ====================================================== */

  async function copy(
    text: string,
    id: string
  ) {

    try {

      await navigator.clipboard.writeText(text);

      setCopied(id);

      setTimeout(() => {

        setCopied("");

      }, 1500);

    }

    catch {

      alert("Erro ao copiar");

    }

  }

/* ======================================================
   API
====================================================== */

async function analyzeChannel() {

  if (!channelId) {

    setError("Canal não conectado.");
    return;

  }

setLoading(true);
setError("");

  try {

    // ======================================================
    // 🔥 BUSCA DADOS REAIS DO CANAL
    // ======================================================

    const channelResponse =
await fetch(
  "https://tubex-backend.vercel.app/api/youtube-channel",
  {
    method:"POST",

    headers:{
  "Content-Type":"application/json",
  "x-api-key":"tubex_secure_2026_ultra"
},

    body:JSON.stringify({
      channelId
    })
  }
);

    const channelJson =
      await channelResponse.json();

    console.log(
  "CHANNEL DATA:",
  JSON.stringify(channelJson, null, 2)
);

    if (!channelJson.success) {

      throw new Error(
        channelJson.error ||
        "Erro ao carregar canal"
      );

    }


const context = {
  title:
    channelJson.data?.channel?.snippet?.title ||
    channelJson.items?.[0]?.snippet?.channelTitle ||
    "",

  subscribers:
    channelJson.data?.metrics?.subscribers || 0,

  views:
    channelJson.data?.metrics?.totalChannelViews || 0,

  videoCount:
    channelJson.data?.metrics?.totalVideos || 0,

  views30:
    channelJson.data?.metrics?.views30 || 0,

  uploads30:
    channelJson.data?.metrics?.uploads30 || 0,

  videos:
    channelJson.items || []
};

console.log(
  "CONTEXT IA",
  JSON.stringify(context, null, 2)
);
    // ======================================================
    // 🤖 IA ANALISA O CANAL
    // ======================================================

    const response =
      await fetch(

        "https://tubex-backend.vercel.app/api/ai",

        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "x-client":
              "tubex-workspace"

          },



         body: JSON.stringify({
  tipo: "channel_analysis",
  context,
  channelId
})

        }

      );

    const json =
      await response.json();

console.log(
  "AI RESPONSE:",
  JSON.stringify(json, null, 2)
);

    if (!response.ok) {

      throw new Error(

        json.error ||

        "Erro ao analisar"

      );

    }

    setResult(json);

sessionStorage.setItem(
  "tubex-analytics-result",
  JSON.stringify(json)
);

  }

  catch (err: any) {

    console.error(err);

    setError(

      err.message ||

      "Erro desconhecido"

    );

  }

  finally {

    setLoading(false);

  }

}
  /* ======================================================
     SCORE COLOR
  ====================================================== */

  const scoreColor =
    useMemo(() => {

      if (!result)
        return "text-white";

      if (result.score >= 90)
        return "text-green-400";

      if (result.score >= 70)
        return "text-yellow-400";

      return "text-red-400";

    }, [result]);

  /* ======================================================
     COPY BUTTON
  ====================================================== */

  function renderCopyButton(
    text: string,
    id: string
  ) {

    return (

      <button

        onClick={() =>
          copy(text, id)
        }

        className="
          flex
          items-center
          gap-2
          border
          border-border
          rounded-xl
          px-3
          py-2
          hover:bg-muted
        "

      >

        {

          copied === id

          ?

          <Check size={15}/>

          :

          <Copy size={15}/>

        }

        {

          copied === id

          ?

          "Copiado"

          :

          "Copiar"

        }

      </button>

    );

  }

  return (


<div className="space-y-8">

  {/* ====================================================== */}
  {/* HEADER */}
  {/* ====================================================== */}

  <div
    className="
      rounded-3xl
      border
      border-border
      bg-card
      p-8
    "
  >

    <div className="flex items-center gap-5">

      <div
        className="
          w-16
          h-16
          rounded-3xl
          bg-yellow-500/10
          flex
          items-center
          justify-center
        "
      >

        <BarChart3
          size={30}
        />

      </div>

      <div>

        <h1
          className="
            text-4xl
            font-black
          "
        >
          Analytics AI
        </h1>

        <p
          className="
            text-muted-foreground
            mt-1
          "
        >
          Analise seu canal e descubra exatamente o que está impedindo seu crescimento.
        </p>

      </div>

    </div>

    {/* ====================================================== */}
    {/* INPUT */}
    {/* ====================================================== */}

    <div
      className="
        flex
        flex-wrap
        gap-5
        mt-8
      "
    >

    <div
  className="
    flex-1
    min-w-[350px]
    bg-background
    border
    border-border
    rounded-2xl
    px-5
    py-4
    flex
    items-center
    gap-3
  "
>

  <Search
    size={18}
    className="text-muted-foreground"
  />

  <div
    className="
      flex
      items-center
      gap-3
    "
  >

    <div
      className="
        w-3
        h-3
        rounded-full
        bg-green-500
      "
    />

    <span>

      Canal conectado:

      <strong>
        {channelName || "Nenhum"}
      </strong>

    </span>

  </div>

</div>

<button

  onClick={analyzeChannel}

  disabled={loading}

  className="
    rounded-2xl
    px-10
    py-4
    bg-yellow-500
    text-black
    font-bold
  "

>

  {loading
    ? "Analisando..."
    : "Analisar Canal"}

</button>

    </div>

    {

      error &&

      <div
        className="
          mt-5
          text-red-500
        "
      >

        {error}

      </div>

    }

  </div>

  {/* ====================================================== */}
  {/* SCORE CARDS */}
  {/* ====================================================== */}

  {

    result && (

      <div
        className="
          grid
          xl:grid-cols-5
          md:grid-cols-2
          grid-cols-1
          gap-5
        "
      >

        {/* SCORE */}

        <div
          className="
            rounded-3xl
            border
            border-border
            bg-card
            p-6
          "
        >

          <p
            className="
              text-xs
              uppercase
              text-muted-foreground
            "
          >
            Score Geral
          </p>

          <h2
            className={`
              text-5xl
              font-black
              mt-4
              ${scoreColor}
            `}
          >

            {result.score}

          </h2>

        </div>

        {/* CTR */}

        <div
          className="
            rounded-3xl
            border
            border-border
            bg-card
            p-6
          "
        >

          <div className="flex items-center gap-2">

            <TrendingUp size={18}/>

            <span
              className="
                text-xs
                uppercase
                text-muted-foreground
              "
            >
              CTR Médio
            </span>

          </div>

          <h2
            className="
              text-4xl
              font-black
              mt-4
            "
          >

            {result.ctr}%

          </h2>

        </div>

        {/* RETENTION */}

        <div
          className="
            rounded-3xl
            border
            border-border
            bg-card
            p-6
          "
        >

          <div className="flex items-center gap-2">

            <Clock size={18}/>

            <span
              className="
                text-xs
                uppercase
                text-muted-foreground
              "
            >
              Retenção
            </span>

          </div>

          <h2
            className="
              text-4xl
              font-black
              mt-4
            "
          >

            {result.retention}%

          </h2>

        </div>

        {/* VIEWS */}

        <div
          className="
            rounded-3xl
            border
            border-border
            bg-card
            p-6
          "
        >

          <div className="flex items-center gap-2">

            <Eye size={18}/>

            <span
              className="
                text-xs
                uppercase
                text-muted-foreground
              "
            >
              Views 30 Dias
            </span>

          </div>

          <h2
            className="
              text-4xl
              font-black
              mt-4
            "
          >

            {result.views30Days.toLocaleString()}

          </h2>

        </div>

       {/* SUBSCRIBERS */}

<div
  className="
    rounded-3xl
    border
    border-border
    bg-card
    p-6
  "
>

  <div className="flex items-center gap-2">

    <Users size={18}/>

    <span
      className="
        text-xs
        uppercase
        text-muted-foreground
      "
    >
      Inscritos
    </span>

  </div>

  <h2
    className="
      text-4xl
      font-black
      mt-4
    "
  >
    {result.subscribers?.toLocaleString() || 0}
  </h2>

</div>

      </div>

    )

  }

  {/* ====================================================== */}
  {/* AI ANALYSIS */}
  {/* ====================================================== */}

  {

    result && (

      <div
        className="
          grid
          xl:grid-cols-3
          gap-5
        "
      >

        {/* ============================================= */}
        {/* STRENGTHS */}
        {/* ============================================= */}

        <div
          className="
            rounded-3xl
            border
            border-green-500/20
            bg-card
            p-7
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
              mb-6
            "
          >

            <h3
              className="
                text-2xl
                font-black
                text-green-400
              "
            >
              Pontos Fortes
            </h3>

            {

              renderCopyButton(
                result.strengths.join("\n"),
                "strengths"
              )

            }

          </div>

          <div
            className="
              space-y-4
            "
          >

            {

              result.strengths.map(

                (
                  item,
                  index
                ) => (

                  <div

                    key={`strength-${index}`}

                    className="
                      rounded-2xl
                      border
                      border-green-500/10
                      bg-green-500/5
                      p-4
                    "

                  >

                    <div
                      className="
                        flex
                        items-start
                        gap-3
                      "
                    >

                      <Check
                        size={18}
                        className="
                          text-green-400
                          mt-1
                        "
                      />

                      <span
                        className="
                          leading-7
                        "
                      >
                        {item}
                      </span>

                    </div>

                  </div>

                )

              )

            }

          </div>

        </div>

        {/* ============================================= */}
        {/* WEAKNESSES */}
        {/* ============================================= */}

        <div
          className="
            rounded-3xl
            border
            border-red-500/20
            bg-card
            p-7
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
              mb-6
            "
          >

            <h3
              className="
                text-2xl
                font-black
                text-red-400
              "
            >
              Pontos Fracos
            </h3>

            {

              renderCopyButton(
                result.weaknesses.join("\n"),
                "weaknesses"
              )

            }

          </div>

          <div
            className="
              space-y-4
            "
          >

            {

              result.weaknesses.map(

                (
                  item,
                  index
                ) => (

                  <div

                    key={`weak-${index}`}

                    className="
                      rounded-2xl
                      border
                      border-red-500/10
                      bg-red-500/5
                      p-4
                    "

                  >

                    <div
                      className="
                        flex
                        items-start
                        gap-3
                      "
                    >

                      <Sparkles
                        size={18}
                        className="
                          text-red-400
                          mt-1
                        "
                      />

                      <span
                        className="
                          leading-7
                        "
                      >
                        {item}
                      </span>

                    </div>

                  </div>

                )

              )

            }

          </div>

        </div>

        {/* ============================================= */}
        {/* OPPORTUNITIES */}
        {/* ============================================= */}

        <div
          className="
            rounded-3xl
            border
            border-yellow-500/20
            bg-card
            p-7
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
              mb-6
            "
          >

            <h3
              className="
                text-2xl
                font-black
                text-yellow-400
              "
            >
              Oportunidades
            </h3>

            {

              renderCopyButton(
                result.opportunities.join("\n"),
                "opportunities"
              )

            }

          </div>

          <div
            className="
              space-y-4
            "
          >

            {

              result.opportunities.map(

                (
                  item,
                  index
                ) => (

                  <div

                    key={`opp-${index}`}

                    className="
                      rounded-2xl
                      border
                      border-yellow-500/10
                      bg-yellow-500/5
                      p-4
                    "

                  >

                    <div
                      className="
                        flex
                        items-start
                        gap-3
                      "
                    >

                      <TrendingUp
                        size={18}
                        className="
                          text-yellow-400
                          mt-1
                        "
                      />

                      <span
                        className="
                          leading-7
                        "
                      >
                        {item}
                      </span>

                    </div>

                  </div>

                )

              )

            }

          </div>

        </div>

      </div>

    )

  }

  {/* ====================================================== */}
  {/* NEXT VIDEOS + RECOMMENDATIONS */}
  {/* ====================================================== */}

  {

    result && (

      <div
        className="
          grid
          xl:grid-cols-2
          gap-5
        "
      >

        {/* ============================================= */}
        {/* NEXT VIDEOS */}
        {/* ============================================= */}

        <div
          className="
            rounded-3xl
            border
            border-border
            bg-card
            p-7
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
              mb-6
            "
          >

            <div>

              <p
                className="
                  text-xs
                  uppercase
                  text-muted-foreground
                "
              >
                Sugestões da IA
              </p>

              <h3
                className="
                  text-2xl
                  font-black
                  mt-2
                "
              >
                Próximos Vídeos
              </h3>

            </div>

            {

              renderCopyButton(
                result.nextVideos.join("\n"),
                "next-videos"
              )

            }

          </div>

          <div
            className="
              space-y-4
            "
          >

            {

              result.nextVideos.map(

                (
                  item,
                  index
                ) => (

                  <div

                    key={`video-${index}`}

                    className="
                      rounded-2xl
                      border
                      border-border
                      bg-background
                      p-5
                      flex
                      items-start
                      gap-4
                    "

                  >

                    <div
                      className="
                        min-w-[42px]
                        h-[42px]
                        rounded-xl
                        bg-blue-500/10
                        text-blue-400
                        font-black
                        flex
                        items-center
                        justify-center
                      "
                    >

                      {index + 1}

                    </div>

                    <div
                      className="
                        leading-7
                        flex-1
                      "
                    >

                      {item}

                    </div>

                  </div>

                )

              )

            }

          </div>

        </div>

        {/* ============================================= */}
        {/* RECOMMENDATIONS */}
        {/* ============================================= */}

        <div
          className="
            rounded-3xl
            border
            border-border
            bg-card
            p-7
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
              mb-6
            "
          >

            <div>

              <p
                className="
                  text-xs
                  uppercase
                  text-muted-foreground
                "
              >
                Consultoria IA
              </p>

              <h3
                className="
                  text-2xl
                  font-black
                  mt-2
                "
              >
                Recomendações Estratégicas
              </h3>

            </div>

            {

              renderCopyButton(
                result.recommendations.join("\n"),
                "recommendations"
              )

            }

          </div>

          <div
            className="
              space-y-4
            "
          >

            {

              result.recommendations.map(

                (
                  item,
                  index
                ) => (

                  <div

                    key={`recommendation-${index}`}

                    className="
                      rounded-2xl
                      border
                      border-border
                      bg-background
                      p-5
                    "

                  >

                    <div
                      className="
                        flex
                        items-start
                        gap-4
                      "
                    >

                      <Sparkles
                        size={18}
                        className="
                          text-yellow-400
                          mt-1
                        "
                      />

                      <div
                        className="
                          leading-7
                          flex-1
                        "
                      >

                        {item}

                      </div>

                    </div>

                  </div>

                )

              )

            }

          </div>

        </div>

      </div>

    )

  }

  {/* ====================================================== */}
  {/* PREMIUM INSIGHT */}
  {/* ====================================================== */}

  {

    result && (

      <div
        className="
          rounded-3xl
          border
          border-yellow-500/20
          bg-card
          p-8
        "
      >

        <div
          className="
            flex
            items-center
            gap-3
            mb-5
          "
        >

          <Sparkles
            size={22}
            className="
              text-yellow-400
            "
          />

          <h3
            className="
              text-2xl
              font-black
            "
          >
            Resumo da IA
          </h3>

        </div>

        <div
          className="
            rounded-2xl
            border
            border-border
            bg-background
            p-6
          "
        >

          <p
            className="
              text-lg
              leading-8
            "
          >

            Seu canal possui score de{" "}
            <strong>{result.score}</strong>.

            {

              result.score >= 90

              ?

              " O canal está em excelente estado e possui alto potencial de crescimento."

              :

              result.score >= 70

              ?

              " O canal possui uma base sólida, mas existem oportunidades claras de otimização."

              :

              " O canal precisa de ajustes em conteúdo, CTR e retenção para acelerar o crescimento."

            }

          </p>

        </div>

      </div>

    )

  }

</div>

);
}