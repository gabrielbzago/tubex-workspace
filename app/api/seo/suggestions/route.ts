import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tubex-backend";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  try {
    const body = await request.json();
    const query = String(body?.query || "").trim().slice(0, 100);
    const geo = String(body?.geo || "BR").toUpperCase().slice(0, 3);
    const language = String(body?.language || "pt").slice(0, 5);
    if (query.length < 2) return NextResponse.json({ suggestions: [] });
    const url = new URL("https://suggestqueries.google.com/complete/search");
    url.searchParams.set("client", "firefox");
    url.searchParams.set("ds", "yt");
    url.searchParams.set("q", query);
    url.searchParams.set("hl", language);
    url.searchParams.set("gl", geo);
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 TubeX Keyword Explorer" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) return NextResponse.json({ suggestions: [] });
    const data = await response.json();
    const suggestions = Array.isArray(data?.[1]) ? data[1].map((v: any) => String(v).trim()).filter(Boolean).slice(0, 15) : [];
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
