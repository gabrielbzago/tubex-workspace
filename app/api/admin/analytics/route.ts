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
const PAID_PLANS = new Set(["start", "pro", "expert"]);

function identity(e: EventRow): string | null {
  // Eventos antigos da extensão não tinham user_id. install_id é o identificador
  // persistente disponível e permite contar a instalação sem inventar um login.
  return e.user_id || e.install_id || null;
}

function uniqueCount(rows: EventRow[], predicate: (e: EventRow) => boolean): number {
  return new Set(rows.filter(predicate).map(identity).filter((v): v is string => Boolean(v))).size;
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
  const count = (name: string) => list.filter((e) => e.event_name === name).length;
  const countAny = (names: Set<string>) => list.filter((e) => names.has(e.event_name)).length;

  const byModule: Record<string, number> = {};
  const byEvent: Record<string, number> = {};
  const dailySets: Record<string, { installs: Set<string>; searches: Set<string>; logins: Set<string> }> = {};
  const ensureDay = (day: string) => dailySets[day] ||= { installs: new Set(), searches: new Set(), logins: new Set() };

  for (const e of list) {
    const day = String(e.created_at).slice(0, 10);
    const d = ensureDay(day);
    const who = identity(e);
    if (who && INSTALL_ACTIVITY_EVENTS.has(e.event_name)) d.installs.add(e.install_id || who);
    if (who && SEARCH_EVENTS.has(e.event_name)) d.searches.add(who);
    if (who && e.event_name === "login_success") d.logins.add(who);
    byEvent[e.event_name] = (byEvent[e.event_name] || 0) + 1;
    if (e.module) byModule[e.module] = (byModule[e.module] || 0) + 1;
  }

  // Complete calendar range, including days with no events.
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - offset);
    ensureDay(date.toISOString().slice(0, 10));
  }

  // Count an installation from the persistent install_id even when the original
  // extension_installed event was not emitted by that historical extension build.
  const installIds = new Set(list.map((e) => e.install_id).filter((v): v is string => Boolean(v)));
  const logins = uniqueCount(list, (e) => e.event_name === "login_success");
  const searchedUsers = uniqueCount(list, (e) => SEARCH_EVENTS.has(e.event_name));
  const pricingUsers = uniqueCount(list, (e) => e.event_name === "pricing_viewed");
  const checkoutUsers = uniqueCount(list, (e) => e.event_name === "checkout_started");

  // The billing webhook updates users. Use the persisted Stripe subscription ID,
  // paid plan and active status as the source of truth for confirmed subscriptions.
  const activePaidSubscriptions = usersError ? [] : userRows.filter((u) =>
    PAID_PLANS.has(String(u.plan || "").toLowerCase()) &&
    String(u.status || "").toLowerCase() === "active" &&
    Boolean(u.stripe_subscription_id)
  );
  const subscriptionCount = new Set(activePaidSubscriptions.map((u) => u.stripe_subscription_id)).size;

  const daily = Object.entries(dailySets).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({
    date, installs: v.installs.size, searches: v.searches.size, logins: v.logins.size,
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
        "Eventos históricos search_submitted e analysis_completed são considerados pesquisas.",
        "Instalações históricas são identificadas pelo install_id persistente, mesmo sem evento extension_installed.",
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
    modules: Object.entries(byModule).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    events: Object.entries(byEvent).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    daily,
    recent: list.slice(0, 100).map((e) => ({ user_id: e.user_id, install_id: e.install_id, event_name: e.event_name, module: e.module, created_at: e.created_at })),
  }, { headers: { "Cache-Control": "no-store" } });
}
