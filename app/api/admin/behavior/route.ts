import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { OWNER_EMAILS, effectivePlanFromRow, planRank } from "@/lib/tubex-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEARCH_EVENTS = new Set(["search_submitted", "search_performed", "analysis_completed", "trend_search_completed"]);
const BILLING_LABELS: Record<string, string> = {
  pricing_viewed: "Planos visualizados",
  upgrade_clicked: "Clique para assinar / abrir pagamentos",
  checkout_started: "Checkout iniciado",
  subscription_activated: "Assinatura confirmada",
  subscription_cancelled: "Assinatura cancelada",
  payment_failed: "Pagamento não concluído",
  upgrade_prompt_viewed: "Viu aviso de upgrade",
  upgrade_prompt_clicked: "Clicou no aviso de upgrade",
  quota_exhausted: "Atingiu o limite do plano",
};
const PAID = new Set(["start", "member", "pro", "expert"]);
// Motivos do Stripe (cancellation_details.feedback / reason) em português.
const CANCEL_LABELS: Record<string, string> = {
  too_expensive: "Achou caro", missing_features: "Faltou recurso", switched_service: "Trocou por outra ferramenta",
  unused: "Não estava usando", customer_service: "Atendimento", too_complex: "Difícil de usar",
  low_quality: "Qualidade abaixo do esperado", other: "Outro motivo", cancellation_requested: "Pediu o cancelamento (sem motivo)",
  payment_failed: "Pagamento falhou", payment_disputed: "Contestação de pagamento", subscription_expired: "Assinatura expirou",
};
const MODULE_EVENTS = new Set([
  "module_opened", "extension_action", "ui_action", "search_submitted", "search_performed", "search_failed",
  "analysis_completed", "analysis_failed", "ai_generation_completed", "quota_exhausted", "competitor_analysis",
  "competitor_analysis_started", "competitor_analysis_failed", "trend_search_completed", "trend_search_failed",
  "summary_viewed", "creator_workspace_opened", "feature_used", "api_request_succeeded", "extension_started",
  "youtube_opened", "session_started",
]);
const NON_PRODUCT_MODULES = new Set(["billing", "payments", "payment", "checkout", "subscription", "account", "affiliate", "support", "dashboard", "web_dashboard"]);
const MODULE_ALIASES: Record<string, string> = {
  trends: "keyword_trends", ai: "ai_legacy", keyword_labs: "keyword_explorer", seo_research: "seo_search",
  content_seo: "seo_search", revenue: "revenue_insights", diagnosis: "diagnostics", diagnostic: "diagnostics",
  video: "video_ai", extension_module: "extension",
};
function inferModuleFromAction(value: unknown) {
  const action = String(value || "").trim().toLowerCase();
  if (!action) return null;
  if (/checkout|upgrade|subscription|payment|billing|invoice|verificarplano|checksubscription|\bplan\b/.test(action)) return "billing";
  if (/fetchseodata|seo.?search/.test(action)) return "seo_search";
  if (/keyword|suggestion|searchyoutube|searchkeyword/.test(action)) return "keyword_explorer";
  if (/trend/.test(action)) return "keyword_trends";
  if (/outlier/.test(action)) return "outliers";
  if (/competitor|radar/.test(action)) return "competitor_radar";
  if (/creator|calendar|workspace|channelstats|channelviews|quickstats/.test(action)) return "creator_workspace";
  if (/diagnostic/.test(action)) return "diagnostics";
  if (/chat/.test(action)) return "chat_ai";
  if (/thumbnail/.test(action)) return "thumbnail_ai";
  if (/description/.test(action)) return "description_ai";
  if (/title/.test(action)) return "title_ai";
  if (/tag/.test(action)) return "tags_editor";
  if (/video.?optim|optimizer/.test(action)) return "video_optimizer";
  if (/revenue|receipt|faturamento/.test(action)) return "revenue_insights";
  if (/summary/.test(action)) return "summary";
  if (/insight|channelvideos|channelidentity|executaria|gerartextoia/.test(action)) return "intelligence";
  if (/seo/.test(action)) return "seo_explorer";
  return null;
}
function productModule(event: any) {
  const raw = String(event.module || "").trim().toLowerCase();
  const inferred = inferModuleFromAction(event.properties?.action || event.properties?.endpoint || event.properties?.feature);
  const key = (inferred && (["", "extension", "system", "youtube"].includes(raw) || event.event_name === "api_request_succeeded"))
    ? inferred
    : MODULE_ALIASES[raw] || raw || inferred || "extension";
  const context = [raw, event.properties?.action, event.properties?.endpoint, event.properties?.feature].join(" ").toLowerCase();
  const billing = /billing|payment|checkout|subscription|invoice|verificarplano|checksubscription/.test(context);
  return { key: event.event_name === "session_started" || event.event_name === "extension_started" ? (inferred || "extension") : key, billing };
}
const LABELS: Record<string, string> = {
  seo_search: "SEO de Pesquisa", seo_explorer: "SEO Explorer", keyword_explorer: "Keyword Explorer",
  keyword_trends: "Tendências de Palavras-chave", competitor_radar: "Radar de Concorrentes",
  creator_workspace: "Creator Workspace", outliers: "Detector de Outliers", summary: "Resumo do Canal",
  video_optimizer: "Otimizador de Vídeos", video_ai: "IA para Vídeos", video_list_ai: "IA de Lista de Vídeos",
  title_ai: "IA de Títulos", description_ai: "IA de Descrições", thumbnail_ai: "IA de Thumbnails",
  tags_editor: "Editor de Tags", intelligence: "Inteligência TubeX", billing: "Assinaturas e Pagamentos",
  extension: "Extensão TubeX", system: "Sistema", ai_legacy: "IA (módulo não identificado)",
};
const label = (key: string) => LABELS[key] || key.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Recurso não identificado";
const iso = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;

export async function GET(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ownerEmail = String(process.env.OWNER_EMAIL || process.env.NEXT_PUBLIC_OWNER_EMAIL || "gabrielbzago@gmail.com").toLowerCase();
  if (data.user.email.toLowerCase() !== ownerEmail) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const requestedSegment = new URL(request.url).searchParams.get("segment");
  const segment = requestedSegment === "free" ? "free" : "subscribers";

  try {
    const [usersResult, firstEventsResult, installationsResult] = await Promise.all([
      supabaseAdmin.from("users").select("id,email,name,plan,status,stripe_subscription_id,stripe_customer_id"),
      supabaseAdmin.from("tubex_events").select("id,user_id,install_id,event_name,module,properties,session_id,created_at", { count: "exact" }).order("created_at", { ascending: true }).order("id", { ascending: true }).range(0, 999),
      supabaseAdmin.from("tubex_installations").select("install_id,user_id,email,name"),
    ]);
    if (firstEventsResult.error) throw firstEventsResult.error;
    if (usersResult.error) throw usersResult.error;
    const users = usersResult.data || [];
    const events: any[] = [...(firstEventsResult.data || [])];
    const totalEvents = firstEventsResult.count || events.length;
    for (let base = 1000; base < totalEvents; base += 10000) {
      const pages = await Promise.all(Array.from({ length: Math.min(10, Math.ceil((totalEvents - base) / 1000)) }, (_, page) => {
        const start = base + page * 1000;
        return supabaseAdmin.from("tubex_events").select("id,user_id,install_id,event_name,module,properties,session_id,created_at").order("created_at", { ascending: true }).order("id", { ascending: true }).range(start, Math.min(start + 999, totalEvents - 1));
      }));
      for (const page of pages) {
        if (page.error) throw page.error;
        events.push(...(page.data || []));
      }
    }
    const authUsers: any[] = [];
    for (let page = 1; page <= 50; page++) {
      const result = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (result.error) throw result.error;
      authUsers.push(...result.data.users);
      if (result.data.users.length < 1000) break;
    }
    const authById = new Map(authUsers.map((user: any) => [user.id, user]));
    const authByEmail = new Map(authUsers.filter((user: any) => user.email).map((user: any) => [String(user.email).toLowerCase(), user]));
    const installations = installationsResult.data || [];
    const usersById = new Map(users.map((user: any) => [user.id, user]));
    const usersByEmail = new Map(users.filter((user: any) => user.email).map((user: any) => [String(user.email).toLowerCase(), user]));
    const installToUser = new Map<string, string>();
    const installationsById = new Map((installations as any[]).map((install) => [install.install_id, install]));
    for (const install of installations as any[]) {
      const user: any = (install.user_id && usersById.get(install.user_id)) || (install.email && usersByEmail.get(String(install.email).toLowerCase()));
      const authUser: any = (install.user_id && authById.get(install.user_id)) || (install.email && authByEmail.get(String(install.email).toLowerCase()));
      const emailKey = install.email ? `email:${String(install.email).trim().toLowerCase()}` : null;
      if (authUser?.id || user?.id || emailKey) installToUser.set(install.install_id, authUser?.id || user?.id || emailKey!);
    }
    const now = Date.now();
    const recentCutoff = now - 30 * 86400000;
    const accounts = new Map<string, any>();
    const accountFor = (userId: string, identity?: { email?: string | null; name?: string | null }) => {
      const emailKey = userId.startsWith("email:") ? userId.slice(6).toLowerCase() : String(identity?.email || "").trim().toLowerCase();
      const directAuth: any = authById.get(userId);
      const user: any = usersById.get(userId) || (directAuth?.email ? usersByEmail.get(String(directAuth.email).toLowerCase()) : null) || (emailKey ? usersByEmail.get(emailKey) : null);
      const authUser: any = directAuth || (user?.email ? authByEmail.get(String(user.email).toLowerCase()) : null) || (emailKey ? authByEmail.get(emailKey) : null);
      if (!user && !authUser && !emailKey) return null;
      const accountId = authUser?.id || user?.id || (emailKey ? `email:${emailKey}` : userId);
      const addEmails = (target: any) => {
        for (const value of [user?.email, authUser?.email, emailKey, identity?.email, authUser?.user_metadata?.email, ...((authUser?.identities || []).map((item: any) => item?.identity_data?.email))]) {
          const email = String(value || "").trim().toLowerCase();
          if (email) target.emails.add(email);
        }
      };
      if (accounts.has(accountId)) {
        const existing = accounts.get(accountId);
        if (user) {
          existing.name = user.name || existing.name;
          existing.email = user.email || existing.email;
          existing.plan = user.plan || existing.plan;
          existing.accountStatus = user.status || existing.accountStatus;
          existing.subscriptionId = user.stripe_subscription_id || existing.subscriptionId;
        }
        if (authUser) { existing.authUser = authUser; existing.createdAt = authUser.created_at || existing.createdAt; }
        addEmails(existing);
        return existing;
      }
      const row = {
        id: accountId,
        name: user?.name || authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || identity?.name || user?.email || authUser?.email || identity?.email || "Conta",
        email: user?.email || authUser?.email || identity?.email || emailKey || "", plan: user?.plan || "free",
        authUser,
        createdAt: authUser?.created_at || null,
        accountStatus: user?.status || "unknown", subscriptionId: user?.stripe_subscription_id || null,
        firstLoginAt: null as string | null, lastLoginAt: null as string | null, lastActivityAt: null as string | null,
        lastResource: null as string | null, loginMoments: [] as number[],
        sessionMap: new Map<string, { id: string; startedAt: string; lastActivityAt: string; actions: number; modules: Map<string, number> }>(),
        activeDays: new Set<string>(), activeDays30: new Set<string>(), searchCount: 0, totalActions: 0, actions30: 0, moduleMap: new Map<string, { name: string; count: number; lastUsedAt: string }>(),
        subscribedAt: null as string | null, canceledAt: null as string | null, cancelReason: null as string | null,
        lastSubscriptionEvent: null as "activated" | "canceled" | null,
        cancelCode: null as string | null, cancelComment: null as string | null,
        emails: new Set<string>(),
        quotaHits: 0, quotaHits30: 0, lastQuotaAt: null as string | null, quotaFeatures: new Map<string, number>(),
        upgradeClicks: 0, upgradeClicks30: 0, checkoutStarts: 0, checkoutStarts30: 0, pricingViews30: 0, promptViews30: 0, paymentFailures: 0,
        preSubscribeQuotaHits: 0, preSubscribeModules: new Map<string, number>(),
        paymentJourney: [] as Array<{ eventName: string; label: string; at: string; plan: string | null; source: string | null }>,
      };
      addEmails(row);
      accounts.set(accountId, row);
      return row;
    };
    for (const user of users as any[]) accountFor(user.id);
    for (const authUser of authUsers as any[]) accountFor(authUser.id);
    for (const install of installations as any[]) {
      const email = install.email ? String(install.email).trim().toLowerCase() : "";
      const user: any = (install.user_id && usersById.get(install.user_id)) || (email ? usersByEmail.get(email) : null);
      const authUser: any = (install.user_id && authById.get(install.user_id)) || (email ? authByEmail.get(email) : null);
      const accountId = authUser?.id || user?.id || (email ? `email:${email}` : null);
      if (accountId) accountFor(accountId, { email: email || null, name: install.name || null });
    }
    for (const event of events as any[]) {
      const installation: any = installationsById.get(event.install_id);
      const installationIdentity = installation ? { email: installation.email, name: installation.name } : undefined;
      const linkedInstallUserId = installToUser.get(event.install_id);
      const account = (event.user_id ? accountFor(event.user_id, installationIdentity) : null)
        || (linkedInstallUserId ? accountFor(linkedInstallUserId, installationIdentity) : null);
      if (!account) continue;
      const at = iso(event.created_at);
      if (!at) continue;
      const eventName = String(event.event_name || "");
      const eventMs = Date.parse(at);
      const recent = eventMs >= recentCutoff;
      if (eventName === "quota_exhausted") {
        account.quotaHits++;
        if (recent) account.quotaHits30++;
        account.lastQuotaAt = at;
        const feature = label(String(event.properties?.feature || productModule(event).key || "recurso"));
        account.quotaFeatures.set(feature, (account.quotaFeatures.get(feature) || 0) + 1);
        if (account.lastSubscriptionEvent !== "activated") account.preSubscribeQuotaHits++;
      }
      if (eventName === "upgrade_clicked" || eventName === "upgrade_prompt_clicked") { account.upgradeClicks++; if (recent) account.upgradeClicks30++; }
      if (eventName === "checkout_started") { account.checkoutStarts++; if (recent) account.checkoutStarts30++; }
      if (eventName === "pricing_viewed" && recent) account.pricingViews30++;
      if (eventName === "upgrade_prompt_viewed" && recent) account.promptViews30++;
      if (eventName === "payment_failed") account.paymentFailures++;
      if (BILLING_LABELS[eventName]) {
        account.paymentJourney.push({
          eventName,
          label: BILLING_LABELS[eventName],
          at,
          plan: event.properties?.plan ? String(event.properties.plan) : null,
          source: event.properties?.source ? String(event.properties.source) : null,
        });
      }
      if (event.event_name === "login_success") {
        const loginTime = Date.parse(at);
        const previousLogin = account.loginMoments[account.loginMoments.length - 1];
        // The web app and extension can both report the same sign-in. Collapse
        // duplicate reports within two minutes into one authentication.
        if (previousLogin === undefined || loginTime - previousLogin > 120000) account.loginMoments.push(loginTime);
        else account.loginMoments[account.loginMoments.length - 1] = loginTime;
        continue;
      }
      if (event.event_name === "subscription_activated") {
        account.subscribedAt = at;
        account.lastSubscriptionEvent = "activated";
        account.canceledAt = null;
        account.cancelReason = null;
        account.cancelCode = null;
        account.cancelComment = null;
      }
      if (event.event_name === "subscription_cancelled") {
        account.canceledAt = at;
        account.lastSubscriptionEvent = "canceled";
        account.cancelReason = [event.properties?.reason, event.properties?.feedback, event.properties?.comment]
          .map((value) => String(value || "").trim()).filter((value) => value && value !== "not_provided").map((value) => CANCEL_LABELS[value] || value).join(" · ") || "Motivo não informado";
        const feedback = String(event.properties?.feedback || "").trim();
        const reason = String(event.properties?.reason || "").trim();
        account.cancelCode = feedback && feedback !== "not_provided" ? feedback : reason && reason !== "not_provided" ? reason : "not_provided";
        const comment = String(event.properties?.comment || "").trim();
        account.cancelComment = comment || null;
      }
      const { key: moduleKey, billing } = productModule(event);
      if (!MODULE_EVENTS.has(event.event_name) || billing || NON_PRODUCT_MODULES.has(moduleKey) || /billing|payment|checkout|subscription|invoice/.test(moduleKey)) continue;

      account.lastActivityAt = at;
      account.totalActions++;
      account.activeDays.add(at.slice(0, 10));
      if (Date.parse(at) >= recentCutoff) { account.activeDays30.add(at.slice(0, 10)); account.actions30++; }
      // Access token IDs persist across several days, so the activity view is
      // intentionally grouped by calendar day, independently of login count.
      const sessionKey = `day:${at.slice(0, 10)}`;
      const session = account.sessionMap.get(sessionKey) || { id: `Dia ${at.slice(0, 10)}`, startedAt: at, lastActivityAt: at, actions: 0, modules: new Map<string, number>() };
      session.lastActivityAt = at;
      session.actions++;
      if (SEARCH_EVENTS.has(event.event_name)) account.searchCount++;
      const moduleRow = account.moduleMap.get(moduleKey) || { name: label(moduleKey), count: 0, lastUsedAt: at };
      moduleRow.count++;
      moduleRow.lastUsedAt = at;
      account.moduleMap.set(moduleKey, moduleRow);
      session.modules.set(moduleKey, (session.modules.get(moduleKey) || 0) + 1);
      account.lastResource = moduleRow.name;
      if (account.lastSubscriptionEvent !== "activated" && !account.subscribedAt) account.preSubscribeModules.set(moduleRow.name, (account.preSubscribeModules.get(moduleRow.name) || 0) + 1);
      account.sessionMap.set(sessionKey, session);
    }
    const rows = [...accounts.values()].map((account: any) => {
      const lastActivityMs = account.lastActivityAt ? Date.parse(account.lastActivityAt) : 0;
      const daysSinceActivity = lastActivityMs ? Math.floor((now - lastActivityMs) / 86400000) : null;
      // Plano efetivo: mesma regra do site/extensão. Todos os e-mails da conta são
      // consultados e o melhor plano vence (plano pago só com status válido).
      let plan = "free";
      let billingStatus = String(account.accountStatus || "unknown").toLowerCase();
      let subscriptionId = account.subscriptionId;
      let hadPaidRow = false;
      for (const email of account.emails as Set<string>) {
        if (OWNER_EMAILS.has(email)) { plan = "owner"; billingStatus = "active"; continue; }
        const row: any = usersByEmail.get(email);
        if (!row) continue;
        if (row.stripe_subscription_id) hadPaidRow = true;
        const effective = effectivePlanFromRow(row);
        if (planRank(effective.plan) > planRank(plan)) { plan = effective.plan; billingStatus = effective.status || billingStatus; subscriptionId = row.stripe_subscription_id || subscriptionId; }
      }
      const currentSubscriber = PAID.has(plan);
      const pastDue = currentSubscriber && billingStatus === "past_due";
      const canceled = !currentSubscriber && (account.lastSubscriptionEvent === "canceled" || ["canceled", "cancelled"].includes(billingStatus) || (billingStatus === "inactive" && Boolean(subscriptionId || hadPaidRow)));
      const isSubscriber = currentSubscriber || canceled || Boolean(account.subscribedAt);
      const engaged = daysSinceActivity !== null && daysSinceActivity <= 14 && account.activeDays30.size >= 2;
      const usedLast30 = daysSinceActivity !== null && daysSinceActivity <= 30;

      // Status com o porquê. Cada regra vira um motivo legível no painel.
      const reasons: string[] = [];
      let status: "active" | "at_risk" | "inactive" | "canceled";
      if (canceled) {
        status = "canceled";
        reasons.push(account.canceledAt ? `Cancelou em ${account.canceledAt.slice(0, 10)}` : "Assinatura encerrada no Stripe");
      } else if (engaged && !pastDue) {
        status = "active";
        reasons.push(`${account.activeDays30.size} dias com uso nos últimos 30`, `Último uso há ${daysSinceActivity} dia(s)`);
      } else if (usedLast30 || pastDue) {
        status = "at_risk";
        if (pastDue) reasons.push("Pagamento pendente (past_due)");
        if (daysSinceActivity !== null && daysSinceActivity > 14) reasons.push(`Sem uso há ${daysSinceActivity} dias`);
        if (account.activeDays30.size < 2) reasons.push(`Só ${account.activeDays30.size} dia com uso em 30`);
        if (!reasons.length) reasons.push("Uso abaixo do padrão de conta ativa");
      } else {
        status = "inactive";
        reasons.push(daysSinceActivity === null ? "Nenhum uso de recurso registrado" : `Sem uso há ${daysSinceActivity} dias`);
      }

      // Probabilidade de assinar (só para quem não assina hoje).
      const factors: Array<{ label: string; points: number }> = [];
      if (!currentSubscriber) {
        if (account.quotaHits30 > 0) factors.push({ label: `Bateu o limite ${account.quotaHits30}x em 30 dias`, points: account.quotaHits30 >= 3 ? 35 : 25 });
        if (account.checkoutStarts30 > 0) factors.push({ label: "Abriu o checkout e não concluiu", points: 25 });
        else if (account.checkoutStarts > 0) factors.push({ label: "Já abriu o checkout antes", points: 10 });
        if (account.upgradeClicks30 > 0) factors.push({ label: `Clicou em assinar ${account.upgradeClicks30}x`, points: 15 });
        if (account.pricingViews30 + account.promptViews30 > 0) factors.push({ label: "Viu planos ou aviso de upgrade", points: 5 });
        if (account.activeDays30.size >= 5) factors.push({ label: `${account.activeDays30.size} dias ativos em 30`, points: 15 });
        else if (account.activeDays30.size >= 2) factors.push({ label: `${account.activeDays30.size} dias ativos em 30`, points: 8 });
        if (account.actions30 >= 30) factors.push({ label: `${account.actions30} ações em 30 dias`, points: 10 });
        if (daysSinceActivity !== null && daysSinceActivity <= 7) factors.push({ label: "Usou nos últimos 7 dias", points: 5 });
        if (canceled) factors.push({ label: "Já foi assinante", points: 5 });
        if (daysSinceActivity === null || daysSinceActivity > 30) factors.push({ label: "Sem uso há mais de 30 dias", points: -20 });
      }
      const propensity = Math.max(0, Math.min(100, factors.reduce((sum, factor) => sum + factor.points, 0)));
      const propensityTier = currentSubscriber ? null : propensity >= 60 ? "hot" : propensity >= 30 ? "warm" : "cold";
      const preModules = [...account.preSubscribeModules.entries()].sort((a: any, b: any) => b[1] - a[1]);
      const modules = [...account.moduleMap.entries()].map(([key, value]: any) => ({ key, ...value })).sort((a: any, b: any) => b.count - a.count);
      const authUser: any = account.authUser;
      account.loginCount = account.loginMoments.length;
      account.firstLoginAt = account.loginMoments.length ? new Date(account.loginMoments[0]).toISOString() : null;
      account.lastLoginAt = account.loginMoments.length ? new Date(account.loginMoments[account.loginMoments.length - 1]).toISOString() : null;
      const lastLoginAt = account.lastLoginAt || iso(authUser?.last_sign_in_at);
      const returned = account.activeDays.size > 1;
      const returnCount = Math.max(0, account.activeDays.size - 1);
      const highUse = account.activeDays30.size >= 8 || account.actions30 >= 30;
      return {
        id: account.id, name: account.name, email: account.email, plan, billingStatus, status, statusReasons: reasons, createdAt: account.createdAt,
        isSubscriber, currentSubscriber, formerSubscriber: isSubscriber && !currentSubscriber,
        linkedEmails: (account.emails as Set<string>).size,
        subscribedAt: account.subscribedAt, canceledAt: account.canceledAt, cancelReason: account.cancelReason,
        cancelCode: account.cancelCode, cancelLabel: account.cancelCode ? (CANCEL_LABELS[account.cancelCode] || (account.cancelCode === "not_provided" ? "Motivo não informado" : account.cancelCode)) : null, cancelComment: account.cancelComment,
        quotaHits: account.quotaHits, quotaHits30: account.quotaHits30, lastQuotaAt: account.lastQuotaAt,
        quotaFeatures: [...account.quotaFeatures.entries()].map(([name, count]: any) => ({ name, count })).sort((a: any, b: any) => b.count - a.count),
        upgradeClicks: account.upgradeClicks, checkoutStarts: account.checkoutStarts, paymentFailures: account.paymentFailures,
        propensity, propensityTier, propensityFactors: factors,
        subscribeDrivers: { quotaHitsBefore: account.preSubscribeQuotaHits, topModules: preModules.slice(0, 3).map(([name, count]: any) => ({ name, count })) },
        daysSinceActivity,
        firstLoginAt: account.firstLoginAt, lastLoginAt, lastActivityAt: account.lastActivityAt,
        lastResource: account.lastResource, loginCount: account.loginCount, returned,
        returnCount, activeDays: account.activeDays.size, activeDays30: account.activeDays30.size,
        searchCount: account.searchCount, totalActions: account.totalActions, actions30: account.actions30, highUse, modules,
        sessions: [...account.sessionMap.values()].map((session: any) => ({
          id: session.id, startedAt: session.startedAt, lastActivityAt: session.lastActivityAt, actions: session.actions,
          modules: [...session.modules.entries()].map(([key, count]) => ({ name: label(key), count })),
        })).sort((a: any, b: any) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt)).slice(0, 30),
        paymentJourney: account.paymentJourney.slice(-100).reverse(),
      };
    }).filter((account: any) => account.plan !== "owner" && (segment === "subscribers" ? account.isSubscriber : !account.currentSubscriber)).sort((a: any, b: any) => (Date.parse(b.lastActivityAt || "") || 0) - (Date.parse(a.lastActivityAt || "") || 0));
    return NextResponse.json({ accounts: rows, eventCount: totalEvents, segment }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("[TubeX subscriber behavior]", error?.message || error);
    return NextResponse.json({ error: "behavior_unavailable" }, { status: 503 });
  }
}
