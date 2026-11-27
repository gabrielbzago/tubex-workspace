/**
 * TubeX · YouTube Analytics (API v2) — biblioteca reutilizável.
 *
 * Funciona no navegador e no servidor: todas as funções recebem o access token do Google
 * (OAuth com yt-analytics.readonly). Cada bloco do relatório é independente: se uma métrica
 * não estiver disponível (ex.: impressões/CTR, receita sem permissão), o restante continua.
 *
 * Uso típico:
 *   const token = await getGoogleAccessToken();             // lib/tubex-google-token-client.ts
 *   const report = await fetchChannelAnalytics(token, { days: 28 });
 *   const video  = await fetchVideoAnalytics(token, "VIDEO_ID", { days: 28 });
 *   const text   = summarizeChannelAnalytics(report);       // resumo pronto para prompts da IA
 */

const ANALYTICS = "https://youtubeanalytics.googleapis.com/v2/reports";
const DATA_API = "https://www.googleapis.com/youtube/v3";
const TOKENINFO = "https://oauth2.googleapis.com/tokeninfo";

export const YT_SCOPE = {
  readonly: "https://www.googleapis.com/auth/youtube.readonly",
  forceSsl: "https://www.googleapis.com/auth/youtube.force-ssl",
  analytics: "https://www.googleapis.com/auth/yt-analytics.readonly",
  monetary: "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
} as const;

/* ---------------------------------- tipos ---------------------------------- */

/** expired = token vencido (401) · scope = falta permissão · unsupported = métrica indisponível (400) · quota = limite diário */
export type AnalyticsErrorKind = "expired" | "scope" | "unsupported" | "quota" | "no_channel" | "network" | "error";
export type Section<T> = { ok: true; data: T } | { ok: false; error: AnalyticsErrorKind; message: string };

export type AnalyticsRange = { startDate: string; endDate: string; days: number };
export type CoreTotals = {
  views: number; minutesWatched: number; avgViewDuration: number; avgViewPercentage: number;
  subscribersGained: number; subscribersLost: number; likes: number; dislikes: number; comments: number; shares: number;
};
export type ReachTotals = { impressions: number; ctr: number };
export type RevenueTotals = { estimatedRevenue: number; adRevenue: number; grossRevenue: number; cpm: number; playbackCpm: number; monetizedPlaybacks: number };
export type DailyPoint = { day: string; views: number; minutesWatched: number; subscribersGained: number; subscribersLost: number };
export type Slice = { key: string; label: string; value: number; share: number; minutes?: number };
export type DemographicRow = { ageGroup: string; gender: string; percentage: number };
export type TopVideo = {
  id: string; title: string; thumbnail: string; publishedAt: string; durationSeconds: number;
  views: number; minutesWatched: number; avgViewDuration: number; avgViewPercentage: number;
  subscribersGained: number; likes: number; comments: number; shares: number;
};
export type RetentionPoint = { ratio: number; watchRatio: number; relative: number };

export type GoogleScopes = {
  valid: boolean; expiresIn: number; email: string; scopes: string[];
  readonly: boolean; forceSsl: boolean; analytics: boolean; monetary: boolean;
};

export type ChannelAnalytics = {
  range: AnalyticsRange;
  fetchedAt: string;
  core: Section<CoreTotals>;
  previous: Section<CoreTotals>;
  reach: Section<ReachTotals>;
  revenue: Section<RevenueTotals>;
  daily: Section<DailyPoint[]>;
  traffic: Section<Slice[]>;
  contentTypes: Section<Slice[]>;
  devices: Section<Slice[]>;
  countries: Section<Slice[]>;
  subscribedStatus: Section<Slice[]>;
  demographics: Section<DemographicRow[]>;
  topVideos: Section<TopVideo[]>;
};

export type VideoAnalytics = {
  videoId: string;
  range: AnalyticsRange;
  fetchedAt: string;
  core: Section<CoreTotals>;
  reach: Section<ReachTotals>;
  revenue: Section<RevenueTotals>;
  daily: Section<DailyPoint[]>;
  retention: Section<RetentionPoint[]>;
  traffic: Section<Slice[]>;
  searchTerms: Section<Slice[]>;
  devices: Section<Slice[]>;
  countries: Section<Slice[]>;
  demographics: Section<DemographicRow[]>;
};

export type CommentsCheck =
  | { status: "ok"; videoId: string; read: number; total: number; sample: { author: string; text: string }[] }
  | { status: "disabled" | "scope" | "expired" | "quota" | "no_videos" | "error"; videoId?: string; message: string };

/* ------------------------------ rótulos PT-BR ------------------------------ */

export const TRAFFIC_LABELS: Record<string, string> = {
  YT_SEARCH: "Pesquisa do YouTube", RELATED_VIDEO: "Vídeos sugeridos", SUBSCRIBER: "Feed de inscrições e Início",
  BROWSE: "Início e navegação", YT_CHANNEL: "Páginas do canal", EXT_URL: "Sites e apps externos", NO_LINK_OTHER: "Acesso direto ou desconhecido",
  PLAYLIST: "Playlists", YT_PLAYLIST_PAGE: "Páginas de playlist", NOTIFICATION: "Notificações", SHORTS: "Feed de Shorts",
  END_SCREEN: "Telas finais", ANNOTATION: "Cards e anotações", HASHTAGS: "Hashtags", YT_OTHER_PAGE: "Outras páginas do YouTube",
  CAMPAIGN_CARD: "Campanhas", ADVERTISING: "Anúncios", PROMOTED: "Promoção", SOUND_PAGE: "Páginas de áudio", LIVE_REDIRECT: "Redirecionamento de live",
  SHORTS_CONTENT_LINKS: "Links em Shorts", PRODUCT_PAGE: "Páginas de produto", IMMERSIVE_LIVE: "Lives imersivas", VIDEO_REMIXES: "Remixes",
};
export const DEVICE_LABELS: Record<string, string> = { MOBILE: "Celular", DESKTOP: "Computador", TABLET: "Tablet", TV: "TV", GAME_CONSOLE: "Console", UNKNOWN_PLATFORM: "Outros" };
export const CONTENT_LABELS: Record<string, string> = { SHORTS: "Shorts", VIDEO_ON_DEMAND: "Vídeos longos", LIVE_STREAM: "Lives", STORY: "Stories", UNSPECIFIED: "Outros" };
export const SUBSCRIBED_LABELS: Record<string, string> = { SUBSCRIBED: "Inscritos", UNSUBSCRIBED: "Não inscritos" };
export const AGE_LABELS: Record<string, string> = { "age13-17": "13–17", "age18-24": "18–24", "age25-34": "25–34", "age35-44": "35–44", "age45-54": "45–54", "age55-64": "55–64", "age65-": "65+" };
export const GENDER_LABELS: Record<string, string> = { female: "Mulheres", male: "Homens", user_specified: "Outro" };

export function countryName(code: string) {
  try { return new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(code) || code; } catch { return code; }
}

/* -------------------------------- utilidades ------------------------------- */

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Intervalo dos últimos N dias (o YouTube consolida os dados com ~2 dias de atraso). */
export function rangeForDays(days: number, endOffsetDays = 0): AnalyticsRange {
  const end = new Date(Date.now() - endOffsetDays * 86400000);
  const start = new Date(end.getTime() - (Math.max(1, days) - 1) * 86400000);
  return { startDate: iso(start), endDate: iso(end), days: Math.max(1, days) };
}
function previousRange(r: AnalyticsRange): AnalyticsRange {
  const end = new Date(Date.parse(r.startDate) - 86400000);
  const start = new Date(end.getTime() - (r.days - 1) * 86400000);
  return { startDate: iso(start), endDate: iso(end), days: r.days };
}

export class AnalyticsError extends Error {
  constructor(public kind: AnalyticsErrorKind, message: string, public status = 0, public reason = "") { super(message); }
}

function classify(status: number, reason: string, message: string): AnalyticsErrorKind {
  if (status === 401) return "expired";
  if (/insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient authentication scopes|PERMISSION_DENIED/i.test(`${reason} ${message}`)) return "scope";
  if (/quota|rateLimit|RESOURCE_EXHAUSTED/i.test(reason) || status === 429) return "quota";
  if (/youtubeSignupRequired|channelNotFound|no channel/i.test(`${reason} ${message}`)) return "no_channel";
  if (status === 400) return "unsupported";
  if (status === 403) return "scope";
  return "error";
}

async function getJson(url: string, token: string) {
  let r: Response;
  try { r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }); }
  catch (e: any) { throw new AnalyticsError("network", e?.message || "Falha de rede ao falar com o Google."); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const reason = String(d?.error?.errors?.[0]?.reason || d?.error?.status || "");
    const message = String(d?.error?.message || `Google API ${r.status}`);
    throw new AnalyticsError(classify(r.status, reason, message), message, r.status, reason);
  }
  return d;
}

type Report = { columnHeaders?: { name: string }[]; rows?: any[][] };

/** Consulta crua ao endpoint reports (ids=channel==MINE). Exportada para usos específicos. */
export async function analyticsReport(token: string, range: AnalyticsRange, params: Record<string, string>): Promise<Report> {
  const q = new URLSearchParams({ ids: "channel==MINE", startDate: range.startDate, endDate: range.endDate, ...params });
  return getJson(`${ANALYTICS}?${q}`, token);
}

function rowsAsObjects(rep: Report) {
  const cols = (rep.columnHeaders || []).map((c) => c.name);
  return (rep.rows || []).map((row) => Object.fromEntries(cols.map((c, i) => [c, row[i]])) as Record<string, any>);
}
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

async function section<T>(run: () => Promise<T>): Promise<Section<T>> {
  try { return { ok: true, data: await run() }; }
  catch (e: any) {
    const kind: AnalyticsErrorKind = e instanceof AnalyticsError ? e.kind : "error";
    return { ok: false, error: kind, message: String(e?.message || "Erro desconhecido") };
  }
}

/* ------------------------------- permissões -------------------------------- */

/** Quais permissões o token realmente tem (consulta o tokeninfo do Google). */
export async function checkGoogleScopes(token: string): Promise<GoogleScopes> {
  const empty: GoogleScopes = { valid: false, expiresIn: 0, email: "", scopes: [], readonly: false, forceSsl: false, analytics: false, monetary: false };
  if (!token) return empty;
  try {
    const r = await fetch(`${TOKENINFO}?access_token=${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!r.ok) return empty;
    const d = await r.json();
    const scopes = String(d.scope || "").split(/\s+/).filter(Boolean);
    const has = (s: string) => scopes.includes(s);
    return {
      valid: true, expiresIn: num(d.expires_in), email: String(d.email || ""), scopes,
      // force-ssl também libera leitura dos dados do canal.
      readonly: has(YT_SCOPE.readonly) || has(YT_SCOPE.forceSsl) || has("https://www.googleapis.com/auth/youtube"),
      forceSsl: has(YT_SCOPE.forceSsl) || has("https://www.googleapis.com/auth/youtube"),
      analytics: has(YT_SCOPE.analytics) || has(YT_SCOPE.monetary),
      monetary: has(YT_SCOPE.monetary),
    };
  } catch { return empty; }
}

/* ------------------------------- blocos base ------------------------------- */

const CORE_METRICS = "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,dislikes,comments,shares";

async function core(token: string, range: AnalyticsRange, filters?: string): Promise<CoreTotals> {
  const rep = await analyticsReport(token, range, { metrics: CORE_METRICS, ...(filters ? { filters } : {}) });
  const r = rowsAsObjects(rep)[0] || {};
  return {
    views: num(r.views), minutesWatched: num(r.estimatedMinutesWatched), avgViewDuration: num(r.averageViewDuration),
    avgViewPercentage: num(r.averageViewPercentage), subscribersGained: num(r.subscribersGained), subscribersLost: num(r.subscribersLost),
    likes: num(r.likes), dislikes: num(r.dislikes), comments: num(r.comments), shares: num(r.shares),
  };
}

// Impressões/CTR da miniatura: métricas recentes da API. Se o Google recusar (400), lembramos e não insistimos.
let reachUnsupported = false;
async function reach(token: string, range: AnalyticsRange, filters?: string): Promise<ReachTotals> {
  if (reachUnsupported) throw new AnalyticsError("unsupported", "O Google ainda não libera impressões/CTR por API para este canal.");
  try {
    const rep = await analyticsReport(token, range, { metrics: "videoThumbnailImpressions,videoThumbnailImpressionsClickRate", ...(filters ? { filters } : {}) });
    const r = rowsAsObjects(rep)[0] || {};
    // A API devolve o CTR como fração (0.054) em alguns canais e como % (5.4) em outros: normalizamos para %.
    const raw = num(r.videoThumbnailImpressionsClickRate);
    return { impressions: num(r.videoThumbnailImpressions), ctr: raw > 0 && raw <= 1 ? raw * 100 : raw };
  } catch (e: any) {
    if (e instanceof AnalyticsError && e.kind === "unsupported") reachUnsupported = true;
    throw e;
  }
}

async function revenue(token: string, range: AnalyticsRange, filters?: string): Promise<RevenueTotals> {
  const rep = await analyticsReport(token, range, { metrics: "estimatedRevenue,estimatedAdRevenue,grossRevenue,cpm,playbackBasedCpm,monetizedPlaybacks", currency: "BRL", ...(filters ? { filters } : {}) });
  const r = rowsAsObjects(rep)[0] || {};
  return { estimatedRevenue: num(r.estimatedRevenue), adRevenue: num(r.estimatedAdRevenue), grossRevenue: num(r.grossRevenue), cpm: num(r.cpm), playbackCpm: num(r.playbackBasedCpm), monetizedPlaybacks: num(r.monetizedPlaybacks) };
}

async function daily(token: string, range: AnalyticsRange, filters?: string): Promise<DailyPoint[]> {
  const rep = await analyticsReport(token, range, { metrics: "views,estimatedMinutesWatched,subscribersGained,subscribersLost", dimensions: "day", sort: "day", ...(filters ? { filters } : {}) });
  return rowsAsObjects(rep).map((r) => ({ day: String(r.day), views: num(r.views), minutesWatched: num(r.estimatedMinutesWatched), subscribersGained: num(r.subscribersGained), subscribersLost: num(r.subscribersLost) }));
}

async function slices(token: string, range: AnalyticsRange, dimension: string, labels: Record<string, string> | ((k: string) => string), opts: { filters?: string; max?: number; minutes?: boolean } = {}): Promise<Slice[]> {
  const metrics = opts.minutes ? "views,estimatedMinutesWatched" : "views";
  const rep = await analyticsReport(token, range, { metrics, dimensions: dimension, sort: "-views", ...(opts.max ? { maxResults: String(opts.max) } : {}), ...(opts.filters ? { filters: opts.filters } : {}) });
  const rows = rowsAsObjects(rep);
  const total = rows.reduce((s, r) => s + num(r.views), 0) || 1;
  const label = typeof labels === "function" ? labels : (k: string) => labels[k] || k;
  return rows.map((r) => ({ key: String(r[dimension]), label: label(String(r[dimension])), value: num(r.views), share: num(r.views) / total, ...(opts.minutes ? { minutes: num(r.estimatedMinutesWatched) } : {}) }));
}

async function demographics(token: string, range: AnalyticsRange, filters?: string): Promise<DemographicRow[]> {
  const rep = await analyticsReport(token, range, { metrics: "viewerPercentage", dimensions: "ageGroup,gender", sort: "gender,ageGroup", ...(filters ? { filters } : {}) });
  return rowsAsObjects(rep).map((r) => ({ ageGroup: String(r.ageGroup), gender: String(r.gender), percentage: num(r.viewerPercentage) }));
}

function isoSeconds(isoDur: string) {
  const m = String(isoDur).match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? num(m[1]) * 86400 + num(m[2]) * 3600 + num(m[3]) * 60 + num(m[4]) : 0;
}

/** Título/miniatura/duração dos vídeos (YouTube Data API), em lotes de 50. */
export async function fetchVideoMeta(token: string, ids: string[]) {
  const out = new Map<string, { title: string; thumbnail: string; publishedAt: string; durationSeconds: number }>();
  for (let i = 0; i < ids.length; i += 50) {
    const p = new URLSearchParams({ part: "snippet,contentDetails", id: ids.slice(i, i + 50).join(","), maxResults: "50" });
    const d = await getJson(`${DATA_API}/videos?${p}`, token).catch(() => ({ items: [] }));
    for (const v of d.items || []) out.set(String(v.id), {
      title: v.snippet?.title || "Sem título",
      thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || "",
      publishedAt: v.snippet?.publishedAt || "", durationSeconds: isoSeconds(v.contentDetails?.duration || ""),
    });
  }
  return out;
}

async function topVideos(token: string, range: AnalyticsRange, max = 25): Promise<TopVideo[]> {
  const rep = await analyticsReport(token, range, {
    metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,likes,comments,shares",
    dimensions: "video", sort: "-views", maxResults: String(Math.min(200, max)),
  });
  const rows = rowsAsObjects(rep);
  const meta = await fetchVideoMeta(token, rows.map((r) => String(r.video)));
  return rows.map((r) => {
    const m = meta.get(String(r.video));
    return {
      id: String(r.video), title: m?.title || "Vídeo", thumbnail: m?.thumbnail || `https://i.ytimg.com/vi/${r.video}/mqdefault.jpg`,
      publishedAt: m?.publishedAt || "", durationSeconds: m?.durationSeconds || 0,
      views: num(r.views), minutesWatched: num(r.estimatedMinutesWatched), avgViewDuration: num(r.averageViewDuration), avgViewPercentage: num(r.averageViewPercentage),
      subscribersGained: num(r.subscribersGained), likes: num(r.likes), comments: num(r.comments), shares: num(r.shares),
    };
  });
}

async function retention(token: string, range: AnalyticsRange, videoId: string): Promise<RetentionPoint[]> {
  const rep = await analyticsReport(token, range, { metrics: "audienceWatchRatio,relativeRetentionPerformance", dimensions: "elapsedVideoTimeRatio", filters: `video==${videoId}`, sort: "elapsedVideoTimeRatio" });
  return rowsAsObjects(rep).map((r) => ({ ratio: num(r.elapsedVideoTimeRatio), watchRatio: num(r.audienceWatchRatio), relative: num(r.relativeRetentionPerformance) }));
}

/* ------------------------------ relatórios ------------------------------ */

export type ReportOptions = { days?: number; range?: AnalyticsRange; topVideos?: number; skipRevenue?: boolean };

/** Relatório completo do canal. Nunca lança: cada bloco traz ok/erro. */
export async function fetchChannelAnalytics(token: string, opts: ReportOptions = {}): Promise<ChannelAnalytics> {
  const range = opts.range || rangeForDays(opts.days || 28);
  const prev = previousRange(range);
  const [c, p, rc, rv, d, tr, ct, dv, co, ss, dm, tv] = await Promise.all([
    section(() => core(token, range)),
    section(() => core(token, prev)),
    section(() => reach(token, range)),
    opts.skipRevenue ? Promise.resolve<Section<RevenueTotals>>({ ok: false, error: "scope", message: "Receita não solicitada." }) : section(() => revenue(token, range)),
    section(() => daily(token, range)),
    section(() => slices(token, range, "insightTrafficSourceType", TRAFFIC_LABELS, { minutes: true })),
    section(() => slices(token, range, "creatorContentType", CONTENT_LABELS, { minutes: true })),
    section(() => slices(token, range, "deviceType", DEVICE_LABELS)),
    section(() => slices(token, range, "country", countryName, { max: 10, minutes: true })),
    section(() => slices(token, range, "subscribedStatus", SUBSCRIBED_LABELS)),
    section(() => demographics(token, range)),
    section(() => topVideos(token, range, opts.topVideos || 25)),
  ]);
  return { range, fetchedAt: new Date().toISOString(), core: c, previous: p, reach: rc, revenue: rv, daily: d, traffic: tr, contentTypes: ct, devices: dv, countries: co, subscribedStatus: ss, demographics: dm, topVideos: tv };
}

/**
 * Relatório de um vídeo. Por padrão usa o período desde a publicação (lifetime);
 * passe days para um recorte (ex.: 28).
 */
export async function fetchVideoAnalytics(token: string, videoId: string, opts: ReportOptions & { publishedAt?: string } = {}): Promise<VideoAnalytics> {
  let range = opts.range || (opts.days ? rangeForDays(opts.days) : null);
  if (!range) {
    const pub = Date.parse(opts.publishedAt || "");
    const start = Number.isFinite(pub) ? new Date(pub) : new Date("2005-04-23");
    const days = Math.max(1, Math.ceil((Date.now() - start.getTime()) / 86400000) + 1);
    range = { startDate: iso(start), endDate: iso(new Date()), days };
  }
  const f = `video==${videoId}`;
  const [c, rc, rv, d, rt, tr, st, dv, co, dm] = await Promise.all([
    section(() => core(token, range!, f)),
    section(() => reach(token, range!, f)),
    opts.skipRevenue ? Promise.resolve<Section<RevenueTotals>>({ ok: false, error: "scope", message: "Receita não solicitada." }) : section(() => revenue(token, range!, f)),
    section(() => daily(token, range!.days > 400 ? rangeForDays(365) : range!, f)),
    section(() => retention(token, range!, videoId)),
    section(() => slices(token, range!, "insightTrafficSourceType", TRAFFIC_LABELS, { filters: f, minutes: true })),
    section(() => slices(token, range!, "insightTrafficSourceDetail", (k) => k, { filters: `${f};insightTrafficSourceType==YT_SEARCH`, max: 15 })),
    section(() => slices(token, range!, "deviceType", DEVICE_LABELS, { filters: f })),
    section(() => slices(token, range!, "country", countryName, { filters: f, max: 8 })),
    section(() => demographics(token, range!, f)),
  ]);
  return { videoId, range, fetchedAt: new Date().toISOString(), core: c, reach: rc, revenue: rv, daily: d, retention: rt, traffic: tr, searchTerms: st, devices: dv, countries: co, demographics: dm };
}

/* ------------------------------- comentários ------------------------------- */

/** Testa a leitura de comentários (commentThreads.list) em um vídeo do próprio canal. */
export async function checkCommentsAccess(token: string, videoIds: string[]): Promise<CommentsCheck> {
  if (!videoIds.length) return { status: "no_videos", message: "O canal ainda não tem vídeos públicos." };
  let last: CommentsCheck = { status: "error", message: "Não foi possível testar." };
  for (const videoId of videoIds.slice(0, 4)) {
    try {
      const p = new URLSearchParams({ part: "snippet", videoId, maxResults: "20", order: "time", textFormat: "plainText" });
      const d = await getJson(`${DATA_API}/commentThreads?${p}`, token);
      const items = d.items || [];
      return {
        status: "ok", videoId, read: items.length, total: num(d.pageInfo?.totalResults || items.length),
        sample: items.slice(0, 3).map((it: any) => ({ author: it.snippet?.topLevelComment?.snippet?.authorDisplayName || "Usuário", text: String(it.snippet?.topLevelComment?.snippet?.textOriginal || "").slice(0, 140) })),
      };
    } catch (e: any) {
      const reason = String(e?.reason || "");
      // Comentários desativados neste vídeo: tenta o próximo.
      if (/commentsDisabled|videoNotFound|forbidden/i.test(reason) && e?.status !== 401 && !/insufficient/i.test(reason)) { last = { status: "disabled", videoId, message: "Comentários desativados neste vídeo." }; continue; }
      const kind = e instanceof AnalyticsError ? e.kind : "error";
      return { status: kind === "expired" ? "expired" : kind === "scope" ? "scope" : kind === "quota" ? "quota" : "error", videoId, message: String(e?.message || "") };
    }
  }
  return last;
}

/* ---------------------------- resumo para a IA ---------------------------- */

const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
const int = (v: number) => Math.round(v).toLocaleString("pt-BR");
export const fmtDuration = (s: number) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return h ? `${h}h${String(m).padStart(2, "0")}m` : `${m}:${String(r).padStart(2, "0")}`; };

/** Texto compacto (≈1.5k caracteres) com os números do canal, pronto para prompt. */
export function summarizeChannelAnalytics(a: ChannelAnalytics): string {
  const L: string[] = [`ANALYTICS DO CANAL (YouTube Analytics, ${a.range.startDate} a ${a.range.endDate}, ${a.range.days} dias)`];
  if (a.core.ok) {
    const c = a.core.data;
    L.push(`Views ${int(c.views)} · Horas assistidas ${int(c.minutesWatched / 60)} · Duração média ${fmtDuration(c.avgViewDuration)} · % média assistida ${pct(c.avgViewPercentage)}`);
    L.push(`Inscritos +${int(c.subscribersGained)} / -${int(c.subscribersLost)} (líquido ${int(c.subscribersGained - c.subscribersLost)}) · Likes ${int(c.likes)} · Comentários ${int(c.comments)} · Compartilhamentos ${int(c.shares)}`);
    if (a.previous.ok && a.previous.data.views) L.push(`Período anterior: views ${int(a.previous.data.views)} (${pct(((c.views - a.previous.data.views) / a.previous.data.views) * 100)} de variação)`);
  } else L.push(`Métricas principais indisponíveis: ${a.core.message}`);
  if (a.reach.ok) L.push(`Impressões ${int(a.reach.data.impressions)} · CTR ${pct(a.reach.data.ctr)}`);
  if (a.revenue.ok) L.push(`Receita estimada R$ ${a.revenue.data.estimatedRevenue.toFixed(2)} · CPM R$ ${a.revenue.data.cpm.toFixed(2)}`);
  const top = (s: Section<Slice[]>, n = 5) => (s.ok ? s.data.slice(0, n).map((x) => `${x.label} ${pct(x.share * 100)}`).join(", ") : "");
  if (a.traffic.ok) L.push(`Origem do tráfego: ${top(a.traffic, 6)}`);
  if (a.contentTypes.ok) L.push(`Formato: ${top(a.contentTypes)}`);
  if (a.devices.ok) L.push(`Dispositivos: ${top(a.devices)}`);
  if (a.countries.ok) L.push(`Países: ${top(a.countries)}`);
  if (a.subscribedStatus.ok) L.push(`Público: ${top(a.subscribedStatus)}`);
  if (a.demographics.ok && a.demographics.data.length) {
    const byAge = new Map<string, number>(); for (const d of a.demographics.data) byAge.set(d.ageGroup, (byAge.get(d.ageGroup) || 0) + d.percentage);
    L.push(`Idade: ${[...byAge].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${AGE_LABELS[k] || k} ${pct(v)}`).join(", ")}`);
  }
  if (a.topVideos.ok) L.push(`Top vídeos: ${a.topVideos.data.slice(0, 5).map((v) => `"${v.title.slice(0, 60)}" ${int(v.views)} views, ${pct(v.avgViewPercentage)} assistido`).join(" | ")}`);
  return L.join("\n");
}

/** Texto compacto de um vídeo (retenção resumida em 0/25/50/75/100%). */
export function summarizeVideoAnalytics(a: VideoAnalytics, title = ""): string {
  const L: string[] = [`ANALYTICS DO VÍDEO ${title ? `"${title}" ` : ""}(${a.range.startDate} a ${a.range.endDate})`];
  if (a.core.ok) { const c = a.core.data; L.push(`Views ${int(c.views)} · Horas ${int(c.minutesWatched / 60)} · Duração média ${fmtDuration(c.avgViewDuration)} · % assistida ${pct(c.avgViewPercentage)} · Inscritos +${int(c.subscribersGained)} · Likes ${int(c.likes)} · Comentários ${int(c.comments)}`); }
  if (a.reach.ok) L.push(`Impressões ${int(a.reach.data.impressions)} · CTR ${pct(a.reach.data.ctr)}`);
  if (a.retention.ok && a.retention.data.length) {
    const at = (r: number) => a.retention.ok ? a.retention.data.reduce((b, p) => (Math.abs(p.ratio - r) < Math.abs(b.ratio - r) ? p : b), a.retention.data[0]) : null;
    L.push(`Retenção: ${[0.05, 0.25, 0.5, 0.75, 0.95].map((r) => `${Math.round(r * 100)}% → ${pct((at(r)?.watchRatio || 0) * 100)}`).join(", ")}`);
  }
  if (a.traffic.ok) L.push(`Tráfego: ${a.traffic.data.slice(0, 5).map((x) => `${x.label} ${pct(x.share * 100)}`).join(", ")}`);
  if (a.searchTerms.ok && a.searchTerms.data.length) L.push(`Buscas que trouxeram views: ${a.searchTerms.data.slice(0, 8).map((x) => x.label).join(", ")}`);
  return L.join("\n");
}
