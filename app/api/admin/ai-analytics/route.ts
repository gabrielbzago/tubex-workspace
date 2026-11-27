import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isTubeXOwner } from "@/lib/tubex-owner";
import { fetchEventsSince, fetchTable } from "@/lib/tubex-paged";
import { aiMonthKey } from "@/lib/tubex-ai-credits";
import { listAuthUsers } from "@/lib/tubex-auth-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Detecção de uso do TubeX AI Chat.
 *
 * Antes, o relatório só contava eventos com module = "ai_chat" E user_id preenchido.
 * Quem usa o Chat pela extensão manda eventos sem user_id (a conta Google ainda não
 * está vinculada a um cadastro do site) e às vezes com module "chat"; essas pessoas
 * nunca apareciam. Agora juntamos:
 *  1. eventos de Chat de qualquer origem (site ou extensão), identificados pela conta
 *     do site, pela instalação da extensão ou pelo e-mail Google;
 *  2. o consumo de créditos de IA do mês (tubex_ai_credit_usage), que é gravado em
 *     toda resposta cobrada, mesmo que o evento de analytics falhe.
 */
const CHAT_MODULES = ["ai_chat", "chat", "tubex_ai", "tubex_ai_chat", "ai", "ai_assistant", "assistant"];
const MESSAGE_RE = /(chat_message|message_sent|ai_generation_completed|chat_reply|chat_response|ai_response)/i;
const OPEN_RE = /(chat_opened|module_opened|creator_workspace_opened|session_started|opened)/i;

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
  const monthKey = aiMonthKey();

  // Paginado: o Supabase devolve no máximo 1.000 linhas por requisição.
  const [eventResult, installResult, userResult, creditResult, authUsers] = await Promise.all([
    fetchEventsSince(
      since,
      "id,user_id,install_id,session_id,event_name,module,properties,created_at",
      (q: any) => q.or(`module.in.(${CHAT_MODULES.join(",")}),event_name.ilike.*chat*`),
      50_000,
    ),
    fetchTable("tubex_installations", "install_id,email,name,picture,user_id,last_seen", "last_seen"),
    fetchTable("users", "id,email,name,plan"),
    supabaseAdmin.from("tubex_ai_credit_usage").select("user_id,used,updated_at").eq("month_key", monthKey).gt("used", 0).limit(1000),
    listAuthUsers().catch(() => []),
  ]);
  if (eventResult.error) return NextResponse.json({ error: eventResult.error }, { status: 500 });

  const users: any[] = userResult.rows;
  const installs: any[] = installResult.rows;
  const userById = new Map(users.map((u) => [u.id, u]));
  const userByEmail = new Map(users.map((u) => [String(u.email || "").toLowerCase(), u]));
  const installById = new Map(installs.map((i) => [i.install_id, i]));
  const installByEmail = new Map(installs.map((i) => [String(i.email || "").toLowerCase(), i]));
  const authById = new Map(authUsers.map((u) => [u.id, u]));
  const authByEmail = new Map(authUsers.filter((u) => u.email).map((u) => [u.email as string, u]));

  type Account = {
    user_id: string; name: string | null; email: string | null; plan: string; site: boolean;
    sources: Set<string>; opens: number; messages: number; credits: number; monthCredits: number;
    sessions: Set<string>; last_used: string | null;
  };
  const accounts = new Map<string, Account>();

  const resolve = (row: { user_id?: string | null; install_id?: string | null; email?: string | null }) => {
    const install = row.install_id ? installById.get(row.install_id) : null;
    const webId = String(row.install_id || "").startsWith("web-") ? String(row.install_id).slice(4) : null;
    const id = row.user_id || install?.user_id || webId || null;
    const propEmail = row.email ? String(row.email).toLowerCase() : null;
    const authUser = (id && authById.get(id))
      || (install?.email && authByEmail.get(String(install.email).toLowerCase()))
      || (propEmail && authByEmail.get(propEmail))
      || null;
    const email = authUser?.email || install?.email?.toLowerCase() || propEmail || null;
    const siteUser = (id && userById.get(id)) || (authUser && userById.get(authUser.id)) || (email && userByEmail.get(email)) || null;
    const ext = install || (email ? installByEmail.get(email) : null);
    const key = authUser?.id || siteUser?.id || id || email || row.install_id || null;
    if (!key) return null;
    if (!accounts.has(key)) {
      accounts.set(key, {
        user_id: key,
        name: siteUser?.name || authUser?.name || ext?.name || null,
        email: siteUser?.email || email,
        plan: String(siteUser?.plan || "free").toLowerCase(),
        site: Boolean(authUser || siteUser),
        sources: new Set(), opens: 0, messages: 0, credits: 0, monthCredits: 0,
        sessions: new Set(), last_used: null,
      });
    }
    return accounts.get(key)!;
  };
  const touch = (acc: Account, at: string | null | undefined) => {
    if (at && (!acc.last_used || at > acc.last_used)) acc.last_used = at;
  };

  for (const event of eventResult.rows as any[]) {
    const acc = resolve({ user_id: event.user_id, install_id: event.install_id, email: event.properties?.email || null });
    if (!acc) continue;
    const name = String(event.event_name || "");
    const fromWeb = String(event.install_id || "").startsWith("web-") || event.properties?.source === "web_dashboard";
    acc.sources.add(fromWeb ? "site" : "extensao");
    if (event.session_id) acc.sessions.add(event.session_id);
    if (MESSAGE_RE.test(name)) {
      acc.messages += 1;
      acc.credits += Number(event.properties?.credits || 0);
    } else if (OPEN_RE.test(name)) {
      acc.opens += 1;
    }
    if (event.properties?.plan && acc.plan === "free") acc.plan = String(event.properties.plan).toLowerCase();
    touch(acc, event.created_at);
  }

  // Créditos do mês: pega quem usou a IA mesmo sem evento de analytics registrado.
  if (!creditResult.error) {
    for (const row of creditResult.data || []) {
      const acc = resolve({ user_id: row.user_id });
      if (!acc) continue;
      acc.monthCredits = Number(row.used || 0);
      acc.sources.add("site");
      touch(acc, row.updated_at);
    }
  }

  const list = [...accounts.values()]
    .map((a) => ({
      user_id: a.user_id, name: a.name, email: a.email, plan: a.plan, site: a.site,
      sources: [...a.sources], opens: Math.max(a.opens, a.sessions.size), messages: a.messages,
      credits: Math.max(a.credits, a.monthCredits), month_credits: a.monthCredits, last_used: a.last_used,
    }))
    .sort((a, b) => b.messages - a.messages || String(b.last_used).localeCompare(String(a.last_used)));

  return NextResponse.json({
    days,
    generatedAt: new Date().toISOString(),
    totals: {
      activeUsers: list.length,
      messages: list.reduce((sum, u) => sum + u.messages, 0),
      opens: list.reduce((sum, u) => sum + u.opens, 0),
      credits: list.reduce((sum, u) => sum + u.credits, 0),
    },
    users: list,
    recent: (eventResult.rows as any[]).slice(0, 80).map((event) => ({
      user_id: event.user_id, event_name: event.event_name, created_at: event.created_at,
      plan: event.properties?.plan || "—", credits: Number(event.properties?.credits || 0),
    })),
    warnings: [
      ...(creditResult.error ? [`Créditos do mês indisponíveis: ${creditResult.error.message}`] : []),
      ...(list.some((u) => u.month_credits > 0) && !list.some((u) => u.messages > 0 || u.opens > 0)
        ? ["Há créditos consumidos mas nenhum evento do Chat gravado. Os eventos passam a ser registrados a partir desta versão; se continuar em 0, procure por \"[TubeX AI analytics]\" nos logs da Vercel."]
        : []),
    ],
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
