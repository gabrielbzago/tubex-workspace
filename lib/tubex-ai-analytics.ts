import { resolveGoogleToken } from "@/lib/tubex-google-token";
import {
  fetchChannelAnalytics, fetchVideoAnalytics, summarizeChannelAnalytics, summarizeVideoAnalytics,
  type AnalyticsErrorKind,
} from "@/lib/tubex-yt-analytics";

/**
 * Ponte entre o chat da IA e o YouTube Analytics (dados privados do dono do canal).
 * Usa o token renovado (header X-Google-Token do navegador ou refresh token salvo),
 * guarda o resumo em cache por instância e nunca derruba o chat: se algo falhar,
 * devolve uma nota explicando o motivo e a IA cai para a estimativa pública.
 */

const CHANNEL_TTL = 15 * 60 * 1000;
const VIDEO_TTL = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 9000;
const cache = new Map<string, { at: number; text: string }>();

function cached(key: string, ttl: number) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.text;
  if (hit) cache.delete(key);
  return null;
}
function remember(key: string, text: string) {
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), text });
}

function withTimeout<T>(promise: Promise<T>): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), FETCH_TIMEOUT_MS))]);
}

export function analyticsUnavailableNote(kind: AnalyticsErrorKind | "no_token" | "timeout" | "no_data") {
  switch (kind) {
    case "no_token":
    case "expired":
    case "scope":
      return "YouTube Analytics: sem permissão ou login do Google vencido. Diga em uma linha que, para liberar CTR, retenção, público e origem do tráfego, o usuário deve reconectar a conta Google no TubeX (Início > conectar canal) e aceitar a permissão de relatórios do YouTube Analytics. Depois siga com os dados públicos.";
    case "no_data":
      return "YouTube Analytics: ainda sem dados (o Analytics costuma ter 24 a 48 horas de atraso). Diga isso e use o ritmo de views públicas.";
    case "quota":
      return "YouTube Analytics: limite de consultas do Google atingido agora. Use os dados públicos e não invente CTR ou retenção.";
    default:
      return "YouTube Analytics: indisponível agora. Use os dados públicos e não invente CTR, retenção ou dados de público.";
  }
}

/** Perguntas que pedem números do canal inteiro (público, desempenho, crescimento...). */
export function wantsChannelAnalytics(message: string, intent: string) {
  if (intent === "analysis" || intent === "ideas") return true;
  return /\b(canal|p[uú]blico|audi[eê]ncia|inscrit|crescimento|crescer|desempenho|reten[cç][aã]o|ctr|impress[oõ]es|tr[aá]fego|receita|monetiz|pa[ií]s(es)?|idade|g[eê]nero|dispositiv|celular|shorts?\b.*longos?|horas? assistidas|tempo de exibi[cç][aã]o)/i.test(message);
}

export function wantsRevenue(message: string) {
  return /\b(receita|monetiz|cpm|rpm|dinheiro|faturamento|ganho|ganhei|ganhar)\b/i.test(message);
}

type VideoInput = { id: string; title: string; publishedAt: string };

export async function loadChatAnalytics(request: Request, userId: string, opts: {
  videos: VideoInput[]; includeChannel: boolean; includeRevenue: boolean;
}): Promise<{ channel: string; videos: Record<string, string> }> {
  const out = { channel: "", videos: {} as Record<string, string> };
  const videos = opts.videos.slice(0, 3);
  if (!videos.length && !opts.includeChannel) return out;

  const channelKey = `${userId}:channel:${opts.includeRevenue ? "rev" : "norev"}`;
  const pending: VideoInput[] = [];
  for (const v of videos) {
    const hit = cached(`${userId}:video:${v.id}`, VIDEO_TTL);
    if (hit) out.videos[v.id] = hit; else pending.push(v);
  }
  const channelHit = opts.includeChannel ? cached(channelKey, CHANNEL_TTL) : null;
  if (channelHit) out.channel = channelHit;
  const needChannel = opts.includeChannel && !channelHit;
  if (!pending.length && !needChannel) return out;

  let token = "";
  try { token = await resolveGoogleToken(request, userId); } catch { token = ""; }
  if (!token) {
    const note = analyticsUnavailableNote("no_token");
    for (const v of pending) out.videos[v.id] = note;
    if (needChannel) out.channel = note;
    return out;
  }

  await Promise.all([
    ...pending.map(async (v) => {
      const report = await withTimeout(fetchVideoAnalytics(token, v.id, { publishedAt: v.publishedAt, skipRevenue: !opts.includeRevenue }).catch(() => null));
      if (!report) { out.videos[v.id] = analyticsUnavailableNote("timeout"); return; }
      if (!report.core.ok) { out.videos[v.id] = analyticsUnavailableNote(report.core.error); return; }
      if (!report.core.data.views && !report.core.data.minutesWatched) { out.videos[v.id] = analyticsUnavailableNote("no_data"); return; }
      const text = `${summarizeVideoAnalytics(report, v.title)}\n(Dados privados reais do YouTube Analytics; podem ter 24 a 48 horas de atraso em relação às views públicas.)`;
      out.videos[v.id] = text;
      remember(`${userId}:video:${v.id}`, text);
    }),
    needChannel ? (async () => {
      const report = await withTimeout(fetchChannelAnalytics(token, { days: 28, topVideos: 10, skipRevenue: !opts.includeRevenue }).catch(() => null));
      if (!report) { out.channel = analyticsUnavailableNote("timeout"); return; }
      if (!report.core.ok) { out.channel = analyticsUnavailableNote(report.core.error); return; }
      const text = summarizeChannelAnalytics(report);
      out.channel = text;
      remember(channelKey, text);
    })() : Promise.resolve(),
  ]);
  return out;
}
