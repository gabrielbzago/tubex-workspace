import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isTubeXOwner } from "@/lib/tubex-owner";
import { fetchEventsSince } from "@/lib/tubex-paged";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user || !(await isTubeXOwner(auth.user))) {
    return NextResponse.json({ error: "Acesso restrito ao proprietário." }, { status: 403 });
  }

  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") || 30)));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  // Paginado: o Supabase devolve no máximo 1.000 linhas por requisição.
  const { rows, error } = await fetchEventsSince(since, "id,user_id,session_id,event_name,properties,created_at", (q: any) => q.eq("module", "ai_chat"), 50_000);
  if (error) return NextResponse.json({ error }, { status: 500 });
  const userIds = [...new Set(rows.map((row: any) => row.user_id).filter(Boolean))] as string[];
  const profiles = new Map<string, any>();
  await Promise.all(userIds.map(async (id) => {
    try {
      const [{ data: authUser }, { data: profile }] = await Promise.all([
        supabaseAdmin.auth.admin.getUserById(id),
        supabaseAdmin.from("users").select("name,email,plan").eq("id", id).maybeSingle(),
      ]);
      profiles.set(id, { name: profile?.name || authUser?.user?.user_metadata?.name || null, email: profile?.email || authUser?.user?.email || null, plan: profile?.plan || "free" });
    } catch { profiles.set(id, { name: null, email: null, plan: "free" }); }
  }));

  const byUser = new Map<string, any>();
  for (const event of rows as any[]) {
    if (!event.user_id) continue;
    const id = event.user_id;
    if (!byUser.has(id)) byUser.set(id, { user_id: id, ...(profiles.get(id) || {}), opens: 0, messages: 0, credits: 0, sessions: new Set<string>(), last_used: event.created_at, last_plan: event.properties?.plan || profiles.get(id)?.plan || "free" });
    const user = byUser.get(id);
    if (event.event_name === "chat_opened") user.opens += 1;
    if (event.session_id) user.sessions.add(event.session_id);
    if (event.event_name === "chat_message_sent") {
      user.messages += 1;
      user.credits += Number(event.properties?.credits || 0);
      user.last_plan = event.properties?.plan || user.last_plan;
    }
  }
  const users = [...byUser.values()].map((user) => ({ ...user, opens: user.sessions.size || user.opens, sessions: undefined, last_used: user.last_used })).sort((a, b) => b.messages - a.messages || new Date(b.last_used).getTime() - new Date(a.last_used).getTime());
  return NextResponse.json({
    days,
    totals: {
      activeUsers: users.filter((user) => user.messages > 0 || user.opens > 0).length,
      messages: users.reduce((sum, user) => sum + user.messages, 0),
      opens: users.reduce((sum, user) => sum + user.opens, 0),
      credits: users.reduce((sum, user) => sum + user.credits, 0),
    },
    users,
    recent: rows.slice(0, 80).map((event: any) => ({ user_id: event.user_id, event_name: event.event_name, created_at: event.created_at, plan: event.properties?.plan || "—", credits: Number(event.properties?.credits || 0) })),
  });
}
