import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isTubeXOwner } from "@/lib/tubex-owner";
import { fetchEventsSince, fetchTable } from "@/lib/tubex-paged";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
// Formatadores criados uma única vez: criar Intl.DateTimeFormat a cada evento
// deixava a rota lentíssima com dezenas de milhares de eventos.
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" });
const dayCache = new Map<string, string>();
function dateKey(value: string | Date) {
  if (typeof value === "string") {
    let v = dayCache.get(value);
    if (!v) { v = dayFmt.format(new Date(value)); if (dayCache.size > 300000) dayCache.clear(); dayCache.set(value, v); }
    return v;
  }
  return dayFmt.format(value);
}
function monthKey(value: string | Date) {
  return dateKey(value).slice(0, 7);
}
function moduleLabel(name: string | null) {
  if (!name) return "Outros";
  const key = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return labels[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
function isUsageEvent(row: any) {
  const event = String(row.event_name || "").toLowerCase();
  const module = String(row.module || "").toLowerCase();
  if (excluded.has(event) || /^(login|auth_login)$/.test(event)) return false;
  if (["billing", "auth", "system", "subscription", "installation"].includes(module)) return false;
  return true;
}
function isLoginEvent(event: string) {
  return /^(login_success|auth_login|login)$/i.test(event);
}
const SEARCH_RE = /(search|seo|keyword|analysis|analy)/i;
function pct(current: number, previous: number) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
function hourKey(value: string) {
  return Number(hourFmt.format(new Date(value))) % 24;
}
function weekdayKey(value: string) {
  const [y, m, d] = dateKey(value).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
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
  const now = Date.now();
  const rangeSince = new Date(now - days * DAY);
  const prevSince = new Date(now - 2 * days * DAY);
  const monthStart = new Date(`${requestedMonth}-01T00:00:00-03:00`).toISOString();
  const since = new Date(Math.min(prevSince.getTime(), Date.parse(monthStart))).toISOString();
  // Paginado: o Supabase corta cada resposta em 1.000 linhas. Antes, só os eventos
  // mais recentes (hoje) chegavam e os dias anteriores apareciam zerados.
  const [eventResult, installResult, userResult] = await Promise.all([
    fetchEventsSince(since, "id,user_id,install_id,event_name,module,email:properties->>email,created_at", undefined, 150_000, 25_000),
    fetchTable("tubex_installations", "install_id,google_sub,email,name,picture,user_id,extension_version,first_seen,last_seen", "last_seen"),
    fetchTable("users", "id,email,name,plan"),
  ]);
  if (eventResult.error) return NextResponse.json({ error: eventResult.error }, { status: 500 });
  const allRows: any[] = eventResult.rows;
  const prevRows = allRows.filter(row => { const t = Date.parse(row.created_at); return t >= prevSince.getTime() && t < rangeSince.getTime(); });
  const rows: any[] = allRows;
  const installs: any[] = installResult.rows;
  const userRows: any[] = userResult.rows;
  const userMap = new Map(userRows.map(u => [u.id, u]));
  const installMap = new Map(installs.map(i => [i.install_id, i]));
  const emailMap = new Map(userRows.map(u => [String(u.email || "").toLowerCase(), u]));
  // Normaliza eventos da extensão e do site para a mesma conta sempre que houver vínculo conhecido.
  const accountKeyFor = (row: any): string => {
    if (row.__k) return row.__k;
    return (row.__k = computeAccountKey(row));
  };
  const computeAccountKey = (row: any) => {
    const install = row.install_id ? installMap.get(row.install_id) : null;
    const propsEmail = String(row.email || "").toLowerCase();
    const linkedUserId = row.user_id || install?.user_id || (String(row.install_id || "").startsWith("web-") ? String(row.install_id).slice(4) : null) || emailMap.get(propsEmail)?.id || null;
    return linkedUserId || install?.email?.toLowerCase() || propsEmail || row.install_id || "unknown";
  };
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
  const dailyLoginKeys = new Set<string>();

  for (const row of periodRows) {
    const day = dateKey(row.created_at);
    const accountKey = accountKeyFor(row);
    const event = String(row.event_name || "unknown");
    eventCounts.set(event, (eventCounts.get(event) || 0) + 1);
    if (isLoginEvent(event)) {
      uniqueLogins.add(accountKey);
      const dayKey = `${day}:${accountKey}`;
      const d = dailyMap.get(day);
      if (d && !dailyLoginKeys.has(dayKey)) { dailyLoginKeys.add(dayKey); d.logins++; }
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
    const accountKey = accountKeyFor(row);
    const installation = installMap.get(row.install_id);
    const user = (row.user_id && userMap.get(row.user_id)) || (installation?.user_id && userMap.get(installation.user_id)) || (row.email && emailMap.get(String(row.email).toLowerCase())) || null;
    const email = user?.email || installation?.email || row.email || null;
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
    const accountKey = accountKeyFor(row);
    const installation = installMap.get(row.install_id);
    const user = (row.user_id && userMap.get(row.user_id)) || (installation?.user_id && userMap.get(installation.user_id)) || (row.email && emailMap.get(String(row.email).toLowerCase())) || null;
    const email = user?.email || installation?.email || row.email || null;
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
  const activeAccountSet = new Set(usageRows.map(accountKeyFor).filter(k => k !== "unknown"));
  const activeAccounts = activeAccountSet.size;

  // ---------- Insights: período atual x período anterior de mesmo tamanho ----------
  const prevUsage = prevRows.filter(isUsageEvent);
  const prevActiveSet = new Set(prevUsage.map(accountKeyFor).filter(k => k !== "unknown"));
  const prevLoginSet = new Set(prevRows.filter(r => isLoginEvent(String(r.event_name || ""))).map(accountKeyFor));
  const prevInstalls = installs.filter(i => { const t = Date.parse(i.first_seen || ""); return t >= prevSince.getTime() && t < rangeSince.getTime(); }).length;
  const searchesNow = usageRows.filter(r => SEARCH_RE.test(`${r.event_name} ${r.module}`)).length;
  const searchesPrev = prevUsage.filter(r => SEARCH_RE.test(`${r.event_name} ${r.module}`)).length;
  const retained = [...prevActiveSet].filter(k => activeAccountSet.has(k));
  const newActive = [...activeAccountSet].filter(k => !prevActiveSet.has(k));
  const churned = [...prevActiveSet].filter(k => !activeAccountSet.has(k));
  // Conversão instalação -> login: instalações do período já vinculadas a uma conta ou com login registrado.
  const loginInstallIds = new Set(periodRows.filter(r => isLoginEvent(String(r.event_name || ""))).map(r => r.install_id).filter(Boolean));
  const periodInstalls = installs.filter(i => i.first_seen && Date.parse(i.first_seen) >= rangeSince.getTime());
  const convertedInstalls = periodInstalls.filter(i => i.user_id || loginInstallIds.has(i.install_id) || emailMap.has(String(i.email || "").toLowerCase())).length;
  const activatedLogins = [...uniqueLogins].filter(k => activeAccountSet.has(k)).length;
  const dauSeries = userActivityDaily.map(d => d.users);
  const avgDau = dauSeries.length ? dauSeries.reduce((a, b) => a + b, 0) / dauSeries.length : 0;
  const last7 = new Set(usageRows.filter(r => Date.parse(r.created_at) >= now - 7 * DAY).map(accountKeyFor));
  const prevModuleActions = new Map<string, number>();
  for (const r of prevUsage) { const m = String(r.module || "other"); prevModuleActions.set(m, (prevModuleActions.get(m) || 0) + 1); }
  const moduleTrends = modules.map(m => ({ name: m.name, label: m.label, users: m.value, actions: m.actions, previous: prevModuleActions.get(m.name) || 0, change: pct(m.actions, prevModuleActions.get(m.name) || 0) }));
  for (const [name, previous] of prevModuleActions) if (!moduleStats.has(name)) moduleTrends.push({ name, label: moduleLabel(name), users: 0, actions: 0, previous, change: -100 });
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, actions: 0 }));
  const weekdays = Array.from({ length: 7 }, (_, day) => ({ day, actions: 0 }));
  for (const r of usageRows) { hours[hourKey(r.created_at)].actions++; weekdays[weekdayKey(r.created_at)].actions++; }
  const actionsPerAccount = activeAccounts ? usageRows.length / activeAccounts : 0;
  const accountDays = new Map<string, Set<string>>();
  for (const r of usageRows) { const k = accountKeyFor(r); if (!accountDays.has(k)) accountDays.set(k, new Set()); accountDays.get(k)!.add(dateKey(r.created_at)); }
  const powerUsers = [...accountDays.values()].filter(set => set.size >= Math.max(3, Math.ceil(days / 7))).length;
  const oneDayUsers = [...accountDays.values()].filter(set => set.size === 1).length;
  const labelFor = (key: string) => {
    const user = userMap.get(key) || emailMap.get(key);
    const inst = installs.find(i => i.user_id === key || String(i.email || "").toLowerCase() === key || i.install_id === key);
    return { accountKey: key, account: user?.name || inst?.name || user?.email || inst?.email || key, email: user?.email || inst?.email || null, plan: user?.plan || null };
  };
  const lastSeenByAccount = new Map<string, string>();
  for (const r of prevUsage) { const k = accountKeyFor(r); if (!lastSeenByAccount.has(k)) lastSeenByAccount.set(k, r.created_at); }
  const atRisk = churned.map(k => ({ ...labelFor(k), lastActivityAt: lastSeenByAccount.get(k) || null }))
    .sort((a, b) => (Number(["start","member","pro","expert"].includes(String(b.plan || "").toLowerCase())) - Number(["start","member","pro","expert"].includes(String(a.plan || "").toLowerCase()))) || String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)))
    .slice(0, 12);
  const weekdayNames = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const peakHour = hours.reduce((a, b) => (b.actions > a.actions ? b : a), hours[0]);
  const peakWeekday = weekdays.reduce((a, b) => (b.actions > a.actions ? b : a), weekdays[0]);
  const fmtPct = (v: number | null) => v === null ? "novo" : `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR")}%`;
  const notes: { tone: "good" | "warn" | "bad" | "info"; title: string; text: string }[] = [];
  const activeChange = pct(activeAccounts, prevActiveSet.size);
  if (activeChange !== null && activeChange !== 0) notes.push({ tone: activeChange > 0 ? "good" : "bad", title: `Contas ativas ${fmtPct(activeChange)}`, text: `${activeAccounts} contas usaram recursos nos últimos ${days} dias, contra ${prevActiveSet.size} no período anterior.` });
  if (prevActiveSet.size) {
    const rate = Math.round((retained.length / prevActiveSet.size) * 100);
    notes.push({ tone: rate >= 40 ? "good" : rate >= 20 ? "warn" : "bad", title: `Retenção de ${rate}%`, text: `${retained.length} de ${prevActiveSet.size} contas ativas no período anterior voltaram a usar. ${churned.length} não voltaram e estão listadas como em risco.` });
  }
  if (periodInstalls.length) {
    const conv = Math.round((convertedInstalls / periodInstalls.length) * 100);
    notes.push({ tone: conv >= 50 ? "good" : conv >= 25 ? "warn" : "bad", title: `${conv}% das instalações viraram conta`, text: `${convertedInstalls} de ${periodInstalls.length} instalações novas fizeram login ou estão vinculadas a uma conta.${conv < 50 ? " Vale reforçar o onboarding da extensão para levar o usuário ao login." : ""}` });
  }
  const growing = moduleTrends.filter(m => m.previous >= 5 && (m.change ?? 0) >= 25).sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0];
  const falling = moduleTrends.filter(m => m.previous >= 5 && (m.change ?? 0) <= -25).sort((a, b) => (a.change ?? 0) - (b.change ?? 0))[0];
  if (growing) notes.push({ tone: "good", title: `${growing.label} em alta (${fmtPct(growing.change)})`, text: `${growing.actions} eventos agora contra ${growing.previous} no período anterior.` });
  if (falling) notes.push({ tone: "warn", title: `${falling.label} em queda (${fmtPct(falling.change)})`, text: `${falling.actions} eventos agora contra ${falling.previous} no período anterior. Verifique se há erro ou perda de interesse.` });
  if (modules[0]) notes.push({ tone: "info", title: `${modules[0].label} é o módulo principal`, text: `${modules[0].value} contas e ${modules[0].actions} eventos no período.` });
  if (usageRows.length) notes.push({ tone: "info", title: `Pico às ${String(peakHour.hour).padStart(2, "0")}h, ${weekdayNames[peakWeekday.day]}`, text: `Melhor janela para comunicados, e-mails e lançamentos (horário de Brasília).` });
  if (activeAccounts && oneDayUsers / activeAccounts >= 0.5) notes.push({ tone: "warn", title: `${Math.round((oneDayUsers / activeAccounts) * 100)}% usaram só 1 dia`, text: `${oneDayUsers} contas usaram o TubeX em apenas um dia do período. O desafio principal é fazer o usuário voltar.` });
  if (eventResult.truncated) notes.push({ tone: "warn", title: "Volume alto de eventos", text: "Nem todos os eventos couberam no tempo de carregamento; os dias mais antigos podem estar incompletos. Use um período menor." });

  const insights = {
    previous: { installs: prevInstalls, logins: prevLoginSet.size, activeAccounts: prevActiveSet.size, searches: searchesPrev, usageEvents: prevUsage.length },
    current: { installs: installsInPeriod, logins: uniqueLogins.size, activeAccounts, searches: searchesNow, usageEvents: usageRows.length },
    change: {
      installs: pct(installsInPeriod, prevInstalls), logins: pct(uniqueLogins.size, prevLoginSet.size),
      activeAccounts: activeChange, searches: pct(searchesNow, searchesPrev), usageEvents: pct(usageRows.length, prevUsage.length),
    },
    conversion: {
      installToLogin: periodInstalls.length ? convertedInstalls / periodInstalls.length : null,
      loginToActive: uniqueLogins.size ? activatedLogins / uniqueLogins.size : null,
      convertedInstalls, periodInstalls: periodInstalls.length,
    },
    engagement: {
      avgDau: Math.round(avgDau * 10) / 10, wau: last7.size, periodActive: activeAccounts,
      stickiness: activeAccounts ? avgDau / activeAccounts : null,
      actionsPerAccount: Math.round(actionsPerAccount * 10) / 10, powerUsers, oneDayUsers,
    },
    retention: { previousActive: prevActiveSet.size, retained: retained.length, newActive: newActive.length, churned: churned.length, rate: prevActiveSet.size ? retained.length / prevActiveSet.size : null },
    moduleTrends: moduleTrends.sort((a, b) => b.actions - a.actions).slice(0, 12),
    hours, weekdays, atRisk, notes,
    eventsLoaded: allRows.length, truncated: eventResult.truncated,
  };
  return NextResponse.json({
    days, month: requestedMonth, monthlyLeaderboardAvailable: true,
    totals: { installs: installsInPeriod, logins: uniqueLogins.size, searches: searchesNow, subscriptions: userRows.filter(u => ["start","member","pro","expert"].includes(String(u.plan || "").toLowerCase())).length, activeAccounts },
    funnel: [
      { name: "Instalações identificadas", value: installsInPeriod },
      { name: "Contas com login", value: uniqueLogins.size },
      { name: "Contas que usaram recursos", value: activeAccounts },
      { name: "Contas com pesquisa/análise", value: uniqueSearchers.size },
    ],
    modules, events: [...eventCounts.entries()].map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value),
    daily, userActivityDaily, userActivity, insights,
    monthlyTopUsers, monthlyTopModules: [...monthlyMod.entries()].map(([name, actions]) => ({ name, label: moduleLabel(name), actions })).sort((a,b)=>b.actions-a.actions).slice(0,15),
    extensionUsers,
    recent: rows.slice(0, 100).map(row => ({ user_id: row.user_id, install_id: row.install_id, event_name: row.event_name, module: row.module, module_label: moduleLabel(row.module), created_at: row.created_at })),
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
