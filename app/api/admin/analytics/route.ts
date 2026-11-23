import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { effectivePlanFromRow, planRank } from "@/lib/tubex-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EventRow = {
  user_id: string | null;
  install_id: string | null;
  event_name: string;
  module: string | null;
  created_at: string;
  properties: Record<string, unknown> | null;
};

type UserRow = {
  id: string;
  email?: string | null;
  name?: string | null;
  plan: string | null;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

const SEARCH_EVENTS = new Set(["search_submitted", "search_performed", "analysis_completed"]);
const INSTALL_ACTIVITY_EVENTS = new Set([
  "extension_installed", "extension_updated", "extension_started", "welcome_opened",
  "welcome_completed", "youtube_opened", "module_opened", "search_submitted",
  "search_performed", "analysis_completed", "extension_action", "ui_action",
]);
const MODULE_ACTIVITY_EVENTS = new Set([
  "module_opened", "extension_action", "ui_action", "search_submitted", "search_performed",
  "search_failed", "analysis_completed", "analysis_failed", "ai_generation_completed",
  "quota_exhausted", "competitor_analysis", "competitor_analysis_started",
  "competitor_analysis_failed", "trend_search_completed", "trend_search_failed",
  "summary_viewed", "creator_workspace_opened",
]);
const PAID_PLANS = new Set(["start", "pro", "expert"]);

const MODULE_LABELS: Record<string, string> = {
  seo_search: "SEO de Pesquisa",
  seo_explorer: "SEO Explorer",
  keyword_explorer: "Keyword Explorer",
  keyword_trends: "Tendências de Palavras-chave",
  competitor_radar: "Radar de Concorrentes",
  creator_workspace: "Creator Workspace",
  outliers: "Detector de Outliers",
  summary: "Resumo do Canal",
  video_optimizer: "Otimizador de Vídeos",
  video_ai: "IA para Vídeos",
  video_list_ai: "IA de Lista de Vídeos",
  title_ai: "IA de Títulos",
  description_ai: "IA de Descrições",
  thumbnail_ai: "IA de Thumbnails",
  tags_editor: "Editor de Tags",
  intelligence: "Inteligência TubeX",
  ai_legacy: "IA (histórico sem módulo específico)",
  diagnostics: "Diagnóstico",
  chat_ai: "Chat com IA",
  engaged_views: "Visualizações Engajadas",
  revenue_insights: "Análise de Receita",
  billing: "Assinaturas e Pagamentos",
  extension: "Extensão TubeX",
  system: "Sistema",
  javascript: "Erros JavaScript",
  youtube: "YouTube",
};

const TRACKED_MODULE_KEYS = [
  "seo_search", "seo_explorer", "keyword_explorer", "keyword_trends", "competitor_radar",
  "creator_workspace", "outliers", "summary", "video_optimizer", "video_ai", "video_list_ai",
  "title_ai", "description_ai", "thumbnail_ai", "tags_editor", "intelligence", "ai_legacy",
  "diagnostics", "chat_ai", "engaged_views", "revenue_insights", "billing",
];

const MODULE_ALIASES: Record<string, string> = {
  trends: "keyword_trends",
  ai: "ai_legacy",
  keyword_labs: "keyword_explorer",
  video_optimizer_module: "video_optimizer",
  seo_research: "seo_search",
  content_seo: "seo_search",
  revenue: "revenue_insights",
  diagnosis: "diagnostics",
  diagnostic: "diagnostics",
  video: "video_ai",
  extension_module: "extension",
};

const ACTION_MODULES: Record<string, string> = {
  fetchSeoData: "seo_search",
  youtubeKeywordSuggestions: "keyword_explorer",
  fetchRelatedKeywordSuggestions: "keyword_explorer",
  fetchKeywordSearchInsights: "keyword_explorer",
  fetchKeywordVolume: "keyword_explorer",
  fetchGoogleAdsKeywordMetrics: "keyword_explorer",
  generateAdvancedRelatedKeywords: "keyword_explorer",
  searchYoutubeVideos: "keyword_explorer",
  googleTrends: "keyword_trends",
  generateAdvancedTags: "tags_editor",
  runVideoOptimizer: "video_optimizer",
  video_ai_chat: "video_ai",
  generateViralScoreAI: "video_ai",
  generateThumbnail: "thumbnail_ai",
  gerarDescricaoPorTitulo: "description_ai",
  gerarTextoIA: "title_ai",
  gerarTextoIAPainel: "intelligence",
  generateAIVideoIdeas: "intelligence",
  generateVideoOpportunityAI: "intelligence",
  generateChannelStrategyAI: "intelligence",
  generateChannelOpportunities: "intelligence",
  generateTubeXInsight: "intelligence",
  generateChannelDiagnosisAI: "diagnostics",
  detectChannelNicheAI: "competitor_radar",
  generateNicheCompetitorRadar: "competitor_radar",
  fetchChannelSummary: "summary",
  fetchQuickStatsChannel: "creator_workspace",
  fetchQuickStatsVisitedHistory: "creator_workspace",
  fetchQuickStatsOwnChannel: "creator_workspace",
  fetchOwnChannelViewsHistory: "creator_workspace",
  fetchOwnVideoEngagedViews: "engaged_views",
  fetchOwnChannelEngagedViews: "engaged_views",
  fetchOwnChannelEngagedViews30d: "engaged_views",
  fetchLast7DaysVideos: "creator_workspace",
  fetchLast30DaysViews: "creator_workspace",
  fetchSubsLast7Days: "creator_workspace",
  fetchTopVideo: "creator_workspace",
  fetchChannelStats: "creator_workspace",
  fetchChannelStatsFromVideos: "creator_workspace",
  fetchRevenueProgress: "revenue_insights",
  tubexChatGetContext: "chat_ai",
  tubexChatConnect: "chat_ai",
  tubexChatAsk: "chat_ai",
  getOAuthDiagnostics: "diagnostics",
  checkSubscription: "billing",
  verificarPlano: "billing",
  fetchChannelVideos: "intelligence",
  getRealChannelData: "intelligence",
  getMyChannelIdentity: "intelligence",
  executarIA: "intelligence",
  alt_text_tooltip: "thumbnail_ai",
};

function canonicalModule(value: unknown): string {
  const raw = String(value || "").trim().toLowerCase();
  return MODULE_ALIASES[raw] || raw;
}

function inferModuleFromAction(value: unknown): string | null {
  const action = String(value || "").trim();
  if (!action) return null;
  if (ACTION_MODULES[action]) return ACTION_MODULES[action];
  const a = action.toLowerCase();
  if (/checkout|upgrade|subscription|payment|plan/.test(a)) return "billing";
  if (/seo.?search|fetchseodata/.test(a)) return "seo_search";
  if (/keyword|suggestion|searchyoutube|searchkeyword/.test(a)) return "keyword_explorer";
  if (/trend/.test(a)) return "keyword_trends";
  if (/competitor|radar|outlier/.test(a)) return /outlier/.test(a) ? "outliers" : "competitor_radar";
  if (/creator|calendar|workspace/.test(a)) return "creator_workspace";
  if (/diagnostic/.test(a)) return "diagnostics";
  if (/chat/.test(a)) return "chat_ai";
  if (/thumbnail/.test(a)) return "thumbnail_ai";
  if (/description/.test(a)) return "description_ai";
  if (/title/.test(a)) return "title_ai";
  if (/tag/.test(a)) return "tags_editor";
  if (/video|optim/.test(a)) return "video_optimizer";
  if (/revenue|receipt/.test(a)) return "revenue_insights";
  if (/summary/.test(a)) return "summary";
  if (/seo/.test(a)) return "seo_explorer";
  if (/revenue|receipt|faturamento/.test(a)) return "revenue_insights";
  if (/insight|executaria|getrealchanneldata|getmychannelidentity|channelvideos/.test(a)) return "intelligence";
  if (/subscription|checkout|payment|billing|verificarplano|checksubscription/.test(a)) return "billing";
  return null;
}

function moduleForEvent(event: EventRow): string {
  const raw = String(event.module || "").trim().toLowerCase();
  // Reclassifica eventos antigos genéricos quando o nome da ação foi preservado.
  if (["extension", "system", "youtube", ""].includes(raw)) {
    const inferred = inferModuleFromAction(event.properties?.action);
    if (inferred) return inferred;
  }
  // Eventos antigos do fetchSeoData podem ser separados pela origem registrada.
  if (raw === "seo_explorer" && event.properties?.source === "background_analysis") return "seo_search";
  return canonicalModule(raw);
}

function moduleLabel(value: unknown): string {
  const key = canonicalModule(value);
  return MODULE_LABELS[key] || key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function identity(event: EventRow): string | null {
  // A extensão antiga não enviava user_id em todos os eventos. install_id é o
  // identificador persistente para reconstruir instalações e atividade histórica.
  return event.user_id || event.install_id || null;
}

function eventDay(value: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function startOfLocalRange(days: number): string {
  const [year, month, day] = eventDay(new Date().toISOString()).split("-").map(Number);
  // O período inclui hoje e os (days - 1) dias de calendário anteriores,
  // começando à meia-noite de São Paulo, em vez de deslizar a cada hora.
  return new Date(Date.UTC(year, month - 1, day - (days - 1), 3)).toISOString();
}

function uniqueCount(rows: EventRow[], predicate: (event: EventRow) => boolean): number {
  return new Set(rows.filter(predicate).map(identity).filter((value): value is string => Boolean(value))).size;
}

export async function GET(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ownerEmail = String(process.env.OWNER_EMAIL || process.env.NEXT_PUBLIC_OWNER_EMAIL || "gabrielbzago@gmail.com").toLowerCase();
  if (data.user.email.toLowerCase() !== ownerEmail) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get("days") || 30)));
  const since = startOfLocalRange(days);
  const currentMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date());
  const requestedMonth = url.searchParams.get("month") || currentMonth;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : currentMonth;
  const [monthYear, monthNumber] = month.split("-").map(Number);
  const monthSince = new Date(Date.UTC(monthYear, monthNumber - 1, 1, 3)).toISOString();
  const monthUntil = new Date(Date.UTC(monthYear, monthNumber, 1, 3)).toISOString();

  const [
    { data: events, error: queryError },
    { data: monthlyEvents, error: monthlyEventsError },
    { data: users, error: usersError },
    { data: installations, error: installationsError },
  ] = await Promise.all([
    supabaseAdmin.from("tubex_events")
      .select("user_id,install_id,event_name,module,created_at,properties")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(20000),
    supabaseAdmin.from("tubex_events")
      .select("user_id,install_id,event_name,module,created_at,properties")
      .gte("created_at", monthSince).lt("created_at", monthUntil).order("created_at", { ascending: false }).limit(20000),
    supabaseAdmin.from("users")
      .select("id,email,name,plan,status,stripe_customer_id,stripe_subscription_id"),
    supabaseAdmin.from("tubex_installations")
      .select("install_id,email,name,picture,user_id,extension_version,first_seen,last_seen")
      .order("last_seen", { ascending: false }).limit(1000),
  ]);

  if (queryError) {
    console.error("[TubeX analytics] events query failed", queryError.message);
    return NextResponse.json({ error: "analytics_query_failed" }, { status: 503 });
  }

  const list = (events || []) as EventRow[];
  const userRows = (users || []) as UserRow[];
  const installationRows = (installations || []) as Array<{install_id:string;email:string|null;name:string|null;user_id:string|null}>;
  const count = (name: string) => list.filter((event) => event.event_name === name).length;
  const countAny = (names: Set<string>) => list.filter((event) => names.has(event.event_name)).length;
  const usageUserById = new Map(userRows.map((user) => [user.id, user]));
  const usageInstallById = new Map(installationRows.map((installation) => [installation.install_id, installation]));
  const dailyAccountSets: Record<string, Set<string>> = {};
  const usageRows = new Map<string, {date:string;accountKey:string;account:string;email:string|null;installId:string;actions:number;modules:Record<string,number>}>();
  const monthlyUserRows = new Map<string, {accountKey:string;account:string;email:string|null;actions:number;days:Set<string>;modules:Record<string,number>}>();
  const monthlyModuleActions: Record<string, number> = {};
  for (const event of (monthlyEvents || []) as EventRow[]) {
    if (!event.install_id || event.install_id.startsWith("web-") || !MODULE_ACTIVITY_EVENTS.has(event.event_name)) continue;
    const moduleKey = moduleForEvent(event);
    if (!moduleKey || !MODULE_LABELS[moduleKey]) continue;
    const installation = usageInstallById.get(event.install_id);
    const accountUser = (event.user_id ? usageUserById.get(event.user_id) : null) ||
      (installation?.user_id ? usageUserById.get(installation.user_id) : null);
    const email = String(accountUser?.email || installation?.email || "").trim().toLowerCase() || null;
    const accountKey = email ? `email:${email}` : accountUser?.id || `install:${event.install_id}`;
    const account = accountUser?.name || installation?.name || email || `Instalação ${event.install_id.slice(0, 8)}`;
    const row = monthlyUserRows.get(accountKey) || {accountKey,account,email,actions:0,days:new Set<string>(),modules:{}};
    row.actions += 1;
    row.days.add(eventDay(event.created_at));
    row.modules[moduleKey] = (row.modules[moduleKey] || 0) + 1;
    monthlyUserRows.set(accountKey, row);
    monthlyModuleActions[moduleKey] = (monthlyModuleActions[moduleKey] || 0) + 1;
  }
  const monthlyTopUsers = [...monthlyUserRows.values()]
    .map((row) => ({accountKey:row.accountKey,account:row.account,email:row.email,actions:row.actions,activeDays:row.days.size,modules:Object.entries(row.modules).map(([name,actions])=>({name,label:moduleLabel(name),actions})).sort((a,b)=>b.actions-a.actions)}))
    .sort((a,b)=>b.actions-a.actions||a.account.localeCompare(b.account,"pt-BR"))
    .slice(0,10);
  const monthlyTopModules = Object.entries(monthlyModuleActions)
    .map(([name,actions])=>({name,label:moduleLabel(name),actions}))
    .sort((a,b)=>b.actions-a.actions||a.label.localeCompare(b.label,"pt-BR"))
    .slice(0,10);

  // IDs web-* são chaves sintéticas usadas para eventos de cobrança no site,
  // não instalações da extensão. O total de instalações usa só atividade da extensão.
  const extensionInstallIds = new Set(list
    .filter((event) => INSTALL_ACTIVITY_EVENTS.has(event.event_name) && event.install_id && !event.install_id.startsWith("web-"))
    .map((event) => event.install_id as string));
  const dailySets: Record<string, { installs: Set<string>; searches: number; logins: Set<string> }> = {};
  const ensureDay = (day: string) => dailySets[day] ||= { installs: new Set<string>(), searches: 0, logins: new Set<string>() };
  // Módulos mostram instalações/contas distintas, não número bruto de cliques.
  // O volume bruto continua disponível como `actions` para auditoria.
  const moduleUsers: Record<string, Set<string>> = {};
  const moduleActions: Record<string, number> = {};
  const byEvent: Record<string, number> = {};

  for (const event of list) {
    const day = eventDay(event.created_at);
    const daily = ensureDay(day);
    const who = identity(event);

    // Instalação ativa histórica: usa install_id mesmo quando o evento
    // extension_installed não existia na versão antiga da extensão.
    if (event.install_id && !event.install_id.startsWith("web-") && INSTALL_ACTIVITY_EVENTS.has(event.event_name)) daily.installs.add(event.install_id);
    // Pesquisas são eventos, não usuários únicos: várias pesquisas da mesma
    // instalação no mesmo dia precisam aparecer no gráfico e no total.
    if (SEARCH_EVENTS.has(event.event_name)) daily.searches += 1;
    if (who && event.event_name === "login_success") daily.logins.add(who);

    byEvent[event.event_name] = (byEvent[event.event_name] || 0) + 1;

    const moduleKey = moduleForEvent(event);
    if (moduleKey && MODULE_LABELS[moduleKey] && MODULE_ACTIVITY_EVENTS.has(event.event_name)) {
      moduleActions[moduleKey] = (moduleActions[moduleKey] || 0) + 1;
      if (who) (moduleUsers[moduleKey] ||= new Set<string>()).add(who);

      // Histórico diário de uso real da extensão. Eventos de cobrança do site
      // (web-*) não são tratados como uso de produto.
      if (event.install_id && !event.install_id.startsWith("web-")) {
        const installation = usageInstallById.get(event.install_id);
        const accountUser = (event.user_id ? usageUserById.get(event.user_id) : null) ||
          (installation?.user_id ? usageUserById.get(installation.user_id) : null);
        const email = String(accountUser?.email || installation?.email || "").trim().toLowerCase() || null;
        const accountKey = email ? `email:${email}` : accountUser?.id || `install:${event.install_id}`;
        const account = accountUser?.name || installation?.name || email || `Instalação ${event.install_id.slice(0, 8)}`;
        const usageKey = `${day}:${accountKey}`;
        const row = usageRows.get(usageKey) || {date:day,accountKey,account,email,installId:event.install_id,actions:0,modules:{}};
        row.actions += 1;
        row.modules[moduleKey] = (row.modules[moduleKey] || 0) + 1;
        usageRows.set(usageKey, row);
        (dailyAccountSets[day] ||= new Set<string>()).add(accountKey);
      }
    }
  }

  // Completa os dias sem atividade para preservar o eixo temporal do gráfico.
  for (let offset = days - 1; offset >= 0; offset--) {
    const [year, month, day] = eventDay(new Date().toISOString()).split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day - offset, 12));
    ensureDay(date.toISOString().slice(0, 10));
  }

  const logins = uniqueCount(list, (event) => event.event_name === "login_success");
  const searchedUsers = uniqueCount(list, (event) => SEARCH_EVENTS.has(event.event_name));
  const pricingUsers = uniqueCount(list, (event) => event.event_name === "pricing_viewed");
  const checkoutUsers = uniqueCount(list, (event) => event.event_name === "checkout_started");

  // A tabela users, atualizada pelo webhook Stripe, é a fonte de verdade das
  // assinaturas ativas. Não inferimos assinatura a partir de eventos de clique.
  const activePaidSubscriptions = usersError ? [] : userRows.filter((user) =>
    // Mesma regra do planoSB/extensão: trialing e past_due (carência) contam.
    PAID_PLANS.has(effectivePlanFromRow(user).plan) &&
    Boolean(user.stripe_subscription_id)
  );
  const subscriptionCount = new Set(activePaidSubscriptions.map((user) => user.stripe_subscription_id)).size;
  const userById = new Map(userRows.map((user) => [user.id, user]));
  const userByEmail = new Map(
    userRows
      .filter((user) => user.email)
      .map((user) => [String(user.email).trim().toLowerCase(), user])
  );
  const extensionUsers = (installations || []).map((installation: any) => {
    // Algumas instalações autenticam o Google na extensão, mas nunca entram
    // no dashboard. Nesses casos user_id fica vazio; o e-mail verificado é a
    // chave segura para associar ao cadastro de cobrança.
    // Melhor plano entre a linha ligada por user_id e a linha do e-mail Google
    // (mesma regra do site e da extensão: o melhor plano vence).
    const candidates = [
      installation.user_id ? userById.get(installation.user_id) : null,
      installation.email ? userByEmail.get(String(installation.email).trim().toLowerCase()) : null,
    ].filter(Boolean) as any[];
    const linkedUser = candidates.sort((a, b) => planRank(effectivePlanFromRow(b).plan) - planRank(effectivePlanFromRow(a).plan))[0] || null;
    return {
      install_id: installation.install_id,
      email: installation.email,
      name: installation.name || linkedUser?.name || null,
      picture: installation.picture || null,
      user_id: installation.user_id || null,
      plan: linkedUser ? effectivePlanFromRow(linkedUser).plan : "não vinculado",
      account_status: linkedUser?.status || null,
      extension_version: installation.extension_version || null,
      first_seen: installation.first_seen,
      last_seen: installation.last_seen,
    };
  });

  const daily = Object.entries(dailySets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      installs: values.installs.size,
      searches: values.searches,
      logins: values.logins.size,
    }));

  return NextResponse.json({
    days,
    month,
    monthlyLeaderboardAvailable: !monthlyEventsError,
    monthlyTopUsers,
    monthlyTopModules,
    totals: {
      installs: extensionInstallIds.size,
      logins,
      activeUsers: uniqueCount(list, () => true),
      searches: countAny(SEARCH_EVENTS),
      pricingViews: count("pricing_viewed"),
      upgrades: count("upgrade_clicked"),
      checkouts: count("checkout_started"),
      subscriptions: subscriptionCount,
      quotaHits: count("quota_exhausted"),
      errors: count("api_error"),
      loggedUsers: logins,
      searchedUsers,
      identifiedInstalls: extensionInstallIds.size,
    },
    dataQuality: {
      subscriptionsAvailable: !usersError,
      extensionIdentityAvailable: !installationsError,
      historicalIdentity: "user_id ou install_id",
      notes: [
        "Pesquisas incluem search_submitted, search_performed e analysis_completed.",
        "Instalações contam install_id distintos com atividade na extensão; IDs sintéticos web-* de cobrança ficam de fora.",
        "Atividade diária de instalações conta install_id distintos com atividade naquele dia.",
        "Logins só são contabilizados quando existe login_success; abertura do YouTube não é tratada como login.",
        "Assinaturas confirmadas vêm de users: plano pago, status active e stripe_subscription_id preenchido.",
        "E-mails da extensão vêm exclusivamente do endpoint Google userinfo validado no servidor.",
        ...(installationsError ? ["Tabela tubex_installations indisponível; execute a migration 20261114_tubex_installations.sql."] : []),
        ...(usersError ? ["Não foi possível consultar users; assinaturas não foram contabilizadas."] : []),
      ],
    },
    funnel: [
      { name: "Instalações com atividade na extensão", value: extensionInstallIds.size },
      { name: "Contas com login confirmado", value: logins },
      { name: "Contas/instalações que pesquisaram", value: searchedUsers },
      { name: "Contas que visualizaram planos", value: pricingUsers },
      { name: "Contas que iniciaram checkout", value: checkoutUsers },
    ],
    modules: TRACKED_MODULE_KEYS
      .map((name) => ({ name, label: moduleLabel(name), value: moduleUsers[name]?.size || 0, actions: moduleActions[name] || 0 }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR")),
    userActivityDaily: Object.keys(dailySets)
      .sort((a, b) => a.localeCompare(b))
      .map((date) => ({ date, users: dailyAccountSets[date]?.size || 0 })),
    userActivity: [...usageRows.values()]
      .map((row) => ({
        ...row,
        modules: Object.entries(row.modules).map(([name, actions]) => ({name,label:moduleLabel(name),actions})).sort((a,b)=>b.actions-a.actions),
      }))
      .sort((a,b)=>b.date.localeCompare(a.date)||a.account.localeCompare(b.account,"pt-BR"))
      .slice(0,5000),
    events: Object.entries(byEvent).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    extensionUsers,
    daily,
    recent: list.slice(0, 100).map((event) => ({
      user_id: event.user_id,
      install_id: event.install_id,
      event_name: event.event_name,
      module: event.module,
      module_label: event.module ? moduleLabel(moduleForEvent(event)) : null,
      created_at: event.created_at,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
