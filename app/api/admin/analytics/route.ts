import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
  "diagnostics", "chat_ai", "engaged_views", "revenue_insights",
];

const MODULE_ALIASES: Record<string, string> = {
  trends: "keyword_trends",
  ai: "ai_legacy",
  keyword_labs: "keyword_explorer",
  video_optimizer_module: "video_optimizer",
  seo_research: "seo_search",
  content_seo: "seo_search",
};

function canonicalModule(value: unknown): string {
  const raw = String(value || "").trim().toLowerCase();
  return MODULE_ALIASES[raw] || raw;
}

function moduleForEvent(event: EventRow): string {
  const raw = String(event.module || "").trim().toLowerCase();
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
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [{ data: events, error: queryError }, { data: users, error: usersError }] = await Promise.all([
    supabaseAdmin.from("tubex_events")
      .select("user_id,install_id,event_name,module,created_at,properties")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(20000),
    supabaseAdmin.from("users")
      .select("id,plan,status,stripe_customer_id,stripe_subscription_id"),
  ]);

  if (queryError) {
    console.error("[TubeX analytics] events query failed", queryError.message);
    return NextResponse.json({ error: "analytics_query_failed" }, { status: 503 });
  }

  const list = (events || []) as EventRow[];
  const userRows = (users || []) as UserRow[];
  const count = (name: string) => list.filter((event) => event.event_name === name).length;
  const countAny = (names: Set<string>) => list.filter((event) => names.has(event.event_name)).length;

  const installIds = new Set(list.map((event) => event.install_id).filter((value): value is string => Boolean(value)));
  const dailySets: Record<string, { installs: Set<string>; searches: number; logins: Set<string> }> = {};
  const ensureDay = (day: string) => dailySets[day] ||= { installs: new Set<string>(), searches: 0, logins: new Set<string>() };
  const byModule: Record<string, number> = {};
  const byEvent: Record<string, number> = {};

  for (const event of list) {
    const day = String(event.created_at).slice(0, 10);
    const daily = ensureDay(day);
    const who = identity(event);

    // Instalação ativa histórica: usa install_id mesmo quando o evento
    // extension_installed não existia na versão antiga da extensão.
    if (event.install_id && INSTALL_ACTIVITY_EVENTS.has(event.event_name)) daily.installs.add(event.install_id);
    // Pesquisas são eventos, não usuários únicos: várias pesquisas da mesma
    // instalação no mesmo dia precisam aparecer no gráfico e no total.
    if (SEARCH_EVENTS.has(event.event_name)) daily.searches += 1;
    if (who && event.event_name === "login_success") daily.logins.add(who);

    byEvent[event.event_name] = (byEvent[event.event_name] || 0) + 1;

    const moduleKey = moduleForEvent(event);
    if (moduleKey && MODULE_LABELS[moduleKey] && MODULE_ACTIVITY_EVENTS.has(event.event_name)) {
      byModule[moduleKey] = (byModule[moduleKey] || 0) + 1;
    }
  }

  // Completa os dias sem atividade para preservar o eixo temporal do gráfico.
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - offset);
    ensureDay(date.toISOString().slice(0, 10));
  }

  const logins = uniqueCount(list, (event) => event.event_name === "login_success");
  const searchedUsers = uniqueCount(list, (event) => SEARCH_EVENTS.has(event.event_name));
  const pricingUsers = uniqueCount(list, (event) => event.event_name === "pricing_viewed");
  const checkoutUsers = uniqueCount(list, (event) => event.event_name === "checkout_started");

  // A tabela users, atualizada pelo webhook Stripe, é a fonte de verdade das
  // assinaturas ativas. Não inferimos assinatura a partir de eventos de clique.
  const activePaidSubscriptions = usersError ? [] : userRows.filter((user) =>
    PAID_PLANS.has(String(user.plan || "").toLowerCase()) &&
    String(user.status || "").toLowerCase() === "active" &&
    Boolean(user.stripe_subscription_id)
  );
  const subscriptionCount = new Set(activePaidSubscriptions.map((user) => user.stripe_subscription_id)).size;

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
    totals: {
      installs: installIds.size,
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
      identifiedInstalls: installIds.size,
    },
    dataQuality: {
      subscriptionsAvailable: !usersError,
      historicalIdentity: "user_id ou install_id",
      notes: [
        "Pesquisas incluem search_submitted, search_performed e analysis_completed.",
        "Instalações históricas são reconstruídas pelo install_id persistente, mesmo sem extension_installed.",
        "Atividade diária de instalações conta install_id distintos com atividade naquele dia.",
        "Logins só são contabilizados quando existe login_success; abertura do YouTube não é tratada como login.",
        "Assinaturas confirmadas vêm de users: plano pago, status active e stripe_subscription_id preenchido.",
        ...(usersError ? ["Não foi possível consultar users; assinaturas não foram contabilizadas."] : []),
      ],
    },
    funnel: [
      { name: "Instalações identificadas", value: installIds.size },
      { name: "Logins confirmados", value: logins },
      { name: "Instalações que pesquisaram", value: searchedUsers },
      { name: "Visualizaram planos", value: pricingUsers },
      { name: "Iniciaram checkout", value: checkoutUsers },
      { name: "Assinaturas ativas confirmadas", value: subscriptionCount },
    ],
    modules: TRACKED_MODULE_KEYS
      .map((name) => ({ name, label: moduleLabel(name), value: byModule[name] || 0 }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR")),
    events: Object.entries(byEvent).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
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
