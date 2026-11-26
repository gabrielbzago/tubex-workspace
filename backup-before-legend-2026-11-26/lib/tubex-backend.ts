import { supabaseAdmin } from "@/lib/supabase-admin";

export async function getAuthenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return data.user;
}

export async function getAuthenticatedPlan(userId: string, email?: string | null) {
  try {
    const byId = await supabaseAdmin.from("users").select("plan").eq("id", userId).maybeSingle();
    const normalizePlan = (value: unknown) => {
      const plan = String(value || "free").toLowerCase().trim();
      return ["owner", "admin", "administrator"].includes(plan) ? "expert" : plan;
    };
    if (byId.data?.plan) return normalizePlan(byId.data.plan);
    if (email) {
      const byEmail = await supabaseAdmin.from("users").select("plan").eq("email", email.toLowerCase()).maybeSingle();
      if (byEmail.data?.plan) return normalizePlan(byEmail.data.plan);
    }
  } catch {}
  return "free";
}

export async function callTubeXBackend(path: "/youtube" | "/youtube-channel" | "/trends" | "/ai", body: Record<string, unknown>) {
  // Mesma chave e endpoint usados pelo background.js da extensão TubeX.
  // A extensão já distribui esta chave no cliente; aqui ela permanece somente
  // no servidor Next.js e nunca é enviada ao navegador.
  const apiKey = "tubex_secure_2026_ultra";
  const baseUrl = "https://tubex-backend.vercel.app/api";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "x-client": "tubex-extension-v1" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(String(payload?.message || payload?.error || `Backend TubeX respondeu HTTP ${response.status}`)) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export function getTrendSeries(payload: any, range: "7d" | "30d" | "12m") {
  const rangeKeys = range === "7d"
    ? ["trend7d", "last7Days", "week"]
    : range === "30d"
      ? ["trend30d", "last30Days", "month"]
      : ["trend12m", "last12Months", "year"];
  const containers = [payload, payload?.data, payload?.result, payload?.results, payload?.response, payload?.default, payload?.data?.default, payload?.result?.default];
  const candidates: any[] = [];
  for (const container of containers) {
    if (!container || typeof container !== "object") continue;
    for (const key of [...rangeKeys, "trend", "history", "trendHistory", "timelineData", "interestOverTime", "points", "values"]) {
      candidates.push(container?.[key]);
    }
  }
  const isPoint = (point: any) => {
    if (Array.isArray(point)) return point.length >= 2 && Number.isFinite(Number(point[1]?.value ?? point[1]));
    if (!point || typeof point !== "object") return Number.isFinite(Number(point));
    const raw = point.value ?? point.score ?? point.interest ?? point.y ?? point.values?.[0] ?? point.data?.value ?? point.data?.[0];
    return raw !== undefined && Number.isFinite(Number(raw));
  };
  const found = candidates.find(value => Array.isArray(value) && value.length >= 2 && value.every(isPoint));
  if (found) return found;
  // Alguns retornos do Google Trends encapsulam timelineData em estruturas internas.
  const queue: any[] = containers.filter(Boolean);
  const seen = new Set<any>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    if (Array.isArray(current) && current.length >= 2 && current.every(isPoint)) return current;
    if (Array.isArray(current)) queue.push(...current);
    else queue.push(...Object.values(current));
  }
  return null;
}


export async function consumeKeywordUsage(userId: string, keyword: string, dailyLimit: number) {
  const { data, error } = await supabaseAdmin.rpc("consume_tubex_keyword_usage", {
    p_user_id: userId,
    p_keyword: keyword,
    p_daily_limit: dailyLimit,
  });
  if (error) throw new Error(`tubex_keyword_usage: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("tubex_keyword_usage: resposta vazia do controle de uso");
  return {
    allowed: Boolean(row.allowed),
    used: Number(row.used || 0),
    limit: Number(row.daily_limit || dailyLimit),
    usageId: row.usage_id === null || row.usage_id === undefined ? null : Number(row.usage_id),
  };
}

export async function releaseKeywordUsage(usageId: number, userId: string) {
  const { error } = await supabaseAdmin
    .from("tubex_keyword_usage")
    .delete()
    .eq("id", usageId)
    .eq("user_id", userId);
  if (error) throw new Error(`tubex_keyword_usage_release: ${error.message}`);
}
