"use client";

import { useState } from "react";
import Image from "next/image";

import {
  Sparkles,
  Wand2,
  Loader2,
  Download,
  Copy,
  Heart,
  Image as ImageIcon
} from "lucide-react";



/* ======================================================
   TYPES
====================================================== */

interface ThumbnailResult {
  id: string;
  url: string;
  revisedPrompt?: string;
}

/* ======================================================
   COMPONENT
====================================================== */

export default function ThumbnailAI({
  userData,
}: any) {

  /* ======================================================
     STATES
  ====================================================== */

  const [prompt, setPrompt] = useState("");

  const [loading, setLoading] = useState(false);
const [improvingPrompt, setImprovingPrompt] = useState(false);

  const [error, setError] = useState("");

  const [images, setImages] = useState<ThumbnailResult[]>([]);

  const [quantity, setQuantity] = useState(1);

  const [quality, setQuality] = useState("high");

const AI_API =
"https://tubex-backend.vercel.app/api/ai";

const IMAGE_API =
"https://tubex-backend.vercel.app/api/image";

const currentPlan = userData?.plan || "free";

const isExpert =
  currentPlan.toLowerCase() === "expert";

  /* ======================================================
     GERAR THUMBNAIL
     (implementaremos na Parte 2)
  ====================================================== */
/* ======================================================
   MELHORAR PROMPT COM IA
====================================================== */

async function improvePrompt() {

  if (!isExpert) {

    setError(
      "Thumbnail AI é exclusivo do plano Expert."
    );

    return;

  }

  if (!prompt.trim()) {

    setError(
      "Digite um prompt primeiro."
    );

    return;

  }

  setImprovingPrompt(true);

  setError("");

  try {

    const response = await fetch(AI_API, {

      method: "POST",

      headers: {

        "Content-Type": "application/json",

        "x-client": "tubex-workspace",

      },

      body: JSON.stringify({

        tipo: "thumbnail_prompt",

        prompt: prompt.trim(),

        userId: "workspace",

        channelId: "workspace",

      }),

    });

    const json = await response.json();

    if (!response.ok) {

      throw new Error(

        json.error ||

        "Erro ao melhorar prompt."

      );

    }

    if (!json.success) {

      throw new Error(

        json.error ||

        "Falha da IA."

      );

    }

    setPrompt(

      json.prompt ||

      json.text ||

      prompt

    );

  } catch (err: any) {

    console.error(err);

    setError(

      err.message ||

      "Erro ao melhorar prompt."

    );

  } finally {

    setImprovingPrompt(false);

  }

}

/* ======================================================
   GERAR THUMBNAIL
====================================================== */

async function generateThumbnail() {


  if (!prompt.trim()) {
    setError("Digite um prompt.");
    return;
  }

  setLoading(true);
  setError("");
  setImages([]);

  try {

 const response = await fetch(IMAGE_API, {

  method: "POST",

  headers: {
    "Content-Type": "application/json",
    "x-client": "tubex-workspace"
  },

body: JSON.stringify({
  prompt: prompt.trim(),
  n: quantity,
  quality,

  email: userData?.email,
  plan: userData?.plan || "free"
})

});

    const json = await response.json();

    if (!response.ok) {

      throw new Error(

        json.error ||

        "Erro ao gerar thumbnail."

      );

    }

    if (!json.success) {

      throw new Error(

        json.error ||

        "Falha retornada pela IA."

      );

    }

    if (!Array.isArray(json.images)) {

      throw new Error(

        "Resposta inválida do servidor."

      );

    }

    const parsed: ThumbnailResult[] =

      json.images.map(

        (img: any, index: number) => ({

          id:

            img.id ||

            crypto.randomUUID(),

          url:

            img.url ||

            img,

          revisedPrompt:

            img.revisedPrompt ||

            ""

        })

      );

    setImages(parsed);

  }

  catch (err: any) {

    console.error(err);

    setError(

      err.message ||

      "Erro inesperado."

    );

  }

  finally {

    setLoading(false);

  }

}
  /* ======================================================
     LAYOUT
  ====================================================== */

  return (

    <div className="max-w-7xl mx-auto">

      {/* HEADER */}

      <div className="mb-10">

        <div className="flex items-center gap-4">

          <div
            className="
              w-16
              h-16
              rounded-3xl
              bg-yellow-400
              flex
              items-center
              justify-center
            "
          >

            <Sparkles
              className="text-black"
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
              Thumbnail AI
            </h1>

            <p
              className="
                text-muted-foreground
                mt-2
              "
            >
              Gere thumbnails profissionais usando Inteligência Artificial.
            </p>

          </div>

        </div>

      </div>

      {/* PAINEL */}

      <div
        className="
          bg-card
          border
          border-border
          rounded-3xl
          p-8
        "
      >

        <div className="space-y-6">

          {/* PROMPT */}

          <div>

            <label
              className="
                text-sm
                font-semibold
                mb-2
                block
              "
            >
              Descreva a thumbnail
            </label>

            <textarea

              value={prompt}

              onChange={(e)=>
                setPrompt(e.target.value)
              }

              rows={6}

              placeholder="Exemplo: Homem assustado olhando um gráfico explodindo, fundo vermelho intenso, iluminação cinematográfica, estilo MrBeast, extremamente chamativa."

              className="
                w-full
                rounded-2xl
                border
                border-border
                bg-background
                p-5
                outline-none
                resize-none
              "

            />

          </div>
{/* ======================================================
   PROMPTS RÁPIDOS
====================================================== */}

<div>

  <div className="flex items-center justify-between mb-3">

    <h3 className="font-bold">
      Sugestões rápidas
    </h3>

    <button

      onClick={() => {

        const examples = [

          "Thumbnail estilo MrBeast, extremamente chamativa.",

          "Pessoa assustada olhando gráfico explodindo.",

          "Fundo vermelho com muito contraste e iluminação cinematográfica.",

          "Thumbnail minimalista preta e dourada.",

          "Estilo Netflix com iluminação dramática.",

          "Thumbnail para vídeo de Inteligência Artificial futurista.",

          "YouTube Analytics explodindo com muitas visualizações.",

          "Criador apontando para um título viral."

        ];

        setPrompt(
          examples[
            Math.floor(
              Math.random() * examples.length
            )
          ]
        );

      }}

      className="
        text-sm
        text-yellow-400
        hover:underline
      "

    >

      Aleatório

    </button>

  </div>

  <div
    className="
      flex
      flex-wrap
      gap-3
    "
  >

    {[
      "MrBeast",
      "Netflix",
      "YouTube",
      "Muito CTR",
      "Pessoa Assustada",
      "Fundo Vermelho",
      "Sem Texto",
      "Futurista",
      "IA",
      "Dinheiro",
      "Luxo",
      "Clickbait",
      "Tecnologia",
      "Gaming",
      "Cinema"
    ].map((item) => (

      <button

        key={item}

        onClick={() => {

          setPrompt((prev) =>

            prev.length

              ? prev + ", " + item

              : item

          );

        }}

        className="
          rounded-full
          border
          border-border
          px-4
          py-2
          text-sm
          hover:border-yellow-400
          hover:text-yellow-400
          transition-all
        "

      >

        {item}

      </button>

    ))}

  </div>

</div>

{/* ======================================================
   IA PROMPT BOOST
====================================================== */}

<div
  className="
    rounded-2xl
    border
    border-yellow-500/30
    bg-yellow-500/5
    p-5
  "
>

  <div className="flex items-center justify-between">

    <div>

      <h3 className="font-bold">

        Prompt Booster IA

      </h3>

      <p
        className="
          text-sm
          text-muted-foreground
          mt-1
        "
      >

        A IA pode melhorar automaticamente seu prompt
        antes da geração.

      </p>
{
  !isExpert && (

    <div
      className="
        mt-3
        text-yellow-400
        text-sm
        font-semibold
      "
    >

      🔒 Recurso exclusivo do plano Expert

    </div>

  )
}

    </div>

   <button



onClick={improvePrompt}

disabled={

improvingPrompt ||

!prompt.trim() ||

!isExpert

}

className="
bg-yellow-400
text-black
rounded-xl
px-5
py-3
font-bold
hover:opacity-90
transition-all
disabled:opacity-40
"

>

<div className="flex items-center gap-2">

{

improvingPrompt

?

<Loader2

size={18}

className="animate-spin"

/>

:

<Sparkles size={18}/>

}

{

improvingPrompt

?

"Melhorando..."

:

"Melhorar Prompt"

}

</div>

</button>

  </div>

</div>
          {/* CONFIGURAÇÕES */}

          <div
            className="
              grid
              grid-cols-1
              md:grid-cols-2
              gap-6
            "
          >

            <div>

              <label className="text-sm font-semibold">

                Quantidade

              </label>

              <select

                value={quantity}

                onChange={(e)=>
                  setQuantity(
                    Number(e.target.value)
                  )
                }

                className="
                  mt-2
                  w-full
                  rounded-xl
                  border
                  border-border
                  bg-background
                  p-3
                "

              >

                <option value={1}>
                  1 imagem
                </option>

                <option value={4}>
                  4 imagens
                </option>

              </select>

            </div>

            <div>

              <label className="text-sm font-semibold">

                Qualidade

              </label>

              <select

                value={quality}

                onChange={(e)=>
                  setQuality(e.target.value)
                }

                className="
                  mt-2
                  w-full
                  rounded-xl
                  border
                  border-border
                  bg-background
                  p-3
                "

              >

                <option value="medium">
                  Média
                </option>

                <option value="high">
                  Alta
                </option>

                <option value="ultra">
                  Ultra
                </option>

              </select>

            </div>

          </div>

{
  !isExpert && (

    <div
      className="
        rounded-xl
        border
        border-yellow-500/30
        bg-yellow-500/10
        p-4
        text-yellow-400
      "
    >

      🔒 Thumbnail AI disponível apenas
      para assinantes Expert.

    </div>

  )
}

          {/* BOTÃO */}

          <button

            onClick={generateThumbnail}

          disabled={
  loading ||
  !isExpert
}

            className="
              w-full
              bg-primary
              text-primary-foreground
              rounded-2xl
              py-4
              font-bold
              flex
              items-center
              justify-center
              gap-3
              hover:opacity-90
              transition-all
            "

          >

            {

              loading

                ?

                <>

                  <Loader2
                    className="animate-spin"
                    size={20}
                  />

                  Gerando Thumbnail...

                </>

                :

                <>

                  <Wand2 size={20}/>

                  Gerar Thumbnail

                </>

            }

          </button>

          {

            error && (

              <div
                className="
                  rounded-xl
                  bg-red-500/10
                  border
                  border-red-500/20
                  p-4
                  text-red-400
                "
              >

                {error}

              </div>

            )

          }

        {/* ======================================================
   RESULTADOS
====================================================== */}

{

images.length > 0 && (

<div className="pt-6 border-t border-border">

<div className="flex items-center justify-between mb-6">

<div>

<h2 className="text-2xl font-black">

Thumbnails Geradas

</h2>

<p className="text-muted-foreground mt-1">

Clique em uma imagem para visualizar em tamanho maior.

</p>

</div>

<div className="text-sm text-muted-foreground">

{images.length} imagem(ns)

</div>

</div>

<div
className="
grid
grid-cols-1
md:grid-cols-2
gap-8
"
>

{

images.map((image,index)=>(

<div

key={image.id}

className="
rounded-3xl
overflow-hidden
border
border-border
bg-background
hover:shadow-2xl
transition-all
"

>

<div className="relative">

<Image

src={image.url}

alt={`Thumbnail ${index+1}`}

width={1280}

height={720}

className="
w-full
h-auto
"

/>

</div>

<div className="p-5">

<div className="flex items-center justify-between">

<h3 className="font-bold">

Thumbnail {index+1}

</h3>

<span
className="
text-xs
text-muted-foreground
"
>

IA

</span>

</div>

{

image.revisedPrompt && (

<div
className="
mt-4
rounded-xl
bg-muted
p-4
text-sm
leading-7
"
>

{image.revisedPrompt}

</div>

)

}

<div
className="
grid
grid-cols-3
gap-3
mt-5
"
>

<button

onClick={async()=>{

  try{

const img = new window.Image();

    img.crossOrigin = "anonymous";

    img.onload = ()=>{

      const canvas = document.createElement("canvas");

      canvas.width = 1280;

      canvas.height = 720;

      const ctx = canvas.getContext("2d");

if (!ctx) {
  console.error("Canvas context não disponível.");
  return;
}

// Fundo preto
ctx.fillStyle = "#000";
ctx.fillRect(0, 0, 1280, 720);

// Calcula crop central mantendo proporção
const scale = Math.max(
  1280 / img.width,
  720 / img.height
);

const w = img.width * scale;
const h = img.height * scale;

const x = (1280 - w) / 2;
const y = (720 - h) / 2;

ctx.drawImage(img, x, y, w, h);

const a = document.createElement("a");

a.download = `TubeX-Thumbnail-${index + 1}.png`;
a.href = canvas.toDataURL("image/png");
a.click();

       };

    img.src = image.url;

  }catch(e){

    console.error(e);

  }

}}
className="
rounded-xl
border
border-border
py-3
font-semibold
flex
items-center
justify-center
gap-2
hover:bg-muted
transition-all
"

>

<Download size={18}/>

</button>

<button

onClick={()=>{

navigator.clipboard.writeText(

image.revisedPrompt || prompt

);

}}

className="
rounded-xl
border
border-border
py-3
font-semibold
flex
items-center
justify-center
gap-2
hover:bg-muted
transition-all
"

>

<Copy size={18}/>

</button>

<button

className="
rounded-xl
border
border-border
py-3
font-semibold
flex
items-center
justify-center
gap-2
hover:bg-muted
transition-all
"

>

<Heart size={18}/>

</button>

</div>

</div>

</div>

))

}

</div>

</div>

)

}

        </div>

      </div>

    </div>

  );

}