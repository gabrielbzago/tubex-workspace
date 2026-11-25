import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isTubeXOwner } from "@/lib/tubex-owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TZ = "America/Sao_Paulo";
const DAY = 86400000;
const excluded = new Set([
  "login_success", "logout", "install", "installed", "extension_installed",
  "payment_succeeded", "subscription_created", "subscription_canceled",
  "checkout_started", "webhook_received", "heartbeat", "sync", "sync_success",
]);
const labels: Record<string, string> = {
  seo_search: "SEO de Pesquisa", keyword_explorer: "Keyword Explorer",
  keyword_search: "Pesquisa de palavras-chave", ai_chat: "TubeX AI Chat",
  chat: "TubeX AI Chat", dashboard: "Painel", youtube: "YouTube",
  youtube_channel: "Análise de canal", trends: "Tendências",
  thumbnail: "Thumbnails", title_generator: "Gerador de títulos",
  creator_workspace: "Creator Workspace", analytics: "Analytics",
  tags: "Tags", ideas: "Ideias", scripts: "Roteiros",
};
function dateKey(value: string | Date) {
  const d = new Date(value);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function monthKey(value: string | Date) {
  const d = new Date(value);
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(d);
  return `${p.find(x => x.type === "year")?.value}-${p.find(x => x.type === "month")?.value}`;
}
function moduleLabel(name: string | null) {
  if (!name) return "Outros";
  const key = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return labels[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
function isUsageEvent(row: any) {
  const event = String(row.event_name || "").toLowerCase();
  const module = String(row.module || "").toLowerCase();
  if (excluded.has(event)) return false;
  if (["billing", "auth", "system", "subscription", "installation"].includes(module)) return false;
  return true;
}

async function fetchEventsSince(since: string, maxRows = 100000) {
  const all: any[] = [];
  const pageSize = 1000;
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await supabaseAdmin.from("tubex_events")
      .select("id,user_id,install_id,event_name,module,properties,created_at")
      .gte("created_at", since).order("created_at", { ascending: false })
      .range(from, Math.min(from + pageSize - 1, maxRows - 1));
    if (error) return { data: all, error };
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return { data: all, error: null };
}

function emptyDaily(days: number) {
  const result: any[] = [];
  const today = new Date();
  const todayKey = dateKey(today);
  const [y, m, d] = todayKey.split("-").map(Number);
  const end = new Date(Date.UTC(y, m - 1, d, 12));
  for (let i = days - 1; i >= 0; i--) {
    const x = new Date(end.getTime() - i * DAY);
    result.push({ date: dateKey(x), installs: 0, searches: 0, logins: 0 });
  }
  return result;
}

export async function GET(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user || !(await isTubeXOwner(auth.user))) {
    return NextResponse.json({ error: "Acesso restrito ao proprietário." }, { status: 403 });
  }

  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") || 30)));
  const requestedMonth = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") || "") ? url.searchParams.get("month")! : monthKey(new Date());
  const rangeSince = new Date(Date.now() - days * DAY);
  const monthStart = new Date(`${requestedMonth}-01T00:00:00-03:00`).toISOString();
  const since = new Date(Math.min(rangeSince.getTime(), Date.parse(monthStart))).toISOString();
  const [eventResult, installResult, userResult] = await Promise.all([
    fetchEventsSince(since),
    supabaseAdmin.from("tubex_installations")
      .select("install_id,google_sub,email,name,picture,user_id,extension_version,first_seen,last_seen")
      .order("last_seen", { ascending: false }).limit(5000),
    supabaseAdmin.from("users").select("id,email,name,plan").limit(10000),
  ]);
  if (eventResult.error) return NextResponse.json({ error: eventResult.error.message }, { status: 500 });
  const rows: any[] = eventResult.data || [];
  const installs: any[] = installResult.data || [];
  const userRows: any[] = userResult.data || [];
  const userMap = new Map(userRows.map(u => [u.id, u]));
  const installMap = new Map(installs.map(i => [i.install_id, i]));
  const emailMap = new Map(userRows.map(u => [String(u.email || "").toLowerCase(), u]));
  const dailyMap = new Map<string, any>(emptyDaily(days).map(d => [d.date, d]));
  const periodRows = rows.filter(row => Date.parse(row.created_at) >= rangeSince.getTime());
  const usageRows = periodRows.filter(isUsageEvent);
  const monthlyRows = rows.filter(row => monthKey(row.created_at) === requestedMonth && isUsageEvent(row));
  const activity = new Map<string, any>();
  const moduleStats = new Map<string, { users: Set<string>; actions: number }>();
  const eventCounts = new Map<string, number>();
  const monthlyUsers = new Map<string, any>();
  const uniqueLogins = new Set<string>();
  const uniqueSearchers = new Set<string>();
  const seenInstallToday = new Set<string>();

  for (const row of periodRows) {
    const day = dateKey(row.created_at);
    const accountKey = row.user_id || row.install_id || "unknown";
    const event = String(row.event_name || "unknown");
    eventCounts.set(event, (eventCounts.get(event) || 0) + 1);
    if (/login/i.test(event)) {
      uniqueLogins.add(accountKey);
      const d = dailyMap.get(day); if (d) d.logins++;
    }
  }
  for (const inst of installs) {
    if (inst.first_seen && dateKey(inst.first_seen) >= dateKey(new Date(Date.now() - days * DAY))) {
      const day = dateKey(inst.first_seen), d = dailyMap.get(day);
      if (d && !seenInstallToday.has(inst.install_id)) { d.installs++; seenInstallToday.add(inst.install_id); }
    }
  }
  for (const row of usageRows) {
    const day = dateKey(row.created_at);
    const accountKey = row.user_id || row.install_id || "unknown";
    const user = row.user_id ? userMap.get(row.user_id) : null;
    const installation = installMap.get(row.install_id);
    const email = user?.email || installation?.email || null;
    const account = user?.name || installation?.name || email || String(accountKey);
    const mod = String(row.module || "other");
    const label = moduleLabel(mod);
    const d = dailyMap.get(day);
    if (d && /(search|seo|keyword|analysis|analy|chat_message)/i.test(`${row.event_name} ${mod}`)) d.searches++;
    const key = `${day}:${accountKey}`;
    if (!activity.has(key)) activity.set(key, { date: day, accountKey, account, email, installId: row.install_id || "", actions: 0, modules: new Map() });
    const item = activity.get(key); item.actions++;
    item.modules.set(mod, (item.modules.get(mod) || 0) + 1);
    if (!moduleStats.has(mod)) moduleStats.set(mod, { users: new Set(), actions: 0 });
    moduleStats.get(mod)!.users.add(accountKey); moduleStats.get(mod)!.actions++;
    if (/(search|seo|keyword|analysis|analy)/i.test(`${row.event_name} ${mod}`)) uniqueSearchers.add(accountKey);
  }
  for (const row of monthlyRows) {
    const accountKey = row.user_id || row.install_id || "unknown";
    const user = row.user_id ? userMap.get(row.user_id) : null;
    const installation = installMap.get(row.install_id);
    const email = user?.email || installation?.email || null;
    const account = user?.name || installation?.name || email || String(accountKey);
    const day = dateKey(row.created_at);
    const mod = String(row.module || "other");
    if (!monthlyUsers.has(accountKey)) monthlyUsers.set(accountKey, { accountKey, account, email, actions: 0, days: new Set(), modules: new Map() });
    const mu = monthlyUsers.get(accountKey);
    mu.actions++;
    mu.days.add(day);
    mu.modules.set(mod, (mu.modules.get(mod) || 0) + 1);
  }
  const userActivity = [...activity.values()].map(item => ({
    ...item, modules: [...item.modules.entries()].map(([name, actions]: any) => ({ name, label: moduleLabel(name), actions }))
      .sort((a, b) => b.actions - a.actions),
  })).sort((a, b) => b.date.localeCompare(a.date) || b.actions - a.actions);
  const userActivityDaily = [...dailyMap.values()].map(d => ({
    date: d.date, users: new Set(userActivity.filter(x => x.date === d.date).map(x => x.accountKey)).size,
  }));
  const monthly = [...monthlyUsers.values()];
  const monthlyTopUsers = monthly.map(u => ({
    accountKey: u.accountKey, account: u.account, email: u.email, actions: u.actions, activeDays: u.days.size,
    modules: [...u.modules.entries()].map(([name, actions]: any) => ({ name, label: moduleLabel(name), actions })).sort((a, b) => b.actions - a.actions),
  })).sort((a, b) => b.actions - a.actions).slice(0, 20);
  const monthlyMod = new Map<string, number>();
  for (const row of monthlyRows) {
    const key = String(row.module || "other"); monthlyMod.set(key, (monthlyMod.get(key) || 0) + 1);
  }
  const modules = [...moduleStats.entries()].map(([name, value]) => ({ name, label: moduleLabel(name), value: value.users.size, actions: value.actions })).sort((a, b) => b.actions - a.actions);
  const extensionUsers = installs.map(inst => {
    const user = (inst.user_id && userMap.get(inst.user_id)) || emailMap.get(String(inst.email || "").toLowerCase());
    return { ...inst, plan: user?.plan || "não vinculado", account_status: null };
  });
  const daily = [...dailyMap.values()];
  const installsInPeriod = installs.filter(i => i.first_seen && Date.parse(i.first_seen) >= Date.now() - days * DAY).length;
  const activeAccounts = new Set(usageRows.map(r => r.user_id || r.install_id).filter(Boolean)).size;
  return NextResponse.json({
    days, month: requestedMonth, monthlyLeaderboardAvailable: true,
    totals: { installs: installsInPeriod, logins: uniqueLogins.size, searches: usageRows.filter(r => /(search|seo|keyword|analysis|analy)/i.test(`${r.event_name} ${r.module}`)).length, subscriptions: userRows.filter(u => ["start","member","pro","expert"].includes(String(u.plan || "").toLowerCase())).length, activeAccounts },
    funnel: [
      { name: "Instalações identificadas", value: installsInPeriod },
      { name: "Contas com login", value: uniqueLogins.size },
      { name: "Contas que usaram recursos", value: activeAccounts },
      { name: "Contas com pesquisa/análise", value: uniqueSearchers.size },
    ],
    modules, events: [...eventCounts.entries()].map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value),
    daily, userActivityDaily, userActivity,
    monthlyTopUsers, monthlyTopModules: [...monthlyMod.entries()].map(([name, actions]) => ({ name, label: moduleLabel(name), actions })).sort((a,b)=>b.actions-a.actions).slice(0,15),
    extensionUsers,
    recent: rows.slice(0, 100).map(row => ({ user_id: row.user_id, install_id: row.install_id, event_name: row.event_name, module: row.module, module_label: moduleLabel(row.module), created_at: row.created_at })),
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
