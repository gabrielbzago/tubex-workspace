import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEARCH_EVENTS = new Set(["search_submitted", "search_performed", "analysis_completed", "trend_search_completed"]);
const MODULE_EVENTS = new Set([
  "module_opened", "extension_action", "ui_action", "search_submitted", "search_performed", "search_failed",
  "analysis_completed", "analysis_failed", "ai_generation_completed", "quota_exhausted", "competitor_analysis",
  "competitor_analysis_started", "competitor_analysis_failed", "trend_search_completed", "trend_search_failed",
  "summary_viewed", "creator_workspace_opened", "feature_used",
]);
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
    for (const install of installations as any[]) {
      const user = (install.user_id && usersById.get(install.user_id)) || (install.email && usersByEmail.get(String(install.email).toLowerCase()));
      if (user) installToUser.set(install.install_id, (user as any).id);
    }
    const now = Date.now();
    const recentCutoff = now - 30 * 86400000;
    const accounts = new Map<string, any>();
    const accountFor = (userId: string) => {
      if (accounts.has(userId)) return accounts.get(userId);
      const user: any = usersById.get(userId);
      if (!user) return null;
      const authUser: any = authById.get(userId) || (user.email ? authByEmail.get(String(user.email).toLowerCase()) : null);
      const row = {
        id: userId, name: user.name || user.email || "Conta", email: user.email || "", plan: user.plan || "free",
        authUser,
        createdAt: authUser?.created_at || null,
        accountStatus: user.status || "unknown", subscriptionId: user.stripe_subscription_id || null,
        firstLoginAt: null as string | null, lastLoginAt: null as string | null, lastActivityAt: null as string | null,
        lastResource: null as string | null, loginCount: 0, returnCount: 0, sessionIds: new Set<string>(),
        sessionMap: new Map<string, { id: string; startedAt: string; lastActivityAt: string; actions: number; login: boolean; modules: Map<string, number> }>(),
        activeDays: new Set<string>(), activeDays30: new Set<string>(), searchCount: 0, totalActions: 0, actions30: 0, moduleMap: new Map<string, { name: string; count: number; lastUsedAt: string }>(),
        subscribedAt: null as string | null, canceledAt: null as string | null, cancelReason: null as string | null,
        lastSubscriptionEvent: null as "activated" | "canceled" | null,
      };
      accounts.set(userId, row);
      return row;
    };
    for (const event of events as any[]) {
      const userId = event.user_id || installToUser.get(event.install_id);
      if (!userId) continue;
      const account = accountFor(userId);
      if (!account) continue;
      const at = iso(event.created_at);
      if (!at) continue;
      account.lastActivityAt = at;
      account.totalActions++;
      account.activeDays.add(at.slice(0, 10));
      if (Date.parse(at) >= recentCutoff) { account.activeDays30.add(at.slice(0, 10)); account.actions30++; }
      const sessionKey = event.session_id ? String(event.session_id) : `day:${at.slice(0, 10)}`;
      const session = account.sessionMap.get(sessionKey) || { id: sessionKey.startsWith("day:") ? `Dia ${at.slice(0, 10)}` : sessionKey, startedAt: at, lastActivityAt: at, actions: 0, login: false, modules: new Map<string, number>() };
      session.lastActivityAt = at;
      session.actions++;
      if (event.event_name === "login_success") {
        account.loginCount++;
        if (!account.firstLoginAt) account.firstLoginAt = at;
        account.lastLoginAt = at;
        session.login = true;
        if (event.session_id) account.sessionIds.add(event.session_id);
      }
      if (event.event_name === "subscription_activated") {
        account.subscribedAt = at;
        account.lastSubscriptionEvent = "activated";
        account.canceledAt = null;
        account.cancelReason = null;
      }
      if (event.event_name === "subscription_cancelled") {
        account.canceledAt = at;
        account.lastSubscriptionEvent = "canceled";
        account.cancelReason = [event.properties?.reason, event.properties?.feedback, event.properties?.comment]
          .map((value) => String(value || "").trim()).filter((value) => value && value !== "not_provided").join(" · ") || "Motivo não informado";
      }
      if (SEARCH_EVENTS.has(event.event_name)) account.searchCount++;
      if (MODULE_EVENTS.has(event.event_name)) {
        const moduleKey = String(event.module || event.properties?.feature || "extension").toLowerCase();
        const moduleRow = account.moduleMap.get(moduleKey) || { name: label(moduleKey), count: 0, lastUsedAt: at };
        moduleRow.count++;
        moduleRow.lastUsedAt = at;
        account.moduleMap.set(moduleKey, moduleRow);
        session.modules.set(moduleKey, (session.modules.get(moduleKey) || 0) + 1);
        account.lastResource = moduleRow.name;
      }
      account.sessionMap.set(sessionKey, session);
    }
    const rows = [...accounts.values()].map((account: any) => {
      const lastActivityMs = account.lastActivityAt ? Date.parse(account.lastActivityAt) : 0;
      const subStatus = String(account.accountStatus).toLowerCase();
      const canceled = account.lastSubscriptionEvent === "canceled" || ["canceled", "cancelled"].includes(subStatus);
      const isSubscriber = Boolean(account.subscriptionId || account.subscribedAt || canceled || ["pro", "expert", "start"].includes(String(account.plan).toLowerCase()));
      const regular = lastActivityMs > 0 && now - lastActivityMs <= 30 * 86400000 && account.activeDays30.size >= 2;
      const status = canceled ? "canceled" : regular ? "active" : "at_risk";
      const modules = [...account.moduleMap.entries()].map(([key, value]: any) => ({ key, ...value })).sort((a: any, b: any) => b.count - a.count);
      const authUser: any = account.authUser;
      const lastLoginAt = account.lastLoginAt || iso(authUser?.last_sign_in_at);
      const returned = account.loginCount > 1 || account.sessionIds.size > 1 || Boolean(authUser?.last_sign_in_at && authUser?.created_at && Date.parse(authUser.last_sign_in_at) - Date.parse(authUser.created_at) > 86400000);
      const returnCount = Math.max(account.loginCount - 1, returned ? 1 : 0);
      const highUse = account.activeDays30.size >= 8 || account.actions30 >= 30;
      return {
        id: account.id, name: account.name, email: account.email, plan: account.plan, status, createdAt: account.createdAt,
        isSubscriber, subscribedAt: account.subscribedAt, canceledAt: account.canceledAt, cancelReason: account.cancelReason,
        firstLoginAt: account.firstLoginAt, lastLoginAt, lastActivityAt: account.lastActivityAt,
        lastResource: account.lastResource, loginCount: account.loginCount, returned,
        returnCount, activeDays: account.activeDays.size, activeDays30: account.activeDays30.size,
        searchCount: account.searchCount, totalActions: account.totalActions, actions30: account.actions30, highUse, modules,
        sessions: [...account.sessionMap.values()].map((session: any) => ({
          id: session.id, startedAt: session.startedAt, lastActivityAt: session.lastActivityAt, actions: session.actions, login: session.login,
          modules: [...session.modules.entries()].map(([key, count]) => ({ name: label(key), count })),
        })).sort((a: any, b: any) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt)).slice(0, 30),
      };
    }).filter((account: any) => account.isSubscriber).sort((a: any, b: any) => (Date.parse(b.lastActivityAt || "") || 0) - (Date.parse(a.lastActivityAt || "") || 0));
    return NextResponse.json({ accounts: rows, eventCount: totalEvents }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("[TubeX subscriber behavior]", error?.message || error);
    return NextResponse.json({ error: "behavior_unavailable" }, { status: 503 });
  }
}
