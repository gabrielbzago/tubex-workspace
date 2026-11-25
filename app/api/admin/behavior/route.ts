import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const PAID_PLANS = new Set(["start", "member", "pro", "expert", "legend", "corporate"]);
const VALID_STATUSES = new Set(["active", "approved", "trialing", "past_due"]);
const OWNER_EMAILS = [
  process.env.OWNER_EMAILS || "",
  process.env.OWNER_EMAIL || "",
  process.env.NEXT_PUBLIC_OWNER_EMAIL || "",
  "gabrielbzago@gmail.com",
].join(",").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);

const str = (v: any) => String(v ?? "").trim();
const emailKey = (v: any) => str(v).toLowerCase();
const ms = (v: any) => {
  const n = Date.parse(str(v));
  return Number.isFinite(n) ? n : 0;
};
const iso = (v: any) => ms(v) ? new Date(ms(v)).toISOString() : null;
const daysAgo = (v: any, now: number) => ms(v) ? Math.max(0, Math.floor((now - ms(v)) / DAY)) : null;
const hoursAgo = (v: any, now: number) => ms(v) ? Math.max(0, Math.floor((now - ms(v)) / 3_600_000)) : null;
const dateKey = (value: any) => value ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)) : "";
const maxDate = (...values: any[]) => {
  const valid = values.map(iso).filter(Boolean) as string[];
  return valid.sort((a, b) => ms(b) - ms(a))[0] || null;
};
const minDate = (...values: any[]) => {
  const valid = values.map(iso).filter(Boolean) as string[];
  return valid.sort((a, b) => ms(a) - ms(b))[0] || null;
};
const displayName = (row: any, auth: any) =>
  str(row?.name || row?.full_name || auth?.user_metadata?.full_name || auth?.user_metadata?.name || auth?.email?.split("@")[0] || row?.email || "Sem nome");

async function getOwner(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const user = data?.user;
  if (error || !user?.id || !user.email) return null;

  const email = emailKey(user.email);
  if (OWNER_EMAILS.includes(email)) return user;
  const role = str(user.app_metadata?.role || user.app_metadata?.user_role).toLowerCase();
  if (["owner", "admin", "administrator"].includes(role)) return user;

  const { data: row, error: rowError } = await supabaseAdmin
    .from("users").select("*").eq("id", user.id).maybeSingle();
  if (rowError) console.warn("[admin behavior] owner lookup by id:", rowError.message);
  const roles = [row?.plan, row?.role, row?.user_role, row?.account_role].map((v) => str(v).toLowerCase());
  if (roles.some((v) => ["owner", "admin", "administrator"].includes(v)) || row?.is_owner === true || row?.is_admin === true) return user;

  const { data: byEmail, error: emailError } = await supabaseAdmin
    .from("users").select("*").ilike("email", email).maybeSingle();
  if (emailError) console.warn("[admin behavior] owner lookup by email:", emailError.message);
  const emailRoles = [byEmail?.plan, byEmail?.role, byEmail?.user_role, byEmail?.account_role].map((v) => str(v).toLowerCase());
  if (emailRoles.some((v) => ["owner", "admin", "administrator"].includes(v)) || byEmail?.is_owner === true || byEmail?.is_admin === true) return user;
  return null;
}

async function fetchAll(table: string, columns = "*", pageSize = 1000, maxRows = 100000, orderBy?: string) {
  const rows: any[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    let query = (supabaseAdmin as any).from(table).select(columns);
    if (orderBy) query = query.order(orderBy, { ascending: false });
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      console.warn(`[admin behavior] ${table} unavailable:`, error.message);
      return rows;
    }
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function fetchAuthUsers() {
  const users: any[] = [];
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.warn("[admin behavior] Auth users unavailable:", error.message);
      break;
    }
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < 1000) break;
  }
  return users;
}

function normalizePlan(value: any) {
  const plan = str(value || "free").toLowerCase();
  if (plan === "basic" || plan === "starter") return "start";
  if (plan === "legend" || plan === "corporate") return "expert";
  return plan || "free";
}
function moduleLabel(value: string) {
  const labels: Record<string, string> = {
    seo_explorer: "SEO Explorer", seo_search: "SEO de Pesquisa", dashboard: "Dashboard",
    creator_workspace: "Área do Criador", billing: "Planos e pagamentos", keyword: "Palavras-chave",
    keyword_explorer: "Keyword Explorer", analytics: "Analytics", ai: "Inteligência Artificial",
    video_editor: "Editor de vídeo", title_ai: "Gerador de títulos", thumbnail_ai: "Gerador de thumbnails",
    tags_editor: "Editor de tags", description_ai: "Gerador de descrição",
  };
  return labels[value] || value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function eventLabel(name: string) {
  const labels: Record<string, string> = {
    login_success: "Login realizado", module_opened: "Módulo aberto", upgrade_clicked: "Clique em upgrade",
    checkout_started: "Checkout iniciado", checkout_start: "Checkout iniciado",
    subscription_created: "Assinatura criada", subscription_canceled: "Assinatura cancelada",
    payment_failed: "Pagamento recusado", quota_limit_reached: "Limite atingido",
  };
  return labels[name] || name.replace(/[_-]+/g, " ");
}

export async function GET(request: Request) {
  const owner = await getOwner(request);
  if (!owner) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const segment = url.searchParams.get("segment") === "free" ? "free" : "subscribers";
  const now = Date.now();
  const cutoff30 = now - 30 * DAY;
  const cutoff7 = now - 7 * DAY;

  // A base é reconstruída a partir de users + Auth. Não depende de eventos recentes.
  const [userRows, authUsers, eventRows, installations, referrals, sales] = await Promise.all([
    fetchAll("users", "*"),
    fetchAuthUsers(),
    fetchAll("tubex_events", "id,user_id,install_id,session_id,event_name,module,properties,created_at", 1000, 100000, "created_at"),
    fetchAll("tubex_installations", "install_id,google_sub,email,name,picture,user_id,extension_version,first_seen,last_seen"),
    fetchAll("affiliate_referrals", "id,referred_email,referred_name,plan,status,stripe_subscription_id,updated_at,created_at"),
    fetchAll("affiliate_sales", "id,customer_email,customer_name,plan,status,stripe_subscription_id,last_payment_date,created_at"),
  ]);

  type Bucket = { key: string; email: string; emails: Set<string>; ids: Set<string>; row: any; auth: any; installs: any[]; events: any[]; referrals: any[]; sales: any[] };
  const buckets = new Map<string, Bucket>();
  const idToKey = new Map<string, string>();
  const emailToKey = new Map<string, string>();
  const installToKey = new Map<string, string>();

  const ensure = (emailValue: any, idValue?: any) => {
    const email = emailKey(emailValue);
    const id = str(idValue);
    // Um usuário pode entrar no site com um e-mail e na extensão com outro.
    // Quando o user_id autenticado coincide, os dois e-mails pertencem à mesma conta.
    const key = (id && idToKey.get(id)) || (email && emailToKey.get(email)) ||
      (email ? `email:${email}` : id ? `id:${id}` : "");
    if (!key) return null;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, email, emails: new Set(), ids: new Set(), row: null, auth: null, installs: [], events: [], referrals: [], sales: [] };
      buckets.set(key, bucket);
    }
    if (email) {
      bucket.emails.add(email);
      emailToKey.set(email, key);
      if (!bucket.email) bucket.email = email;
    }
    if (id) { bucket.ids.add(id); idToKey.set(id, key); }
    return bucket;
  };

  for (const auth of authUsers) {
    const bucket = ensure(auth.email, auth.id);
    if (!bucket) continue;
    bucket.auth = auth;
    if (auth.id) idToKey.set(String(auth.id), bucket.key);
  }
  for (const row of userRows) {
    const bucket = ensure(row.email, row.id);
    if (!bucket) continue;
    // Keep the richest existing users row if duplicate e-mails exist.
    if (!bucket.row || (normalizePlan(row.plan) !== "free" && normalizePlan(bucket.row.plan) === "free")) bucket.row = row;
    if (row.id) idToKey.set(String(row.id), bucket.key);
  }
  for (const install of installations) {
    const bucket = ensure(install.email, install.user_id);
    if (!bucket) continue;
    bucket.installs.push(install);
    installToKey.set(String(install.install_id), bucket.key);
  }
  for (const referral of referrals) {
    const bucket = ensure(referral.referred_email);
    if (bucket) bucket.referrals.push(referral);
  }
  for (const sale of sales) {
    const bucket = ensure(sale.customer_email);
    if (bucket) bucket.sales.push(sale);
  }
  for (const event of eventRows) {
    const props = event.properties && typeof event.properties === "object" ? event.properties : {};
    const key = (event.user_id && idToKey.get(String(event.user_id))) ||
      (event.install_id && installToKey.get(String(event.install_id))) ||
      (props.email && emailToKey.get(emailKey(props.email))) ||
      (String(event.install_id || "").startsWith("web-") && idToKey.get(String(event.install_id).slice(4)));
    if (key) buckets.get(key)?.events.push(event);
  }

  const accounts = [];
  let legacyAccounts = 0;
  let accountsWithoutEvents = 0;

  for (const bucket of buckets.values()) {
    const row = bucket.row || {};
    const auth = bucket.auth || null;
    const email = bucket.email || emailKey(auth?.email);
    if (!email) continue;

    const rawPlan = normalizePlan(row.plan);
    const rowStatus = str(row.status || "").toLowerCase();
    const stripeSubId = str(row.stripe_subscription_id);
    const stripeCustomerId = str(row.stripe_customer_id);
    const referralHistory = bucket.referrals.length > 0;
    const salesHistory = bucket.sales.length > 0;
    const activeReferral = [...bucket.referrals]
      .filter((x) => str(x.status).toLowerCase() === "active" && PAID_PLANS.has(normalizePlan(x.plan)))
      .sort((a, b) => ms(b.updated_at || b.created_at) - ms(a.updated_at || a.created_at))[0];
    const historicPlan = normalizePlan(
      [...bucket.referrals, ...bucket.sales]
        .sort((a, b) => ms(b.updated_at || b.last_payment_date || b.created_at) - ms(a.updated_at || a.last_payment_date || a.created_at))
        .find((x) => PAID_PLANS.has(normalizePlan(x.plan)))?.plan || rawPlan
    );
    const effectivePlan = PAID_PLANS.has(rawPlan) ? rawPlan : normalizePlan(activeReferral?.plan);
    const billingStatus = rowStatus || str(activeReferral?.status || "unknown").toLowerCase();
    const currentSubscriber = PAID_PLANS.has(effectivePlan) &&
      (VALID_STATUSES.has(billingStatus) || (!rowStatus && Boolean(stripeSubId || activeReferral)));
    const formerSubscriber = !currentSubscriber && (
      Boolean(stripeSubId || stripeCustomerId) || referralHistory || salesHistory ||
      (PAID_PLANS.has(rawPlan) && ["canceled", "cancelled", "inactive", "expired"].includes(billingStatus))
    );
    const isSubscriber = currentSubscriber || formerSubscriber;
    const plan = currentSubscriber ? effectivePlan : formerSubscriber ? (PAID_PLANS.has(historicPlan) ? historicPlan : "assinante anterior") : "free";

    const events = bucket.events.sort((a, b) => ms(a.created_at) - ms(b.created_at));
    const operationalEvents = new Set([
      "login_success", "logout", "session_started", "install", "installed", "extension_installed",
      "heartbeat", "sync", "sync_success", "payment_succeeded", "subscription_created",
      "subscription_canceled", "webhook_received",
    ]);
    const resourceEvents = events.filter((e) => {
      const eventName = str(e.event_name).toLowerCase();
      const moduleName = str(e.module).toLowerCase();
      if (operationalEvents.has(eventName)) return false;
      if (["auth", "billing", "system", "subscription", "installation"].includes(moduleName)) return false;
      return true;
    });
    const loginEvents = events.filter((e) => /login_success|auth_login/i.test(str(e.event_name)));
    const usage30 = resourceEvents.filter((e) => ms(e.created_at) >= cutoff30);
    const usage7 = resourceEvents.filter((e) => ms(e.created_at) >= cutoff7);
    const moduleMap = new Map<string, { key: string; name: string; count: number; lastUsedAt: string }>();
    for (const event of resourceEvents) {
      const key = str(event.module || event.event_name || "outro");
      const current = moduleMap.get(key) || { key, name: moduleLabel(key), count: 0, lastUsedAt: str(event.created_at) };
      current.count += 1;
      if (ms(event.created_at) > ms(current.lastUsedAt)) current.lastUsedAt = str(event.created_at);
      moduleMap.set(key, current);
    }
    const modules = [...moduleMap.values()].sort((a, b) => b.count - a.count);
    const days = [...new Set(resourceEvents.map((e) => dateKey(e.created_at)).filter(Boolean))];
    const days30 = [...new Set(usage30.map((e) => dateKey(e.created_at)).filter(Boolean))];
    const sessionsMap = new Map<string, any[]>();
    for (const event of resourceEvents) {
      const sessionKey = str(event.session_id || `day:${dateKey(event.created_at)}`);
      if (!sessionsMap.has(sessionKey)) sessionsMap.set(sessionKey, []);
      sessionsMap.get(sessionKey)!.push(event);
    }
    const sessions = [...sessionsMap.entries()].map(([id, items]) => ({
      id,
      startedAt: minDate(...items.map((x) => x.created_at)),
      lastActivityAt: maxDate(...items.map((x) => x.created_at)),
      actions: items.length,
      modules: [...new Set(items.map((x) => str(x.module || x.event_name)))].map((name) => ({
        name: moduleLabel(name),
        count: items.filter((x) => str(x.module || x.event_name) === name).length,
      })),
    })).sort((a, b) => ms(b.lastActivityAt) - ms(a.lastActivityAt));

    const quotaEvents = events.filter((e) => /quota|limit_reached|limit_hit|usage_limit/i.test(str(e.event_name)));
    const quotaMap = new Map<string, number>();
    for (const event of quotaEvents) {
      const props = event.properties || {};
      const feature = str(props.feature || props.resource || event.module || "Limite do plano");
      quotaMap.set(feature, (quotaMap.get(feature) || 0) + 1);
    }
    const upgradeEvents = events.filter((e) => /upgrade_clicked|upgrade_cta_clicked|subscribe_clicked/i.test(str(e.event_name)));
    const checkoutEvents = events.filter((e) => /checkout_started|checkout_start|checkout_opened/i.test(str(e.event_name)));
    const paymentFailures = events.filter((e) => /payment_failed|invoice_payment_failed/i.test(str(e.event_name))).length;
    const paymentEvents = events.filter((e) => /checkout|payment|subscription|invoice|cancel/i.test(str(e.event_name)))
      .map((e) => ({
        eventName: str(e.event_name),
        label: eventLabel(str(e.event_name)),
        at: str(e.created_at),
        plan: str(e.properties?.plan) || null,
        source: str(e.properties?.source) || null,
      })).slice(-100).reverse();

    const installLastSeen = maxDate(...bucket.installs.map((x) => x.last_seen));
    const authLastLogin = iso(auth?.last_sign_in_at);
    const eventLastLogin = maxDate(...loginEvents.map((x) => x.created_at));
    const lastLoginAt = maxDate(authLastLogin, eventLastLogin);
    const lastResourceAt = maxDate(...resourceEvents.map((x) => x.created_at));
    const latestResourceEvent = [...resourceEvents].sort((a, b) => ms(b.created_at) - ms(a.created_at))[0] || null;
    // Sincronização da extensão não equivale a uso do produto. Mantemos login como fallback,
    // mas a atividade de recursos sempre tem prioridade e fica identificada separadamente.
    const lastActivityAt = maxDate(lastResourceAt, lastLoginAt);
    const firstLoginAt = minDate(auth?.created_at, ...loginEvents.map((x) => x.created_at));
    const daysSinceActivity = daysAgo(lastActivityAt, now);
    const hoursSinceActivity = hoursAgo(lastActivityAt, now);
    const legacyOnly = resourceEvents.length === 0;
    if (legacyOnly) accountsWithoutEvents++;
    if (legacyOnly && (authLastLogin || installLastSeen)) legacyAccounts++;

    const subscribedAt = minDate(
      row.subscribed_at, row.subscription_started_at,
      ...bucket.referrals.map((x) => x.created_at),
      ...bucket.sales.map((x) => x.created_at)
    );
    const canceledReferral = bucket.referrals.filter((x) => ["canceled", "cancelled", "inactive"].includes(str(x.status).toLowerCase()));
    const canceledAt = maxDate(
      row.canceled_at, row.cancelled_at, row.subscription_canceled_at,
      ...canceledReferral.map((x) => x.updated_at || x.created_at)
    );
    const cancelReason = str(row.cancel_reason || row.cancellation_reason || row.cancel_feedback || row.cancellation_feedback) || null;
    const cancelCode = str(row.cancel_code || row.cancellation_code) || null;
    const cancelComment = str(row.cancel_comment || row.cancellation_comment) || null;
    const cancelLabel = cancelReason || (canceledReferral.length ? "Cancelamento registrado no histórico de afiliados" : null);

    // Status de relacionamento: mede recência de uso real, não quantidade de dias
    // distintos. Uma única sessão recente já caracteriza atividade; assinantes novos
    // recebem uma janela de onboarding para não serem rotulados como risco antes de usar.
    const activityReference = lastResourceAt || lastLoginAt;
    const activityDays = daysAgo(activityReference, now);
    const subscriptionAgeDays = daysAgo(subscribedAt, now);
    const hasRecentResourceUse = lastResourceAt !== null && activityDays !== null && activityDays <= 7;
    const isNewValidSubscriber = currentSubscriber &&
      VALID_STATUSES.has(billingStatus) &&
      subscriptionAgeDays !== null && subscriptionAgeDays <= 14;
    let status: "active" | "at_risk" | "inactive" | "canceled";
    const statusReasons: string[] = [];
    if (formerSubscriber) {
      status = "canceled";
      statusReasons.push("Há evidência de assinatura anterior, mas não há assinatura válida no cadastro atual.");
    } else if (billingStatus === "past_due") {
      status = "at_risk";
      statusReasons.push("Pagamento pendente (past_due), independentemente da recência de uso.");
    } else if (hasRecentResourceUse) {
      status = "active";
      statusReasons.push("Uso real de recurso registrado nos últimos 7 dias.");
    } else if (isNewValidSubscriber) {
      status = "active";
      statusReasons.push("Assinatura recente: conta em período inicial de onboarding (14 dias), sem penalização por ainda ter pouco histórico.");
    } else if (lastResourceAt && activityDays !== null && activityDays <= 30) {
      status = "at_risk";
      statusReasons.push("Último uso real de recurso ocorreu há mais de 7 e até 30 dias.");
    } else if (lastResourceAt) {
      status = "inactive";
      statusReasons.push("Sem uso real de recursos nos últimos 30 dias.");
    } else if (currentSubscriber) {
      status = "inactive";
      statusReasons.push("Assinatura válida, mas ainda não há evento de uso real de recursos registrado.");
    } else {
      status = "inactive";
      statusReasons.push("Nenhum evento de uso real de recursos identificado nos últimos 30 dias.");
    }
    if (legacyOnly) statusReasons.push("Conta anterior à implantação da telemetria: ações e módulos usados antes do início do Analytics não podem ser reconstruídos.");
    if (lastLoginAt) statusReasons.push(`Último login autenticado em ${lastLoginAt}.`);
    if (installLastSeen) statusReasons.push(`Última sincronização da extensão em ${installLastSeen}.`);
    if (lastResourceAt) statusReasons.push(`Último evento de recurso registrado em ${lastResourceAt}.`);

    const activeDays = days.length || (activityDays !== null ? 1 : 0);
    const activeDays30 = days30.length || (legacyOnly && activityDays !== null && activityDays <= 30 ? 1 : 0);
    const actions30 = usage30.length;
    const totalActions = resourceEvents.length;
    const subscribeTime = ms(subscribedAt);
    const beforeEvents = subscribeTime ? resourceEvents.filter((e) => ms(e.created_at) < subscribeTime) : [];
    const beforeModules = new Map<string, number>();
    for (const e of beforeEvents) {
      const name = moduleLabel(str(e.module || e.event_name || "outro"));
      beforeModules.set(name, (beforeModules.get(name) || 0) + 1);
    }
    const factors: { label: string; points: number }[] = [];
    let propensity = 0;
    const addFactor = (label: string, points: number) => { propensity += points; factors.push({ label, points }); };
    if (quotaEvents.length) addFactor(`Atingiu limites ${quotaEvents.length} vez(es)`, Math.min(35, quotaEvents.length >= 3 ? 35 : 25));
    if (checkoutEvents.length) addFactor("Iniciou checkout", 25);
    if (upgradeEvents.length) addFactor("Clicou em upgrade/assinar", 15);
    if (days30.length >= 5) addFactor("Ativo em 5 ou mais dias no mês", 15);
    else if (days30.length >= 2) addFactor("Ativo em 2 a 4 dias no mês", 8);
    if (actions30 >= 30) addFactor("30 ou mais ações no mês", 10);
    if (usage7.length) addFactor("Usou nos últimos 7 dias", 5);
    if (formerSubscriber) addFactor("Já foi assinante", 5);
    if (activityDays !== null && activityDays > 30) addFactor("Sem uso há mais de 30 dias", -20);
    propensity = Math.max(0, Math.min(100, propensity));
    const propensityTier = propensity >= 60 ? "hot" : propensity >= 30 ? "warm" : "cold";

    const loginCount = loginEvents.length;
    const account = {
      id: str(row.id || auth?.id || email),
      name: displayName(row, auth),
      email,
      plan,
      billingStatus,
      status,
      statusReasons,
      isSubscriber,
      currentSubscriber,
      formerSubscriber,
      linkedEmails: bucket.emails.size || 1,
      createdAt: iso(row.created_at || auth?.created_at),
      subscribedAt,
      canceledAt,
      cancelReason,
      cancelCode,
      cancelLabel,
      cancelComment,
      quotaHits: quotaEvents.length,
      quotaHits30: quotaEvents.filter((e) => ms(e.created_at) >= cutoff30).length,
      lastQuotaAt: maxDate(...quotaEvents.map((e) => e.created_at)),
      quotaFeatures: [...quotaMap.entries()].map(([name, count]) => ({ name: moduleLabel(name), count })).sort((a, b) => b.count - a.count),
      upgradeClicks: upgradeEvents.length,
      checkoutStarts: checkoutEvents.length,
      paymentFailures,
      propensity,
      propensityTier,
      propensityFactors: factors,
      subscribeDrivers: { quotaHitsBefore: beforeEvents.filter((e) => /quota|limit_reached|limit_hit|usage_limit/i.test(str(e.event_name))).length, topModules: [...beforeModules.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5) },
      daysSinceActivity,
      hoursSinceActivity,
      firstLoginAt,
      lastLoginAt,
      lastActivityAt,
      lastResource: latestResourceEvent
        ? moduleLabel(str(latestResourceEvent.module || latestResourceEvent.event_name || "outro"))
        : lastLoginAt ? "Login no TubeX (sem ação de recurso registrada)" : installLastSeen ? "Extensão sincronizada (não conta como uso)" : null,
      loginCount,
      returned: sessions.length > 1,
      returnCount: Math.max(0, sessions.length - 1),
      activeDays,
      activeDays30,
      searchCount: resourceEvents.filter((e) => /search|keyword|seo|analysis|analyze/i.test(`${e.event_name} ${e.module}`)).length,
      totalActions,
      actions30,
      highUse: actions30 >= 30,
      modules,
      sessions: sessions.slice(0, 100),
      paymentJourney: paymentEvents,
      _hasResourceEvents: resourceEvents.length > 0,
    };
    accounts.push(account);
  }

  const selectedAccounts = accounts.filter((account: any) =>
    segment === "free" ? !account.currentSubscriber : account.isSubscriber
  ).sort((a: any, b: any) => (ms(b.lastActivityAt) || 0) - (ms(a.lastActivityAt) || 0));

  return NextResponse.json({
    segment,
    accounts: selectedAccounts,
    meta: {
      totalUsers: accounts.length,
      totalCurrentSubscribers: accounts.filter((x: any) => x.currentSubscriber).length,
      totalFormerSubscribers: accounts.filter((x: any) => x.formerSubscriber).length,
      legacyAccounts,
      accountsWithoutEvents,
      usersTableRows: userRows.length,
      authUsers: authUsers.length,
      productEvents: eventRows.length,
      installations: installations.length,
      generatedAt: new Date(now).toISOString(),
      note: "Contas antigas são recuperadas de users/Auth e históricos de cobrança. Uso por módulo só pode ser detalhado a partir da implantação de tubex_events.",
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
