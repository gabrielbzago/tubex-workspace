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
  BarChart3,
  Activity,
  Loader2,
  Check
} from "lucide-react";



/* ======================================================
   TYPES
====================================================== */

interface SeoWorkspaceResponse{

success:boolean;

score:number;

volume:{
nivel:string;
score:number;
explicacao:string;
};

competition:{
nivel:string;
score:number;
explicacao:string;
};

difficulty:number;

keywordIntent:string;

searchIntent:string;

ctrPrediction:string;
ctrExplanation:string;

chanceRanking:string;
chanceExplanation:string;

optimizedTitle:string;

description:string;

tags:string[];

hashtags:string[];

longTail:string[];

relatedKeywords:string[];

recommendations:string[];

}
/* ======================================================
   COMPONENT
====================================================== */

export default function SeoAI() {

  const [keyword, setKeyword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [copied, setCopied] =
    useState("");

  const [result, setResult] =
    useState<SeoWorkspaceResponse | null>(null);


/* ======================================================
   RESTORE SESSION
====================================================== */

useEffect(() => {

  const savedKeyword =
    sessionStorage.getItem(
      "tubex-seo-keyword"
    );

  const savedResult =
    sessionStorage.getItem(
      "tubex-seo-workspace"
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
        "tubex-seo-workspace"
      );

    }

  }

}, []);

  /* ======================================================
     COPY
  ====================================================== */

  async function copy(text: string, id: string) {

    try {

      await navigator.clipboard.writeText(text);

      setCopied(id);

      setTimeout(() => {

        setCopied("");

      }, 1800);

    }

    catch {

      alert("Não foi possível copiar.");

    }

  }

 
/* ======================================================
   API
====================================================== */

async function generateSEO() {

  if (!keyword.trim() || loading) return;

  setLoading(true);
  setError("");
  setResult(null);

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 60000);

  try {

const ytResponse = await fetch(
  "https://tubex-backend.vercel.app/api/youtube",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "tubex_secure_2026_ultra"
    },
    body: JSON.stringify({
      keyword: keyword.trim(),
      mode: "seo",
      plan: "pro"
    })
  }
);

const ytData = await ytResponse.json();

console.log("YOUTUBE SEO", ytData);

    const response = await fetch(
      "https://tubex-backend.vercel.app/api/ai",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-client": "tubex-workspace"
        },
  body: JSON.stringify({

    tipo:"seo_workspace",

    keyword:keyword.trim(),

    prompt:keyword.trim(),

    youtube:ytData,

    userId:"workspace",

    channelId:"workspace"

})
      }
    );

    clearTimeout(timeout);

    const text = await response.text();

    console.log("[SEO Workspace] Status:", response.status);
    console.log("[SEO Workspace] Response:", text);

    let json: any;

    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("Resposta inválida do servidor.");
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
        "Falha ao gerar SEO."
      );
    }
console.log("========== JSON IA ==========");
console.dir(json, { depth: null });

console.log("========== YOUTUBE ==========");
console.dir(ytData, { depth: null });
const volumeScore =
Number(json.volume?.score || 0);

const competitionScore =
Number(json.competition?.score || 0);

const seoScore =
Math.round(
(volumeScore * 0.65) +
((100 - competitionScore) * 0.35)
);

const difficulty =
Math.round(
competitionScore * 0.75 +
(100 - volumeScore) * 0.25
);

const seoResult = {

success:true,

score: seoScore,

  volume: {
    nivel: json.volume?.nivel ?? "",
    score: Number(json.volume?.score ?? 0),
    explicacao: json.volume?.explicacao ?? ""
  },

  competition: {
    nivel: json.competition?.nivel ?? "",
    score: Number(json.competition?.score ?? 0),
    explicacao: json.competition?.explicacao ?? ""
  },

  difficulty,

  keywordIntent: json.keywordIntent ?? "",

  searchIntent: json.searchIntent ?? "",

ctrPrediction:
  json.ctrPrediction ?? "",

ctrExplanation:
  json.ctrExplanation ?? "",

chanceRanking:
  json.chanceRanking ?? "",

chanceExplanation:
  json.chanceExplanation ?? "",

  optimizedTitle:
    json.optimizedTitle ??
    json.tituloOtimizado ??
    "",

  description:
    json.description ??
    json.descricao ??
    "",

  tags:
    json.tags ?? [],

  hashtags:
    json.hashtags ?? [],

  longTail:
    json.longTail ??
    json.longTails ??
    [],

  relatedKeywords:
    json.relatedKeywords ??
    json.palavrasRelacionadas ??
    [],

  recommendations:
    json.recommendations ??
    json.recomendacoes ??
    []
};

    setResult(seoResult);
console.log("SEO RESULT", seoResult);
sessionStorage.setItem(
  "tubex-seo-workspace",
  JSON.stringify(seoResult)
);

sessionStorage.setItem(
  "tubex-seo-keyword",
  keyword
);

  } catch (err: any) {

    console.error("[SEO Workspace]", err);

    if (err.name === "AbortError") {
      setError("Tempo limite excedido.");
    } else {
      setError(
        err.message ||
        "Erro ao conectar ao servidor."
      );
    }

  } finally {

    clearTimeout(timeout);
    setLoading(false);

  }

}

  /* ======================================================
     COLORS
  ====================================================== */

  const scoreColor = useMemo(() => {

    if (!result)
      return "text-white";

    if (result.score >= 90)
      return "text-green-400";

    if (result.score >= 70)
      return "text-yellow-400";

    return "text-red-400";

  }, [result]);

  const difficultyColor = useMemo(() => {

    if (!result)
      return "text-white";

    if (result.difficulty <= 35)
      return "text-green-400";

    if (result.difficulty <= 70)
      return "text-yellow-400";

    return "text-red-400";

  }, [result]);

  const volumeColor = useMemo(() => {

    if (!result)
      return "text-white";

    const score =
      result.volume?.score || 0;

    if (score >= 80)
      return "text-green-400";

    if (score >= 50)
      return "text-yellow-400";

    return "text-red-400";

  }, [result]);

  const competitionColor = useMemo(() => {

    if (!result)
      return "text-white";

    const score =
      result.competition?.score || 0;

    if (score <= 35)
      return "text-green-400";

    if (score <= 70)
      return "text-yellow-400";

    return "text-red-400";

  }, [result]);


function getSeoLabel(score:number){

    if(score >= 90)
        return "Excelente";

    if(score >= 75)
        return "Muito Bom";

    if(score >= 60)
        return "Bom";

    if(score >= 40)
        return "Regular";

    return "Ruim";

}

function getDifficultyLabel(score:number){

    if(score <= 30)
        return "Fácil";

    if(score <= 60)
        return "Moderada";

    return "Difícil";

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
          bg-primary/10
          flex
          items-center
          justify-center
        "
      >

        <Sparkles
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
          SEO Workspace
        </h1>

        <p
          className="
            text-muted-foreground
            mt-1
          "
        >
          Inteligência Artificial para análise completa de SEO no YouTube.
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

          placeholder="Digite uma palavra-chave..."

          className="
            bg-transparent
            outline-none
            w-full
            text-lg
          "

        />

      </div>

      <button

        onClick={generateSEO}

        disabled={loading}

        className="
          rounded-2xl
          px-10
          py-4
          bg-yellow-400
          text-black
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

            Analisando...

          </span>

          :

          "Gerar SEO"

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
          xl:grid-cols-6
          md:grid-cols-3
          grid-cols-2
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
            SEO SCORE
          </p>

         <div className="mt-4">

<GaugeComponent
type="semicircle"
value={result.score}
minValue={0}
maxValue={100}

arc={{
subArcs:[
{limit:35,color:"#ef4444"},
{limit:70,color:"#facc15"},
{limit:100,color:"#22c55e"}
]
}}

pointer={{
elastic:true,
color:"#ffffff"
}}

labels={{
valueLabel:{
style:{
fontSize:"42px",
fill:"#ffffff",
fontWeight:"700"
},
formatTextValue:(v)=>`${Math.round(v)}`
},
tickLabels:{
hideMinMax:true
}
}}

style={{
width:"100%"
}}
/>

<div className="mt-2 text-center">

<p
className="text-sm text-muted-foreground"
>

Ruim
<span className="mx-10"></span>
Excelente

</p>

<p
className="mt-2 text-lg font-bold text-yellow-400"
>

{getSeoLabel(result.score)}

</p>

</div>

</div>
</div>
        {/* VOLUME */}

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
              Volume
            </span>

          </div>

        <div className="mt-6">

<div className="flex justify-between text-sm mb-2">

{result.volume.nivel}

<span className="text-xs text-muted-foreground">

&nbsp;• Volume de Busca

</span>

<span>{result.volume.score}/100</span>


</div>

<div className="h-3 rounded-full bg-zinc-800">

<div

className="h-3 rounded-full bg-green-500"

style={{

width:`${result.volume.score}%`

}}

/>

</div>

</div>

          <p
            className="
              text-muted-foreground
              mt-2
            "
          >
            {result.volume?.score}/100
          </p>

        </div>

        {/* CONCORRÊNCIA */}

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

            <BarChart3 size={18}/>

            <span
              className="
                text-xs
                uppercase
                text-muted-foreground
              "
            >
              Concorrência
            </span>

          </div>

          <div className="mt-6">

<div className="flex justify-between text-sm mb-2">

{result.competition.nivel}

<span className="text-xs text-muted-foreground">

&nbsp;• Competição

</span>
<span>{result.competition.score.toFixed(0)}/100</span>

</div>

<div className="h-3 rounded-full bg-zinc-800">

<div

className="h-3 rounded-full bg-red-500"

style={{

width:`${result.competition.score}%`

}}

/>

</div>

</div>

          <p
            className="
              text-muted-foreground
              mt-2
            "
          >
            {result.competition?.score}/100
          </p>

        </div>

        {/* DIFICULDADE */}

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

            <Activity size={18}/>

            <span
              className="
                text-xs
                uppercase
                text-muted-foreground
              "
            >
              Difficulty
            </span>

          </div>

      <div className="mt-4">

<GaugeComponent
type="semicircle"
value={result.difficulty}
minValue={0}
maxValue={100}

arc={{
subArcs:[
{limit:35,color:"#22c55e"},
{limit:70,color:"#facc15"},
{limit:100,color:"#ef4444"}
]
}}

pointer={{
elastic:true,
color:"#ffffff"
}}

labels={{
valueLabel:{
style:{
fontSize:"44px",
fill:"#ffffff",
fontWeight:"700"
},
formatTextValue:(v)=>`${Math.round(v)}`
},
tickLabels:{
hideMinMax:true
}
}}

style={{
width:"100%"
}}
/>


<div className="mt-2 text-center">

<p
className="text-sm text-muted-foreground"
>

Fácil
<span className="mx-12"></span>
Difícil

</p>

<p
className={`
mt-2
text-lg
font-bold

${
result.difficulty <= 30

?

"text-green-400"

:

result.difficulty <= 60

?

"text-yellow-400"

:

"text-red-400"

}
`}
>

{getDifficultyLabel(result.difficulty)}

</p>

</div>

</div>

        </div>

       {/* CTR */}

<div
  className="
    rounded-3xl
    border
    border-border
    bg-card
    p-6
    flex
    flex-col
  "
>

  <div className="flex items-center gap-2">

    <Target size={18} />

    <span
      className="
        text-xs
        uppercase
        text-muted-foreground
      "
    >
      CTR
    </span>

  </div>

  <div className="mt-6">

    <div
      className="
        inline-flex
        px-5
        py-2
        rounded-full
        bg-blue-500/20
        text-blue-400
        font-bold
        text-xl
      "
    >
      {result.ctrPrediction}
    </div>

    <p
      className="
        mt-4
        text-sm
        leading-6
        text-muted-foreground
      "
    >
      {result.ctrExplanation}
    </p>

  </div>

</div>

{/* CHANCE RANKING */}

<div
  className="
    rounded-3xl
    border
    border-border
    bg-card
    p-6
    flex
    flex-col
  "
>

  <div className="flex items-center gap-2">

    <Sparkles size={18} />

    <span
      className="
        text-xs
        uppercase
        text-muted-foreground
      "
    >
      Chance Ranking
    </span>

  </div>

  <div className="mt-6">

    <div
      className="
        inline-flex
        px-5
        py-2
        rounded-full
        bg-green-500/20
        text-green-400
        font-bold
        text-xl
      "
    >
      {result.chanceRanking}
    </div>

    <p
      className="
        mt-4
        text-sm
        leading-6
        text-muted-foreground
      "
    >
      {result.chanceExplanation}
    </p>

  </div>

</div>
</div>
      {/* ====================================================== */}
      {/* SEO TITLE */}
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
              Título otimizado
            </p>

            <h3
              className="
                text-2xl
                font-black
                mt-2
              "
            >
              {result.optimizedTitle}
            </h3>

          </div>

          {renderCopyButton(
            result.optimizedTitle,
            "title"
          )}

        </div>

      </div>

      {/* ====================================================== */}
      {/* DESCRIPTION */}
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
            mb-5
          "
        >

          <p
            className="
              text-xs
              uppercase
              text-muted-foreground
            "
          >
            Descrição SEO
          </p>

          {renderCopyButton(
            result.description,
            "description"
          )}

        </div>

        <div
          className="
            whitespace-pre-line
            leading-8
            text-[15px]
          "
        >

          {result.description}

        </div>

      </div>

      {/* ====================================================== */}
      {/* TAGS */}
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
            mb-5
          "
        >

          <p
            className="
              text-xs
              uppercase
              text-muted-foreground
            "
          >
            Tags YouTube
          </p>

        {renderCopyButton(
  (result.tags ?? []).join(", "),
  "tags"
)}

        </div>

        <div
          className="
            flex
            flex-wrap
            gap-3
          "
        >

        {(result.tags ?? []).map((tag:string,index:number)=>(

            <div
              key={`${tag}-${index}`}
              className="
                px-4
                py-2
                rounded-xl
                bg-background
                border
                border-border
                text-sm
                font-semibold
              "
            >

              {tag}

            </div>

          ))}

        </div>

      </div>

      {/* ====================================================== */}
      {/* HASHTAGS */}
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
            mb-5
          "
        >

          <p
            className="
              text-xs
              uppercase
              text-muted-foreground
            "
          >
            Hashtags
          </p>

          {renderCopyButton(
            (result.hashtags ?? []).join(" "),
            "hashtags"
          )}

        </div>

        <div
          className="
            flex
            flex-wrap
            gap-3
          "
        >

          {(result.hashtags ?? []).map((tag) => (

            <div
              key={tag}
              className="
                px-4
                py-2
                rounded-xl
                bg-yellow-400
                text-black
                font-bold
              "
            >

              {tag}

            </div>

          ))}

        </div>

      </div>

      {/* ====================================================== */}
      {/* LONG TAIL */}
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

        <h3
          className="
            text-xl
            font-black
            mb-5
          "
        >
          Palavras-chave Long Tail
        </h3>

        <div
          className="
            grid
            md:grid-cols-2
            gap-3
          "
        >

{(result.longTail ?? []).map((item) => (

            <div
              key={item}
              className="
                rounded-xl
                border
                border-border
                bg-background
                p-4
              "
            >

              {item}

            </div>

          ))}

        </div>

      </div>

      {/* ====================================================== */}
      {/* RELATED */}
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

        <h3
          className="
            text-xl
            font-black
            mb-5
          "
        >
          Palavras Relacionadas
        </h3>

        <div
          className="
            flex
            flex-wrap
            gap-3
          "
        >

          {(result.relatedKeywords ?? []).map((item) => (

            <div
              key={item}
              className="
                px-4
                py-2
                rounded-xl
                bg-background
                border
                border-border
              "
            >

              {item}

            </div>

          ))}

        </div>

      </div>

      {/* ====================================================== */}
      {/* RECOMENDAÇÕES */}
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

        <h3
          className="
            text-xl
            font-black
            mb-6
          "
        >
          Recomendações da IA
        </h3>

        <ul
          className="
            space-y-4
          "
        >

          {(result.recommendations ?? []).map((item) => (

            <li
              key={item}
              className="
                flex
                items-start
                gap-3
              "
            >

              <Check
                size={18}
                className="
                  mt-1
                  text-green-400
                "
              />

              <span>

                {item}

              </span>

            </li>

          ))}

        </ul>

      </div>

      </>

    )

  }

</div>

);

}