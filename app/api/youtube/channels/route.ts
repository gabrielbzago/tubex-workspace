import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/tubex-backend";
import { googleRefreshConfigured, listGoogleChannels, removeGoogleChannel, setActiveGoogleChannel } from "@/lib/tubex-google-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/** GET → canais do YouTube conectados à conta TubeX (sem tokens) + canal ativo. */
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: noStore });
  try {
    const channels = await listGoogleChannels(user.id);
    const active = channels.find((c) => c.active) || channels[0];
    return NextResponse.json({ channels, activeId: active?.id || "", oauthConfigured: googleRefreshConfigured() }, { headers: noStore });
  } catch (e: any) {
    // Tabela ainda não criada (migration pendente): o site segue com o canal do login.
    return NextResponse.json({ channels: [], activeId: "", oauthConfigured: false, error: e?.message || "erro" }, { headers: noStore });
  }
}

/** POST { action: "activate" | "remove", channelId } */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: noStore });
  const body = await request.json().catch(() => ({}));
  const channelId = String(body?.channelId || "").trim();
  if (!/^UC[\w-]{10,}$/.test(channelId)) return NextResponse.json({ error: "Canal inválido." }, { status: 400, headers: noStore });
  if (body?.action === "remove") { await removeGoogleChannel(user.id, channelId); return NextResponse.json({ ok: true }, { headers: noStore }); }
  const ok = await setActiveGoogleChannel(user.id, channelId);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404, headers: noStore });
}
