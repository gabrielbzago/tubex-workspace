import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tubex-backend";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Configure OPENAI_API_KEY na Vercel para gerar thumbnails." }, { status: 503 });
  try {
    const { prompt, title, channelContext } = await request.json();
    const brief = String(prompt || title || "").trim();
    if (brief.length < 5 || brief.length > 1800) return NextResponse.json({ error: "Descreva a thumbnail em pelo menos 5 caracteres (máximo 1.800)." }, { status: 400 });
    const channel = channelContext?.channelName ? `Canal: ${String(channelContext.channelName).slice(0,100)}.` : "";
    const imagePrompt = `Crie uma thumbnail profissional para YouTube, proporção horizontal 16:9, resolução alta, composição cinematográfica, leitura imediata em tela pequena, foco visual único, contraste forte e acabamento premium. Evite excesso de elementos, marcas d'água, logotipos inventados e textos longos. Se houver texto solicitado, escreva exatamente e corretamente em português. Brief: ${brief}. ${channel}`;
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt: imagePrompt, size: "1536x1024", quality: "high", n: 1 }), cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.error?.message || `Falha ao gerar imagem (${response.status}).` }, { status: response.status });
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: "O serviço não retornou a imagem." }, { status: 502 });
    return NextResponse.json({ image: `data:image/png;base64,${b64}` });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Não foi possível gerar a thumbnail." }, { status: 500 });
  }
}
