"use client";

import {
  useMemo,
  useState,
  useEffect
} from "react";

import GaugeComponent from "react-gauge-component";

import {
  Sparkles,
  Search,
  Copy,
  TrendingUp,
  Target,
  Loader2,
  Check
} from "lucide-react";

/* ======================================================
   TYPES
====================================================== */

interface ViralContentResponse {

  success: boolean;

  viralScore: number;

  emotionScore: number;

  curiosityScore: number;

  shareScore: number;

  viralTitles:{
title:string;
score:number;
ctr:number;
emotion:number;
curiosity:number;
share:number;
reason:string;
}[];

 

  thumbnailIdeas: string[];

  viralAngles: string[];

  audienceTriggers: string[];

  recommendations: string[];

}


interface UserData {
  id?: string;
  email?: string;
  name?: string;
  youtube_channel_id?: string | null;
}

interface ViralContentProps {
  userData?: UserData | null;
}

/* ======================================================
   COMPONENT
====================================================== */

export default function ViralContent({
  userData,
}: ViralContentProps) {

  const [keyword, setKeyword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [copied, setCopied] =
    useState("");

  const [result, setResult] =
    useState<ViralContentResponse | null>(null);

/* ======================================================
   RESTORE SESSION
====================================================== */

useEffect(() => {

  const savedKeyword =
    sessionStorage.getItem(
      "tubex-viral-keyword"
    );

  const savedResult =
    sessionStorage.getItem(
      "tubex-viral-result"
    );

  if (savedKeyword) {
    setKeyword(savedKeyword);
  }

  if (savedResult) {

    try {

      setResult(
        JSON.parse(savedResult)
      );

    } catch {

      sessionStorage.removeItem(
        "tubex-viral-result"
      );

    }

  }

}, []);

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

      }, 1800);

    }

    catch {

      alert(
        "Não foi possível copiar."
      );

    }

  }

  /* ======================================================
     API
  ====================================================== */

  async function generateViralContent() {

    if (!keyword.trim() || loading)
      return;

    setLoading(true);
    setError("");
    setResult(null);

sessionStorage.removeItem(
  "tubex-viral-result"
);

sessionStorage.removeItem(
  "tubex-viral-keyword"
);

    const controller =
      new AbortController();

    const timeout =
      setTimeout(() => {

        controller.abort();

      }, 60000);

    try {

      const response =
        await fetch(

          "https://tubex-backend.vercel.app/api/ai",

          {

            method: "POST",

            signal:
              controller.signal,

            headers: {

              "Content-Type":
                "application/json",

              "x-client":
                "tubex-workspace"

            },

            body: JSON.stringify({

              tipo:
                "viral_content",

              prompt:
                keyword.trim(),

          userId:
  userData?.id ??
  "workspace",

channelId:
  userData?.youtube_channel_id ??
  "workspace"

            })

          }

        );

      clearTimeout(timeout);

      const text =
        await response.text();

      console.log(
        "[VIRAL CONTENT] Status:",
        response.status
      );

      console.log(
        "[VIRAL CONTENT] Response:",
        text
      );

      let json: any;

      try {

        json =
          JSON.parse(text);

      }

      catch {

        throw new Error(
          "Resposta inválida do servidor."
        );

      }

      if (!response.ok) {

        throw new Error(

          json.error ||

          json.message ||

          `Erro HTTP ${response.status}`

        );

      }

      if (!json.success) {

        throw new Error(

          json.error ||

          "Falha ao gerar conteúdo viral."

        );

      }

   setResult(json);

sessionStorage.setItem(
  "tubex-viral-result",
  JSON.stringify(json)
);

sessionStorage.setItem(
  "tubex-viral-keyword",
  keyword
);

    }

    catch (err: any) {

      console.error(
        "[VIRAL CONTENT]",
        err
      );

      if (
        err.name ===
        "AbortError"
      ) {

        setError(
          "Tempo limite excedido."
        );

      }

      else {

        setError(

          err.message ||

          "Erro ao conectar ao servidor."

        );

      }

    }

    finally {

      clearTimeout(timeout);

      setLoading(false);

    }

  }

  /* ======================================================
     COLORS
  ====================================================== */

  const viralColor = useMemo(() => {

    if (!result)
      return "text-white";

    if (result.viralScore >= 90)
      return "text-green-400";

    if (result.viralScore >= 70)
      return "text-yellow-400";

    return "text-red-400";

  }, [result]);

  const emotionColor = useMemo(() => {

    if (!result)
      return "text-white";

    if (result.emotionScore >= 90)
      return "text-green-400";

    if (result.emotionScore >= 70)
      return "text-yellow-400";

    return "text-red-400";

  }, [result]);

  const curiosityColor = useMemo(() => {

    if (!result)
      return "text-white";

    if (result.curiosityScore >= 90)
      return "text-green-400";

    if (result.curiosityScore >= 70)
      return "text-yellow-400";

    return "text-red-400";

  }, [result]);

  const shareColor = useMemo(() => {

    if (!result)
      return "text-white";

    if (result.shareScore >= 90)
      return "text-green-400";

    if (result.shareScore >= 70)
      return "text-yellow-400";

    return "text-red-400";

  }, [result]);


function getLevel(score:number){

if(score>=90)
return{
text:"Explosivo",
color:"text-green-400"
}

if(score>=75)
return{
text:"Muito Alto",
color:"text-green-300"
}

if(score>=60)
return{
text:"Alto",
color:"text-yellow-400"
}

if(score>=40)
return{
text:"Médio",
color:"text-orange-400"
}

return{
text:"Baixo",
color:"text-red-400"
}

}

function ScoreGauge({

title,

value,

label

}:{

title:string

value:number

label:string

}){

return(

<div
className="
rounded-3xl
border
border-border
bg-card
p-6
">

<p
className="
text-xs
uppercase
text-muted-foreground
mb-4
">

{title}

</p>

<div className="flex justify-center">

<GaugeComponent

type="radial"

value={value}

minValue={0}

maxValue={100}

arc={{

subArcs:[

{
limit:40,
color:"#ef4444"
},

{
limit:70,
color:"#facc15"
},

{
color:"#22c55e"
}

]

}}

pointer={{

color:"#fff",

length:0.72,

width:12

}}

labels={{

valueLabel:{

style:{

fill:"#fff",

fontSize:"26px",

fontWeight:"bold"

}

}

}}

style={{

width:"180px"

}}

/>

</div>

<div
className="
mt-2
text-center
font-bold
text-yellow-400
">

{label}

</div>

</div>

)

}
  /* ======================================================
     HELPERS
  ====================================================== */

  function renderCopyButton(

    text: string,

    id: string

  ) {

    return (

      <button

        onClick={() => copy(text, id)}

        className="
          flex
          items-center
          gap-2
          text-sm
          px-3
          py-2
          rounded-xl
          border
          border-border
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

/* ======================================================
   RETURN
====================================================== */

return (

  <div className="space-y-8">

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
      bg-red-500/10
      flex
      items-center
      justify-center
    "
  >

    <Sparkles size={30} />

  </div>

  <div>

    <h1
      className="
        text-4xl
        font-black
      "
    >
      Viral Content (Recomendação do Algoritmo) AI
    </h1>

    <p
      className="
        text-muted-foreground
        mt-1
      "
    >
      Descubra títulos, ideias e gatilhos com potencial de viralização.
    </p>

  </div>

</div>
    {/* =============================================== */}
    {/* INPUT */}
    {/* =============================================== */}

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
          className="
            text-muted-foreground
          "
        />

        <input

          value={keyword}

          onChange={(e)=>
            setKeyword(
              e.target.value
            )
          }

          placeholder="Digite um tema ou ideia..."

          className="
            bg-transparent
            outline-none
            w-full
            text-lg
          "

        />

      </div>

      <button

        onClick={
          generateViralContent
        }

        disabled={loading}

        className="
          rounded-2xl
          px-10
          py-4
          bg-red-500
          text-white
          font-bold
          hover:opacity-90
          disabled:opacity-50
          transition-all
        "

      >

        {

          loading

          ?

          <span className="flex items-center gap-2">

            <Loader2
              size={18}
              className="animate-spin"
            />

            Gerando...

          </span>

          :

          "Gerar Viral"

        }

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
{/* RESULTADOS */}
{/* ====================================================== */}

{

  result && (

    <>

      <div
        className="
          grid
          xl:grid-cols-4
          md:grid-cols-2
          grid-cols-1
          gap-5
        "
      >

        {/* VIRAL SCORE */}

       <ScoreGauge

title="Viral Score"

value={result.viralScore}

label={getLevel(result.viralScore).text}

/>

        {/* EMOTION */}

<ScoreGauge

title="Emotion"

value={result.emotionScore}

label={getLevel(result.emotionScore).text}

/>

        {/* CURIOSITY */}

     <ScoreGauge

title="Curiosity"

value={result.curiosityScore}

label={getLevel(result.curiosityScore).text}

/>

        {/* SHARE */}

       <ScoreGauge

title="Share"

value={result.shareScore}

label={getLevel(result.shareScore).text}

/>

     

      </div>

      {/* ====================================================== */}
      {/* VIRAL TITLE */}
      {/* ====================================================== */}

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
            mb-5
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
              Título Viral Principal
            </p>

            <h3
              className="
                text-3xl
                font-black
                mt-3
                leading-tight
              "
            >

              {result.viralTitles[0]?.title}

            </h3>

          </div>

          {renderCopyButton(
            result.viralTitles[0]?.title,
            "viral-title"
          )}

        </div>

        <div
          className="
            mt-6
            rounded-2xl
            bg-red-500/10
            border
            border-red-500/20
            p-5
          "
        >

          <div
            className="
              flex
              items-center
              gap-3
            "
          >

            <Sparkles
              size={18}
              className="
                text-red-400
              "
            />

            <span
              className="
                font-semibold
                text-red-400
              "
            >
              Melhor aposta de viralização da IA
            </span>

          </div>

          <p
            className="
              mt-3
              text-sm
              text-muted-foreground
              leading-7
            "
          >
            Este é o título com maior potencial de gerar
            curiosidade, emoção e clique segundo a análise
            da IA.
          </p>

        </div>

      </div>
      {/* ====================================================== */}
      {/* VIRAL TITLES */}
      {/* ====================================================== */}

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
              Títulos Virais Alternativos
            </p>

            <h3
              className="
                text-2xl
                font-black
                mt-2
              "
            >
              Variações com potencial de viralização
            </h3>

          </div>

          {renderCopyButton(

result.viralTitles
.map(v=>v.title)
.join("\n"),

"viral-titles"

)}

        </div>

        <div
          className="
            space-y-4
          "
        >

          {

            result.viralTitles.map(

              (item,index)=>(

                <div

                  key={`${item.title}-${index}`}

                  className="
                    rounded-2xl
                    border
                    border-border
                    bg-background
                    p-5
                    flex
                    items-start
                    justify-between
                    gap-5
                  "

                >

                  <div
                    className="
                      flex
                      items-start
                      gap-4
                      flex-1
                    "
                  >

                  <div
className="
min-w-[42px]
h-[42px]
rounded-xl
bg-red-500/10
flex
items-center
justify-center
font-black
text-red-400
">

{index + 1}

</div>

<div className="flex-1">

{index === 0 && (

<div
className="
inline-flex
items-center
gap-2
px-3
py-1
rounded-full
bg-yellow-500/20
text-yellow-400
text-xs
font-bold
mb-3
"
>

🏆 Melhor escolha da IA

</div>

)}

<h3
className="
text-xl
font-bold
leading-8
"
>

{item.title}

</h3>


<div
className="
mt-4
flex
flex-wrap
gap-2
">

<span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">

SEO {item.score}

</span>

<span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs">

CTR {item.ctr}

</span>

<span className="px-3 py-1 rounded-full bg-pink-500/20 text-pink-400 text-xs">

Curiosidade {item.curiosity}

</span>

<span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs">

Emoção {item.emotion}

</span>

<span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs">

Share {item.share}

</span>
</div>
<p
className="
mt-4
text-sm
text-muted-foreground
leading-7
"
>

{item.reason}
</p>
</div>

                  </div>

                  <button

                    onClick={() =>
                     copy(
item.title,
`viral-${index}`
)
                    }

                    className="
                      px-3
                      py-2
                      rounded-xl
                      border
                      border-border
                      hover:bg-muted
                      transition-all
                    "

                  >

                    {

                      copied ===
                      `viral-${index}`

                      ?

                      <Check size={16}/>

                      :

                      <Copy size={16}/>

                    }

                  </button>

<div
className="
text-5xl
font-black
text-yellow-400
opacity-20
ml-4
"
>

#{index + 1}

</div>

                </div>

              )

            )

          }

        </div>

      </div>

      {/* ====================================================== */}
      {/* THUMBNAIL IDEAS */}
      {/* ====================================================== */}

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

          <h3
            className="
              text-2xl
              font-black
            "
          >
            Ideias de Thumbnail
          </h3>

          {renderCopyButton(
            result.thumbnailIdeas.join("\n"),
            "thumbs"
          )}

        </div>

        <div
          className="
            grid
            md:grid-cols-2
            gap-4
          "
        >

          {

            result.thumbnailIdeas.map(

              (
                item,
                index
              ) => (

                <div

                  key={`${item}-${index}`}

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
                      text-xs
                      uppercase
                      text-red-400
                      font-bold
                      mb-3
                    "
                  >
                    Thumbnail #{index + 1}
                  </div>

                  <div
                    className="
                      leading-7
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

      {/* ====================================================== */}
      {/* VIRAL ANGLES */}
      {/* ====================================================== */}

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

          <h3
            className="
              text-2xl
              font-black
            "
          >
            Ângulos Virais
          </h3>

          {renderCopyButton(
            result.viralAngles.join("\n"),
            "angles"
          )}

        </div>

        <div
          className="
            space-y-4
          "
        >

          {

            result.viralAngles.map(

              (
                item,
                index
              ) => (

                <div

                  key={`${item}-${index}`}

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
                      items-center
                      gap-3
                    "
                  >

                    <Target
                      size={16}
                      className="
                        text-red-400
                      "
                    />

                    <span
                      className="
                        font-semibold
                      "
                    >
                      Ângulo {index + 1}
                    </span>

                  </div>

                  <div
                    className="
                      mt-3
                      leading-7
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

      {/* ====================================================== */}
      {/* AUDIENCE TRIGGERS */}
      {/* ====================================================== */}

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

          <h3
            className="
              text-2xl
              font-black
            "
          >
            Gatilhos de Audiência
          </h3>

          {renderCopyButton(
            result.audienceTriggers.join("\n"),
            "triggers"
          )}

        </div>

        <div
          className="
            grid
            md:grid-cols-2
            gap-4
          "
        >

          {

            result.audienceTriggers.map(

              (
                item,
                index
              ) => (

                <div

                  key={`${item}-${index}`}

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
                      text-xs
                      uppercase
                      text-yellow-400
                      font-bold
                      mb-3
                    "
                  >
                    Trigger #{index + 1}
                  </div>

                  <div
                    className="
                      leading-7
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

      {/* ====================================================== */}
      {/* RECOMMENDATIONS */}
      {/* ====================================================== */}

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

          <h3
            className="
              text-2xl
              font-black
            "
          >
            Recomendações da IA
          </h3>

          {renderCopyButton(
            result.recommendations.join("\n"),
            "recommendations"
          )}

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

                  key={`${item}-${index}`}

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
                      min-w-[36px]
                      h-[36px]
                      rounded-xl
                      bg-green-500/10
                      flex
                      items-center
                      justify-center
                    "
                  >

                    <Check
                      size={16}
                      className="
                        text-green-400
                      "
                    />

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

      </>

    )

  }

</div>

);

}
