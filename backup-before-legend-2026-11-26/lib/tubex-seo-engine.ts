/**
 * TubeX Keyword Explorer calculation engine.
 * Ported from background.js v4.2.5 to keep the web workspace aligned
 * with the Chrome extension. Do not tune these weights independently.
 */
export type TubeXVideo = {
  id: string;
  snippet: { title: string; publishedAt: string; channelId: string; channelTitle: string; thumbnails?: any };
  statistics: { viewCount: number; likeCount: number; commentCount: number };
  contentDetails?: { duration?: string };
};

const normalize = (value: unknown) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

export function normalizeTubeXItems(data: any): TubeXVideo[] {
  const candidates = [data?.items, data?.data?.items, data?.videos, data?.data?.videos];
  for (const value of candidates) {
    if (!Array.isArray(value)) continue;
    return value.filter((item: any) => item && typeof item === "object").map((item: any) => {
      const snippet = { ...(item.snippet || {}) };
      const statistics = { ...(item.statistics || {}) };
      if (!snippet.publishedAt && item.publishedAt) snippet.publishedAt = item.publishedAt;
      return {
        ...item,
        id: String(item.id?.videoId || item.id || item.videoId || ""),
        snippet: {
          ...snippet,
          title: snippet.title || item.title || "",
          channelId: snippet.channelId || item.channelId || "",
          channelTitle: snippet.channelTitle || item.channelTitle || "",
        },
        statistics: {
          ...statistics,
          viewCount: Number(statistics.viewCount || item.viewCount || 0),
          likeCount: Number(statistics.likeCount || item.likeCount || 0),
          commentCount: Number(statistics.commentCount || item.commentCount || 0),
        },
      } as TubeXVideo;
    });
  }
  return [];
}

export function totalTubeXResults(data: any): number {
  const pageInfo = data?.pageInfo || data?.data?.pageInfo || {};
  for (const candidate of [pageInfo?.totalResults, pageInfo?.total_results, data?.totalResults, data?.total_results, data?.data?.totalResults, data?.data?.total_results]) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return 0;
}

// Exact background.js calcularVolumePesquisaAvancado implementation.
export function calcularVolumePesquisaAvancado(videoStats: TubeXVideo[], totalResults: number, keyword: string): number {
  try {
    if (!Array.isArray(videoStats) || videoStats.length === 0) return 0;
    const safeLog = (x: number) => x > 0 ? Math.log10(x) : 0;
    const saturate = (x: number) => Math.sqrt(Math.max(x, 0));
    // The volume helper in background.js intentionally uses ASCII-only
    // normalization; keep this separate from the Unicode exact-match helper.
    const normalizeVolume = (str: unknown) => String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    const kwNorm = normalizeVolume(keyword);
    const kwTokens = kwNorm.split(" ");
    const views = videoStats.map(v => Number(v.statistics?.viewCount) || 0);
    const titles = videoStats.map(v => normalizeVolume(v.snippet?.title || ""));
    const n = views.length;
    const withKW = titles.filter(t => kwTokens.every(tok => t.includes(tok))).length;
    const adoption = n > 0 ? withKW / n : 0;
    const now = Date.now();
    const recent = videoStats.filter(v => {
      const d = new Date(v.snippet?.publishedAt || 0).getTime();
      return (now - d) <= 30 * 24 * 3600 * 1000;
    }).length;
    const velocity = n > 0 ? recent / n : 0;
    const sorted = [...views].sort((a, b) => b - a);
    const top = sorted.slice(0, Math.max(3, Math.floor(n * 0.1)));
    const topAvg = top.reduce((a, b) => a + b, 0) / top.length;
    const median = sorted[Math.floor(n / 2)] || 1;
    const demandRaw = safeLog(topAvg + 1) / safeLog(median + 10);
    const demand = Math.min(saturate(demandRaw / 3), 1);
    const density = totalResults / Math.max(n, 1);
    const amplitude = Math.min(saturate(safeLog(density + 1) / 3), 1);
    const score01 = 0.45 * demand + 0.30 * amplitude + 0.15 * adoption + 0.10 * velocity;
    return Math.round(Math.max(0, Math.min(1, score01)) * 100);
  } catch {
    return 0;
  }
}

// Exact background.js calcularConcorrencia implementation (inverted score).
export function calcularConcorrencia(videoStats: TubeXVideo[], totalResults: number): number {
  const totalVideos = videoStats.length || 1;
  const totalViews = videoStats.reduce((sum, v) => sum + parseInt(String(v.statistics?.viewCount || 0), 10), 0);
  const totalLikes = videoStats.reduce((sum, v) => sum + parseInt(String(v.statistics?.likeCount || 0), 10), 0);
  const visualizacaoMedia = totalViews / totalVideos;
  const engajamentoMedio = totalLikes / (totalViews + 1);
  const fatorVolume = Math.min(1, totalVideos / 100000);
  const fatorResultados = Math.min(1, totalResults / 1000000);
  const fatorVisualizacao = Math.min(1, visualizacaoMedia / 2000000);
  const fatorEngajamento = Math.min(1, engajamentoMedio * 150);
  const pesos = { volume: 0.35, resultados: 0.25, visualizacao: 0.25, engajamento: 0.15 };
  let scoreLinear = pesos.volume * fatorVolume + pesos.resultados * fatorResultados + pesos.visualizacao * fatorVisualizacao + pesos.engajamento * fatorEngajamento;
  if (totalVideos >= 100 && totalVideos <= 3000) scoreLinear *= 0.7;
  if (totalVideos <= 10) return 100;
  const concorrenciaInvertida = 1 - Math.min(scoreLinear, 1);
  return Math.round(concorrenciaInvertida * 95) + 5;
}

// Exact background.js calcularOportunidade implementation.
export function calcularOportunidade(videoStats: TubeXVideo[], exactTitleMatches: number, competition: number): number {
  const videos = Array.isArray(videoStats) ? videoStats : [];
  const analyzed = Math.max(videos.length, 1);
  const exactRatio = Math.max(0, Math.min(1, Number(exactTitleMatches || 0) / analyzed));
  const titleRoom = 1 - exactRatio;
  const now = Date.now();
  const recentRatio = videos.filter(v => {
    const published = new Date(v?.snippet?.publishedAt || (v as any)?.publishedAt || 0).getTime();
    return Number.isFinite(published) && published > 0 && published <= now && now - published <= 3 * 24 * 60 * 60 * 1000;
  }).length / analyzed;
  const freshnessRoom = 1 - Math.max(0, Math.min(1, recentRatio));
  const competitionRoom = Math.max(0, Math.min(1, Number(competition || 0) / 100));
  const score = Math.round((titleRoom * 0.45 + competitionRoom * 0.35 + freshnessRoom * 0.20) * 100);
  return Math.max(5, Math.min(95, score));
}

// Exact unweighted score() from modules/tubex-keyword-labs.js.
export function calcularTubeXScore(volume: number, competition: number, opportunity: number): number {
  const base = Number(volume || 0) * 0.6 + Number(competition || 0) * 0.4;
  const opp = Number(opportunity || 0);
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return clamp(Math.round(base * 0.6 + opp * 0.4) || Math.round(base) || 0);
}

export function buildTubeXKeywordAnalysis(data: any, keyword: string) {
  const videos = normalizeTubeXItems(data).filter(v => v.snippet && v.statistics);
  const totalResults = totalTubeXResults(data);
  const volume = calcularVolumePesquisaAvancado(videos, totalResults, keyword);
  const competition = calcularConcorrencia(videos, totalResults);
  const exactTitleMatches = videos.filter(v => normalize(v.snippet?.title).includes(normalize(keyword))).length;
  const opportunity = calcularOportunidade(videos, exactTitleMatches, competition);
  const tubeXScore = calcularTubeXScore(volume, competition, opportunity);
  const views = videos.map(v => Number(v.statistics.viewCount || 0)).sort((a, b) => a - b);
  const totalViews = videos.reduce((s, v) => s + Number(v.statistics.viewCount || 0), 0);
  const totalLikes = videos.reduce((s, v) => s + Number(v.statistics.likeCount || 0), 0);
  const totalComments = videos.reduce((s, v) => s + Number(v.statistics.commentCount || 0), 0);
  const now = Date.now();
  const recentCount = videos.filter(v => {
    const d = new Date(v.snippet.publishedAt || 0).getTime();
    return Number.isFinite(d) && now - d <= 30 * 86400000;
  }).length;
  const normalizedVideos = [...videos].map(v => ({
    id: v.id,
    title: v.snippet.title || "Sem título",
    channelId: v.snippet.channelId || "",
    channelTitle: v.snippet.channelTitle || "Canal",
    thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || "",
    publishedAt: v.snippet.publishedAt || "",
    views: Number(v.statistics.viewCount || 0),
    likes: Number(v.statistics.likeCount || 0),
    comments: Number(v.statistics.commentCount || 0),
    duration: (v as any).contentDetails?.duration || "",
  })).sort((a, b) => b.views - a.views);
  const sortedWeekly = Array.from({ length: 8 }, (_, i) => {
    const start = new Date();
    start.setDate(start.getDate() - (7 - i) * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    return { label: `${start.getDate()}/${start.getMonth() + 1}`, count: normalizedVideos.filter(v => {
      const d = new Date(v.publishedAt).getTime(); return d >= start.getTime() && d < end.getTime();
    }).length };
  });
  return {
    totalResults, analyzed: videos.length, volume, competition, opportunity, tubeXScore,
    exactTitleMatches, titleAdoption: (exactTitleMatches / Math.max(videos.length, 1)) * 100,
    avgViews: Math.round(totalViews / Math.max(videos.length, 1)),
    medianViews: views.length ? (views.length % 2 ? views[Math.floor(views.length / 2)] : Math.round((views[views.length / 2 - 1] + views[views.length / 2]) / 2)) : 0,
    totalViews, engagement: totalViews ? ((totalLikes + totalComments) / totalViews) * 100 : 0,
    recentCount, recentShare: (recentCount / Math.max(videos.length, 1)) * 100,
    videos: normalizedVideos.slice(0, 50), weekly: sortedWeekly,
    topics: (data?.topics || data?.data?.topics || []).slice?.(0, 12) || [],
  };
}
