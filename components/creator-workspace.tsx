"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, BookmarkPlus, CalendarDays, Compass, Copy, ExternalLink, Gauge,
  Lightbulb, Loader2, RefreshCw, Search, Sparkles, TrendingUp, Users, Video
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { UpgradeGate } from "./seo-workspace";

type Channel = { id: string; title: string; description: string; thumbnail: string; subscribers: number | null; views: number; videoCount: number; uploads: string };
type VideoItem = { id: string; title: string; views: number; likes: number; comments: number; publishedAt: string; thumbnail: string; channelId: string; channelTitle: string };
type Outlier = VideoItem & { subscribers: number | null; ratio: number; multiple: number; channelAvgViews: number; comparisonBasis: string };
type Idea = { title: string; angle: string; trendEvidence: string };
type Trend = { keyword: string; average: number | null; change: number | null; points: { label: string; value: number }[] };

const getUiLocale = () => {
  if (typeof window === "undefined") return "pt-BR";
  const lang = localStorage.getItem("tubex-language") || "pt-br";
  return lang === "en" ? "en-US" : lang === "es" ? "es-ES" : lang === "pt-pt" ? "pt-PT" : "pt-BR";
};
const YT_API = "https://www.googleapis.com/youtube/v3";
const STOP = new Set("como para voce vocês seu sua seus suas canal canais video videos youtube sobre dicas melhor melhores muito mais menos com sem uma uns umas dos das que por pelo pela de da do no na nos nas em um uma e o a os as ser ter fazer seu meu minha hoje guia tutorial passo erros vale funciona usar usando aumentar crescer ganhar inscritos visualizacoes views shorts oficial parte tudo".split(" "));
const norm = (s: string) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const fmt = (n: number | null | undefined) => new Intl.NumberFormat(getUiLocale(), { notation: Number(n || 0) > 99999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Number(n || 0));
const dateLabel = (date: string) => { const d = new Date(date); return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat(getUiLocale(), { day: "2-digit", month: "short", year: "numeric" }).format(d); };

async function googleGet(path: string, token: string) {
  const response = await fetch(`${YT_API}/${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `YouTube respondeu HTTP ${response.status}`) as Error & { status?: number; code?: string };
    error.status = response.status; error.code = data?.error?.errors?.[0]?.reason || data?.error?.status || "youtube_api_error";
    throw error;
  }
  return data;
}

function inferNiche(channel?: Channel, videos: VideoItem[] = []) {
  const channelTitle = String(channel?.title || "");
  const description = String(channel?.description || "");
  const recent = videos.slice(0, 50);
  const scores = new Map<string, number>();
  const labels = new Map<string, string>();
  const tokens = (value: string) => norm(value).split(" ").filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
  const add = (phrase: string, weight: number) => {
    const key = norm(phrase);
    if (!key || key.split(" ").length < 2 || key.length < 5) return;
    scores.set(key, (scores.get(key) || 0) + weight);
    if (!labels.has(key)) labels.set(key, phrase.trim());
  };

  const titleTokens = tokens(channelTitle);
  titleTokens.forEach(word => { scores.set(word, (scores.get(word) || 0) + 5); labels.set(word, word); });
  const descriptionTokens = tokens(description);
  descriptionTokens.forEach(word => { scores.set(word, (scores.get(word) || 0) + 2.5); if (!labels.has(word)) labels.set(word, word); });
  for (let n = 2; n <= 4; n++) {
    for (let i = 0; i <= descriptionTokens.length - n; i++) add(descriptionTokens.slice(i, i + n).join(" "), 5 / n);
  }

  const wordFrequency = new Map<string, number>();
  const phraseFrequency = new Map<string, number>();
  recent.forEach(video => {
    const words = tokens(String(video.title || ""));
    new Set(words).forEach(word => wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1));
    const phrases = new Set<string>();
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i <= words.length - n; i++) phrases.add(words.slice(i, i + n).join(" "));
    }
    phrases.forEach(phrase => phraseFrequency.set(phrase, (phraseFrequency.get(phrase) || 0) + 1));
  });
  wordFrequency.forEach((frequency, word) => {
    scores.set(word, (scores.get(word) || 0) + Math.min(frequency, 8) * 1.15);
    if (!labels.has(word)) labels.set(word, word);
  });
  phraseFrequency.forEach((frequency, phrase) => {
    const words = phrase.split(" ");
    const corroboration = words.reduce((sum, word) => sum + (wordFrequency.get(word) || 0), 0) / words.length;
    scores.set(phrase, (scores.get(phrase) || 0) + (frequency >= 2 ? frequency * 3.2 + corroboration * 0.45 : 0.35));
    if (!labels.has(phrase)) labels.set(phrase, phrase);
  });

  const ranked = [...scores.entries()]
    .filter(([phrase]) => phrase.split(" ").length >= 2 && phrase.split(" ").length <= 4)
    .sort((a, b) => b[1] - a[1]);
  const best = ranked.find(([phrase]) =>
    phrase.split(" ").some(word => (wordFrequency.get(word) || 0) >= 2) ||
    norm(description).includes(phrase) ||
    norm(channelTitle).includes(phrase)
  );
  if (best) return labels.get(best[0]) || best[0];

  const fallback = [...wordFrequency.entries()]
    .filter(([, frequency]) => frequency >= 2)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  return fallback ? (labels.get(fallback) || fallback) : "";
}

function resolveSavedNiche(saved: string, channel?: Channel, videos: VideoItem[] = []) {
  const value = String(saved || "").trim();
  if (!value) return inferNiche(channel, videos);
  const normalized = norm(value);
  const matchesVideoTitle = videos.some(video => norm(video.title) === normalized);
  const looksLikeHeadline = value.split(/\s+/).length >= 5 &&
    !String(channel?.description || "").toLowerCase().includes(value.toLowerCase());
  return matchesVideoTitle || looksLikeHeadline ? inferNiche(channel, videos) : value;
}

function normaliseTrend(raw: any): { label: string; value: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry: any, index: number) => {
    if (typeof entry === "number" || typeof entry === "string") return { label: String(index + 1), value: Number(entry) };
    if (Array.isArray(entry)) {
      const rawValue = entry[1]?.value ?? entry[1]?.[0] ?? entry[1];
      return { label: String(entry[0] ?? index + 1), value: Number(rawValue) };
    }
    const rawValue = entry?.value ?? entry?.score ?? entry?.interest ?? entry?.y ?? entry?.values?.[0] ?? entry?.data?.value ?? entry?.data?.[0];
    const rawDate = entry?.date ?? entry?.time ?? entry?.timestamp ?? entry?.datetime ?? entry?.formattedTime ?? entry?.x ?? entry?.label;
    let label = String(rawDate ?? index + 1);
    if (/^\d{9,13}$/.test(label)) {
      const timestamp = Number(label);
      const date = new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp);
      if (!Number.isNaN(date.getTime())) label = new Intl.DateTimeFormat(getUiLocale(), { day: "2-digit", month: "short" }).format(date);
    }
    return { label, value: Number(rawValue) };
  }).filter(p => Number.isFinite(p.value)).map(p => ({ ...p, value: Math.max(0, Math.min(100, p.value)) }));
}

function parseIdeas(text: string): Idea[] {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const start = cleaned.indexOf("["); const end = cleaned.lastIndexOf("]");
    const parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
    if (Array.isArray(parsed)) return parsed.map((v: any) => ({ title: String(v.title || v.idea || "").trim(), angle: String(v.angle || v.why || "").trim(), trendEvidence: String(v.trendEvidence || v.evidence || "").trim() })).filter(v => v.title).slice(0, 8);
  } catch {}
  return cleaned.split(/\r?\n/).map(line => line.replace(/^\s*(?:[-*•\d.)]+\s*)?(?:🔥|💡)?\s*/, "").trim()).filter(line => line.length > 8).slice(0, 8).map(title => ({ title, angle: "Sugestão gerada a partir do contexto do canal.", trendEvidence: "A IA não estruturou uma evidência de tendência para esta ideia." }));
}

function MiniTrend({ points }: { points: { label: string; value: number }[] }) {
  if (points.length < 2) return <div className="grid h-28 place-items-center rounded-xl bg-[var(--tx-surface-2)] text-[10px] text-[var(--tx-muted)]">Série Trends não disponível para este termo.</div>;
  const max = 100; const min = 0; const width = 560; const height = 150; const padX = 12; const padY = 12;
  const coords = points.map((p, i) => `${padX + (i / (points.length - 1)) * (width - padX * 2)},${height - padY - ((p.value - min) / (max - min)) * (height - padY * 2)}`).join(" ");
  const last = points[points.length - 1];
  return <div className="rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)]/55 p-3"><div className="mb-2 flex items-center justify-between"><span className="text-[9px] font-bold text-[var(--tx-muted)]">Índice de interesse · Google Trends / YouTube</span><b className="text-xs text-[var(--tx-accent)]">{last.value}/100</b></div><svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full" role="img" aria-label="Gráfico de tendência"><defs><linearGradient id="creator-trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--tx-accent)" stopOpacity=".26"/><stop offset="100%" stopColor="var(--tx-accent)" stopOpacity="0"/></linearGradient></defs>{[25,50,75].map(y => <line key={y} x1="10" x2="550" y1={height - padY - (y / 100) * (height - padY * 2)} y2={height - padY - (y / 100) * (height - padY * 2)} stroke="var(--tx-border)" strokeDasharray="4 5"/>)}<polygon points={`${padX},${height-padY} ${coords} ${width-padX},${height-padY}`} fill="url(#creator-trend-fill)"/><polyline points={coords} fill="none" stroke="var(--tx-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{points.map((p, i) => <circle key={i} cx={padX + (i / (points.length - 1)) * (width - padX * 2)} cy={height - padY - (p.value / 100) * (height - padY * 2)} r="2.8" fill="var(--tx-accent)"/> )}</svg><div className="flex justify-between text-[8px] text-[var(--tx-muted)]"><span>{points[0].label}</span><span>{points[Math.floor(points.length / 2)]?.label}</span><span>{last.label}</span></div></div>;
}

export default function CreatorWorkspace({ user, plan: initialPlan = "free" }: { user: any; plan?: string }) {
  const [, setLocaleTick] = useState(0);
  useEffect(() => {
    const refreshLocale = () => setLocaleTick(value => value + 1);
    window.addEventListener("tubex-language-change", refreshLocale);
    return () => window.removeEventListener("tubex-language-change", refreshLocale);
  }, []);
  const [sessionToken, setSessionToken] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [channelLoading, setChannelLoading] = useState(true);
  const [channelError, setChannelError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [niche, setNiche] = useState("");
  const [tab, setTab] = useState<"outliers" | "ideas" | "calendar">("ideas");
  const [outliers, setOutliers] = useState<Outlier[]>([]);
  const [outlierLoading, setOutlierLoading] = useState(false);
  const [outlierMessage, setOutlierMessage] = useState("");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideaLoading, setIdeaLoading] = useState(false);
  const [ideaError, setIdeaError] = useState("");
  const [trendSignals, setTrendSignals] = useState<Trend[]>([]);
  const [savedIdeas, setSavedIdeas] = useState<(Idea & { savedAt: string; plannedFor: string; channelId: string })[]>([]);
  const [planDate, setPlanDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [copied, setCopied] = useState("");
  const [pulseKeyword, setPulseKeyword] = useState("");
  const [pulseData, setPulseData] = useState<any>(null);
  const [pulseLoading, setPulseLoading] = useState(false);
  const [pulseError, setPulseError] = useState("");
  const [pulseTrend, setPulseTrend] = useState<{label:string;value:number}[]>([]);
  const [pulseRange, setPulseRange] = useState<"7d"|"30d"|"12m">("30d");
  const [pulseTrendLoading, setPulseTrendLoading] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<"quota" | "trends" | "expert" | null>(null);
  const [tagMode, setTagMode] = useState<"niche" | "title">("niche");
  const [tagTitle, setTagTitle] = useState("");
  const [tagResults, setTagResults] = useState<{ keyword: string; score: number }[]>([]);
  const [tagTotalAvailable, setTagTotalAvailable] = useState(0);
  const [tagLoading, setTagLoading] = useState(false);
  const [tagError, setTagError] = useState("");
  const [tagUpgrade, setTagUpgrade] = useState(false);
  const [tagCopied, setTagCopied] = useState("");

  const plan = ["owner", "admin", "administrator", "expert"].includes(String(initialPlan).toLowerCase())
    ? "expert"
    : ["pro", "member"].includes(String(initialPlan).toLowerCase()) ? "pro" : "free";
  const isPro = plan === "pro" || plan === "expert";

  const pulseTrendRequest = useRef(0);

  const selected = useMemo(() => channels.find(c => c.id === selectedId) || channels[0], [channels, selectedId]);
  const storageKey = `tubex-creator-calendar:${user?.id || user?.email || "user"}`;

  const getSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session as any;
    setSessionToken(String(session?.access_token || ""));
    setAccessToken(String(session?.provider_token || ""));
    return { bearer: String(session?.access_token || ""), google: String(session?.provider_token || "") };
  }, []);

  const loadChannels = useCallback(async (token: string) => {
    setChannelLoading(true); setChannelError("");
    try {
      const all: Channel[] = []; let pageToken = ""; let pages = 0;
      do {
        const params = new URLSearchParams({ part: "snippet,statistics,contentDetails", mine: "true", maxResults: "50" });
        if (pageToken) params.set("pageToken", pageToken);
        const data = await googleGet(`channels?${params.toString()}`, token);
        for (const item of data.items || []) all.push({
          id: String(item.id), title: item.snippet?.title || "Canal sem nome", description: item.snippet?.description || "",
          thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "",
          subscribers: item.statistics?.hiddenSubscriberCount ? null : Number(item.statistics?.subscriberCount || 0),
          views: Number(item.statistics?.viewCount || 0), videoCount: Number(item.statistics?.videoCount || 0),
          uploads: String(item.contentDetails?.relatedPlaylists?.uploads || ""),
        });
        pageToken = String(data.nextPageToken || ""); pages += 1;
      } while (pageToken && pages < 100);
      const unique = [...new Map(all.map(c => [c.id, c])).values()];
      setChannels(unique);
      const saved = localStorage.getItem(`tubex-channel:${user?.email || "user"}`) || "";
      const nextId = unique.some(c => c.id === saved) ? saved : unique[0]?.id || "";
      setSelectedId(nextId);
      if (nextId) localStorage.setItem(`tubex-channel:${user?.email || "user"}`, nextId);
      if (!unique.length) setChannelError("O Google não retornou canais para esta conta. Confira se ela administra os canais e autorize youtube.readonly.");
    } catch (error: any) {
      setChannelError(error?.status === 401 ? "Sua conexão com o YouTube expirou. Reconecte sua conta Google para continuar." : "Não foi possível atualizar seus canais agora. Tente novamente em instantes.");
      if (error?.status === 401) setAccessToken("");
    } finally { setChannelLoading(false); }
  }, [user?.email]);

  const loadRecentVideos = useCallback(async (channel: Channel, token: string) => {
    if (!channel.uploads) return;
    setVideosLoading(true);
    try {
      const playlist = await googleGet(`playlistItems?${new URLSearchParams({ part: "snippet,contentDetails", playlistId: channel.uploads, maxResults: "50" }).toString()}`, token);
      const ids = (playlist.items || []).map((item: any) => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId).filter(Boolean);
      if (!ids.length) {
        setVideos([]);
        const savedNiche = localStorage.getItem(`tubex-creator-niche:${channel.id}`) || "";
        setNiche(resolveSavedNiche(savedNiche, channel, []));
        return;
      }
      const details = await googleGet(`videos?${new URLSearchParams({ part: "snippet,statistics,contentDetails", id: ids.join(",") }).toString()}`, token);
      const result: VideoItem[] = (details.items || []).map((item: any) => ({
        id: String(item.id), title: item.snippet?.title || "Sem título", views: Number(item.statistics?.viewCount || 0),
        likes: Number(item.statistics?.likeCount || 0), comments: Number(item.statistics?.commentCount || 0),
        publishedAt: item.snippet?.publishedAt || "", thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "",
        channelId: item.snippet?.channelId || channel.id, channelTitle: item.snippet?.channelTitle || channel.title,
      }));
      setVideos(result);
      setTagTitle(current => current.trim() ? current : String(result[0]?.title || ""));
      const savedNiche = localStorage.getItem(`tubex-creator-niche:${channel.id}`) || "";
      setNiche(resolveSavedNiche(savedNiche, channel, result));
    } catch (error: any) {
      setChannelError("Não foi possível atualizar os vídeos recentes deste canal. Tente novamente em instantes.");
    } finally { setVideosLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (active && Array.isArray(stored)) setSavedIdeas(stored);
    } catch {}
    (async () => {
      const tokens = await getSession();
      if (!active) return;
      if (tokens.google) await loadChannels(tokens.google);
      else { setChannelLoading(false); setChannelError("Autorize o acesso de leitura ao YouTube para carregar seus canais e vídeos automaticamente."); }
    })();
    return () => { active = false; };
  }, [getSession, loadChannels, storageKey]);

  useEffect(() => {
    if (!selected || !accessToken) return;
    localStorage.setItem(`tubex-channel:${user?.email || "user"}`, selected.id);
    setOutliers([]); setIdeas([]); setTrendSignals([]); setIdeaError(""); setPulseData(null); setPulseTrend([]); setPulseError(""); setPulseKeyword(""); setNiche(""); setTagTitle(""); setTagResults([]); setTagTotalAvailable(0); setTagError(""); setTagUpgrade(false);
    void loadRecentVideos(selected, accessToken);
  }, [selected?.id, accessToken, loadRecentVideos, selected, user?.email]);

  async function connectGoogle() {
    setConnecting(true); setChannelError("");
    const options = { redirectTo: `${window.location.origin}/dashboard`, scopes: "openid email profile https://www.googleapis.com/auth/youtube.readonly", queryParams: { access_type: "offline", prompt: "consent" } };
    const { data } = await supabase.auth.getSession();
    const currentUser = data.session?.user;
    const hasGoogleIdentity = (currentUser?.identities || []).some((identity: any) => identity.provider === "google");
    const result = currentUser && !hasGoogleIdentity ? await supabase.auth.linkIdentity({ provider: "google", options }) : await supabase.auth.signInWithOAuth({ provider: "google", options });
    if (result.error) { setConnecting(false); setChannelError("Não foi possível concluir a conexão com o Google. Tente novamente para liberar os dados do seu canal."); }
  }

  async function authFetch(path: string, payload: any) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sua sessão expirou. Entre novamente para continuar usando o TubeX.");
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload), cache: "no-store" });
    const dataJson = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (dataJson?.code === "PLAN_LIMIT_REACHED") {
        const limitError = new Error("Você atingiu o limite de análises do seu plano.") as Error & { code?: string };
        limitError.code = "PLAN_LIMIT_REACHED";
        throw limitError;
      }
      if (response.status === 401) throw new Error("Sua sessão expirou. Entre novamente para continuar usando o TubeX.");
      throw new Error("Não foi possível concluir esta análise agora. Tente novamente em alguns instantes.");
    }
    return dataJson;
  }

  async function generateKeywordTags() {
    const query = (tagMode === "niche" ? niche : tagTitle).trim().replace(/\s+/g, " ");
    if (query.length < 2) {
      setTagError(tagMode === "niche" ? "Informe o nicho do canal para encontrar palavras-chave." : "Digite o título do vídeo para encontrar palavras-chave.");
      return;
    }
    setTagLoading(true); setTagError(""); setTagUpgrade(false); setTagResults([]); setTagTotalAvailable(0);
    try {
      const result = await authFetch("/api/seo/tags", { keyword: query, source: tagMode });
      const tags = Array.isArray(result?.tags) ? result.tags : [];
      const normalized = tags.map((item: any) => ({
        keyword: String(typeof item === "string" ? item : item?.keyword || item?.tag || "").trim(),
        score: Math.max(0, Math.min(100, Number(typeof item === "string" ? 70 : item?.score ?? item?.relevance ?? 70)))
      })).filter((item: any) => item.keyword).slice(0, 120);
      setTagResults(normalized);
      setTagTotalAvailable(Math.max(normalized.length, Number(result?.totalAvailable || 0)));
      if (!normalized.length) setTagError("Não encontramos sugestões suficientes para esse termo. Experimente outra expressão.");
    } catch (error: any) {
      if (error?.code === "PLAN_LIMIT_REACHED") { setUpgradeReason("quota"); setTagError(""); }
      else setTagError(error?.message || "Não foi possível gerar as palavras-chave agora. Tente novamente em instantes.");
    } finally { setTagLoading(false); }
  }

  async function copyTagKeyword(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setTagCopied(value);
      window.setTimeout(() => setTagCopied(""), 1600);
    } catch {
      setTagError("Não foi possível copiar automaticamente. Selecione e copie a palavra-chave.");
    }
  }

  async function findOutliers(force = false) {
    if (!sessionToken) { setOutlierMessage("Sua sessão expirou. Entre novamente para continuar usando o Creator Workspace."); return; }
    if (!niche.trim()) { setOutlierMessage("Informe o nicho do canal para localizar vídeos fora da curva."); return; }
    const cacheKey = `tubex-outliers-v2:${selected?.id || "channel"}:${norm(niche)}`;
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
        if (cached && Date.now() - cached.savedAt < 6 * 3600000) {
          setOutliers(cached.items || []);
          setOutlierMessage("Análise recuperada com sucesso. A comparação considera o desempenho médio de cada canal.");
          return;
        }
      } catch {}
    }
    setOutlierLoading(true); setOutlierMessage("");
    try {
      const response = await authFetch("/api/creator/outliers", {
        niche: niche.trim(),
        channelId: selected?.id || "",
        ownTitles: videos.slice(0, 12).map(video => video.title),
      });
      const ranked = Array.isArray(response.items) ? response.items : [];
      setOutliers(ranked);
      setOutlierMessage(`${ranked.length} vídeos analisados. Veja quais conteúdos se destacam e podem inspirar sua próxima publicação.`);
      localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), items: ranked }));
    } catch (error: any) {
      setOutlierMessage("Não foi possível concluir esta análise agora. Tente novamente em alguns instantes.");
      setOutliers([]);
    } finally { setOutlierLoading(false); }
  }

  async function analyzePulse(keywordInput = pulseKeyword, range = pulseRange) {
    const query = String(keywordInput || "").trim();
    if (query.length < 2) { setPulseError("Digite uma palavra-chave com pelo menos 2 caracteres."); return; }
    setPulseKeyword(query); setPulseLoading(true); setPulseError(""); setUpgradeReason(null);
    pulseTrendRequest.current++;
    setPulseTrend([]);
    try {
      const response = await authFetch("/api/seo/keyword", { keyword: query });
      setPulseData(response.analysis || null);
      setPulseRange(range);
      await loadPulseTrend(query, range);
    } catch (error: any) {
      setPulseData(null);
      if (error?.code === "PLAN_LIMIT_REACHED") {
        setUpgradeReason("quota");
        setPulseError("");
      } else {
        setPulseError(error?.message === "Sua sessão expirou. Entre novamente para continuar usando o TubeX."
          ? error.message
          : "Não foi possível concluir esta análise agora. Tente novamente em alguns instantes.");
      }
    } finally { setPulseLoading(false); }
  }

  async function loadPulseTrend(query = pulseKeyword, range = pulseRange) {
    const term = String(query || "").trim();
    if (!term) return;
    if (!isPro) {
      setPulseTrend([]);
      setPulseTrendLoading(false);
      setUpgradeReason("trends");
      return;
    }
    const requestId = ++pulseTrendRequest.current;
    const cacheKey = `tubex-google-trends-v2:${norm(term)}:${range}`;
    setPulseTrendLoading(true);
    setPulseError("");
    try {
      // Reutiliza somente séries reais já recebidas para a mesma palavra/período.
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
        if (cached?.points?.length >= 2 && Date.now() - Number(cached.savedAt || 0) < 6 * 3600000) {
          if (requestId === pulseTrendRequest.current) setPulseTrend(cached.points);
          return;
        }
      } catch { localStorage.removeItem(cacheKey); }

      const response = await authFetch("/api/seo/trends", { keyword: term, range, geo: "", property: "youtube" });
      const raw = response?.trend ?? response?.data?.trend ?? response?.result?.trend ?? response?.timelineData ?? response?.data?.default?.timelineData;
      const points = normaliseTrend(raw);
      if (requestId !== pulseTrendRequest.current) return;
      if (points.length < 2) throw new Error(response?.message || "O Google Trends não retornou uma série histórica válida para este período.");
      setPulseTrend(points);
      try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), points })); } catch {}
    } catch (error: any) {
      if (requestId !== pulseTrendRequest.current) return;
      setPulseTrend([]);
      setPulseError("Ainda não há dados de tendência suficientes para esse período. Experimente novamente mais tarde.");
    } finally {
      if (requestId === pulseTrendRequest.current) setPulseTrendLoading(false);
    }
  }

  async function generateIdeas() {
    if (!isPro) { setUpgradeReason("trends"); return; }
    if (!sessionToken) { setIdeaError("Sessão expirada. Entre novamente no TubeX."); return; }
    if (!niche.trim()) { setIdeaError("Informe o nicho do canal antes de gerar ideias."); return; }
    setIdeaLoading(true); setIdeaError(""); setIdeas([]); setTrendSignals([]);
    try {
      const lang = "pt"; const geo = "BR";
      const seeds = [niche.trim(), `como ${niche.trim()}`, `${niche.trim()} para iniciantes`, `melhores ${niche.trim()}`];
      const suggestionSets = await Promise.all(seeds.map(query => authFetch("/api/seo/suggestions", { query, geo, language: lang }).catch(() => ({ suggestions: [] }))));
      const suggestions = [...new Set([niche.trim(), ...suggestionSets.flatMap((v: any) => v.suggestions || [])].map((v: string) => String(v).trim()).filter(Boolean))].slice(0, 8);
      const candidates: Trend[] = [];
      for (let i = 0; i < suggestions.length; i += 2) {
        const batch = suggestions.slice(i, i + 2);
        const results = await Promise.all(batch.map(async term => {
          try {
            const response = await authFetch("/api/seo/trends", { keyword: term, range: "30d", geo });
            const points = normaliseTrend(response.trend);
            if (!points.length) return null;
            const half = Math.max(1, Math.floor(points.length / 2));
            const first = points.slice(0, half).reduce((s, p) => s + p.value, 0) / half;
            const latest = points.slice(half).reduce((s, p) => s + p.value, 0) / Math.max(1, points.length - half);
            return { keyword: term, average: Math.round(points.reduce((s, p) => s + p.value, 0) / points.length), change: Math.round(latest - first), points } as Trend;
          } catch { return null; }
        }));
        candidates.push(...results.filter(Boolean) as Trend[]);
      }
      const rankedTrends = candidates.sort((a, b) => ((b.average || 0) + (b.change || 0) * 0.6) - ((a.average || 0) + (a.change || 0) * 0.6)).slice(0, 8);
      setTrendSignals(rankedTrends);
      const payload = await authFetch("/api/seo/ideas", {
        niche: niche.trim(), channelId: selected?.id || "", videos: videos.slice(0, 20).map(v => ({ title: v.title, views: v.views, publishedAt: v.publishedAt })),
        trends: rankedTrends.map(v => ({ keyword: v.keyword, average: v.average, change: v.change })),
      });
      const parsed = Array.isArray(payload.ideas)
        ? payload.ideas.map((v: any) => ({ title: String(v.title || v.idea || "").trim(), angle: String(v.angle || v.why || "").trim(), trendEvidence: String(v.trendEvidence || v.evidence || "").trim() })).filter((v: Idea) => v.title).slice(0, 8)
        : parseIdeas(String(payload.text || ""));
      if (!parsed.length) throw new Error("Não foi possível preparar as sugestões agora. Tente novamente em instantes.");
      setIdeas(parsed);
    } catch (error: any) {
      setIdeaError("Não foi possível preparar suas sugestões agora. Tente novamente em instantes.");
    } finally { setIdeaLoading(false); }
  }

  function saveIdea(idea: Idea) {
    const next = [{ ...idea, savedAt: new Date().toISOString(), plannedFor: planDate, channelId: selected?.id || "" }, ...savedIdeas.filter(v => v.title !== idea.title)].slice(0, 50);
    setSavedIdeas(next); localStorage.setItem(storageKey, JSON.stringify(next));
  }
  async function copyText(value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(value); setTimeout(() => setCopied(""), 1500); } catch { setCopied(""); }
  }

  const channelAverage = videos.length ? Math.round(videos.reduce((s, v) => s + v.views, 0) / videos.length) : 0;
  const detectedNiche = useMemo(() => inferNiche(selected, videos), [selected, videos]);

  useEffect(() => {
    if (niche && !pulseKeyword) setPulseKeyword(niche);
  }, [niche, pulseKeyword]);

  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[24px] border border-[var(--tx-border)] bg-[linear-gradient(120deg,var(--tx-surface),color-mix(in_srgb,var(--tx-accent)_9%,var(--tx-surface)))] p-6 md:p-8">
      <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-[var(--tx-accent)] opacity-[.09] blur-3xl"/>
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><span className="tx-eyebrow"><Sparkles size={12}/> TUBEX · KEYWORD EXPLORER</span><h1 className="mt-4 text-3xl font-black tracking-[-.05em] md:text-4xl">Encontre o próximo vídeo que seu público quer assistir.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--tx-muted)]">Outliers do nicho, sinais reais de busca no YouTube e ideias editoriais alinhadas ao histórico do seu canal.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => void getSession().then(tokens => tokens.google ? loadChannels(tokens.google) : connectGoogle())} className="tx-btn tx-btn-secondary"><RefreshCw size={13}/> Atualizar canais</button><button onClick={() => void connectGoogle()} disabled={connecting} className="tx-btn tx-btn-primary">{connecting ? <Loader2 size={14} className="animate-spin"/> : <Video size={14}/>} {accessToken ? "Reconectar Google" : "Conectar YouTube"}</button></div></div>
    </section>

    <section className="tx-surface rounded-[20px] p-4 md:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)]">{selected?.thumbnail ? <img src={selected.thumbnail} alt="" className="h-full w-full object-cover"/> : <Users size={18} className="text-[var(--tx-accent)]"/>}</div><div className="min-w-0"><div className="flex items-center gap-2"><p className="text-xs font-black">Seus canais</p><span className="rounded-full bg-[var(--tx-accent-soft)] px-2 py-0.5 text-[9px] font-black text-[var(--tx-accent-strong)]">{channelLoading ? "CARREGANDO" : `${channels.length} ${channels.length === 1 ? "CANAL" : "CANAIS"}`}</span></div><p className="mt-1 truncate text-xs font-bold">{selected?.title || "Nenhum canal selecionado"}</p><p className="mt-1 text-[9px] text-[var(--tx-muted)]">{selected ? `${fmt(selected.subscribers)} inscritos · ${fmt(selected.views)} visualizações · ${fmt(selected.videoCount)} vídeos` : "Autorize o YouTube para detectar canais automaticamente."}</p></div></div><div className="flex flex-wrap gap-2"><select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="w-full sm:w-auto sm:min-w-[200px] rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-3 py-2 text-xs font-bold" disabled={!channels.length}><option value="">Selecionar canal</option>{channels.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select><span className="rounded-xl border border-[var(--tx-border)] px-3 py-2 text-[10px] text-[var(--tx-muted)]">{videosLoading ? "Lendo vídeos…" : `${videos.length} vídeos recentes`}</span></div></div>{channelError && <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-[10px] leading-5 text-amber-400">{channelError}</p>}</section>

    <div className="grid gap-3 sm:grid-cols-3"><SmallStat label="Inscritos" value={fmt(selected?.subscribers)} sub="Canal selecionado" icon={<Users size={15}/>}/><SmallStat label="Média dos últimos vídeos" value={fmt(channelAverage)} sub="Visualizações por vídeo" icon={<TrendingUp size={15}/>}/><SmallStat label="Nicho detectado" value={niche || detectedNiche || "—"} sub="Editável para refinar a pesquisa" icon={<Compass size={15}/>}/></div>

    <section className="tx-surface rounded-[20px] p-4 md:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-end"><label className="min-w-0 flex-1"><span className="mb-2 block text-[9px] font-black uppercase tracking-[.13em] text-[var(--tx-muted)]">Nicho / assunto principal do canal</span><input value={niche} onChange={e => { setNiche(e.target.value); if (selected) localStorage.setItem(`tubex-creator-niche:${selected.id}`, e.target.value); }} placeholder={detectedNiche || "Ex.: jardinagem, games, YouTube SEO, culinária…"} className="w-full rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-4 py-3 text-sm outline-none focus:border-[var(--tx-accent)]"/></label><div className="flex flex-wrap gap-2"><button onClick={() => setNiche(detectedNiche)} className="tx-btn tx-btn-secondary"><Sparkles size={13}/> Usar nicho detectado</button><button onClick={() => void loadRecentVideos(selected!, accessToken)} disabled={!selected || !accessToken || videosLoading} className="tx-btn tx-btn-secondary"><RefreshCw size={13}/> Atualizar vídeos</button></div></div></section>

    <section className="tx-surface rounded-[20px] p-5 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="tx-kicker">TUBEX TAG RESEARCH</p><h2 className="mt-1 text-lg font-black">Gerador de palavras-chave</h2><p className="mt-1 max-w-2xl text-[10px] leading-5 text-[var(--tx-muted)]">Encontre termos usados em vídeos relevantes do YouTube e sugestões do autocomplete. Resultados ordenados por relevância, sem geração por IA.</p></div>
        <span className="rounded-full border border-[var(--tx-border)] px-3 py-1.5 text-[9px] font-black text-[var(--tx-muted)]">MOTOR DO TUBEX ANALYZER</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => {setTagMode("niche");setTagResults([]);setTagTotalAvailable(0);setTagError("");setTagUpgrade(false);}} className={`rounded-xl px-4 py-2.5 text-[10px] font-black transition ${tagMode==="niche"?"bg-[var(--tx-accent)] text-[#11151a]":"border border-[var(--tx-border)] bg-[var(--tx-surface-2)]"}`}>Palavras-chave do nicho</button>
        <button onClick={() => {setTagMode("title");setTagResults([]);setTagTotalAvailable(0);setTagError("");setTagUpgrade(false);}} className={`rounded-xl px-4 py-2.5 text-[10px] font-black transition ${tagMode==="title"?"bg-[var(--tx-accent)] text-[#11151a]":"border border-[var(--tx-border)] bg-[var(--tx-surface-2)]"}`}>Palavras-chave do título</button>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input value={tagMode==="niche"?niche:tagTitle} onChange={e=>{if(tagMode==="niche"){setNiche(e.target.value);if(selected)localStorage.setItem(`tubex-creator-niche:${selected.id}`,e.target.value);}else setTagTitle(e.target.value);}} onKeyDown={e=>{if(e.key==="Enter")void generateKeywordTags();}} placeholder={tagMode==="niche"?"Ex.: aquarismo, maquiagem, games, YouTube SEO…":"Digite ou ajuste o título do vídeo…"} className="min-w-0 flex-1 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-4 py-3 text-xs outline-none focus:border-[var(--tx-accent)]"/>
        <button onClick={()=>void generateKeywordTags()} disabled={tagLoading || (tagMode==="niche"?niche.trim().length:tagTitle.trim().length)<2} className="tx-btn tx-btn-primary shrink-0">{tagLoading?<Loader2 size={13} className="animate-spin"/>:<Search size={13}/>} {tagLoading?"Analisando palavras-chave…":"Gerar palavras-chave"}</button>
      </div>
      {tagError && <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-[10px] leading-5 text-amber-300">{tagError}</p>}
      {tagResults.length>0 && <div className="mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-black">{tagTotalAvailable || tagResults.length} sugestões encontradas · {plan==="free"?"3 disponíveis no Free":"lista completa liberada"}</p><button onClick={()=>void copyTagKeyword(tagResults.slice(0,plan==="free"?3:tagResults.length).map(t=>t.keyword).join(", "))} className="tx-btn tx-btn-secondary"><Copy size={12}/>{tagCopied?"Copiado":"Copiar palavras-chave"}</button></div>
        <div className="flex flex-wrap gap-2">
          {tagResults.slice(0,plan==="free"?3:tagResults.length).map((tag,index)=><button key={`${tag.keyword}-${index}`} onClick={()=>void copyTagKeyword(tag.keyword)} title="Copiar palavra-chave" className="inline-flex items-center gap-2 rounded-full border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-3 py-2 text-[10px] font-semibold hover:border-[var(--tx-accent)]"><span>{tag.keyword}</span><span className="rounded-full bg-[var(--tx-accent-soft)] px-1.5 py-0.5 text-[9px] font-black text-[var(--tx-accent-strong)]">{Math.round(tag.score)}</span></button>)}
        </div>
        {plan==="free" && tagResults.length>3 && <div className="relative mt-4 overflow-hidden rounded-2xl border border-[var(--tx-accent)]/30 bg-[var(--tx-surface-2)]/60 p-4">
          <div className="pointer-events-none select-none opacity-60 blur-[2px]"><p className="mb-2 text-[10px] font-black">Mais oportunidades para este {tagMode==="niche"?"nicho":"vídeo"}</p><div className="flex flex-wrap gap-2">{tagResults.slice(3,13).map((tag,index)=><span key={`${tag.keyword}-${index}`} className="rounded-full border border-[var(--tx-border)] px-3 py-2 text-[10px]">{tag.keyword}</span>)}</div></div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--tx-surface)]/70 p-4 text-center backdrop-blur-[1px]"><p className="text-xs font-black">🔒 {Math.max(tagTotalAvailable-3,tagResults.length-3)} palavras-chave encontradas</p><p className="mt-1 max-w-lg text-[10px] leading-5 text-[var(--tx-muted)]">No Pro, veja todas as sugestões e encontre mais termos relevantes para cada novo vídeo.</p><button onClick={()=>setTagUpgrade(true)} className="tx-btn tx-btn-primary mt-2">Desbloquear todas as palavras-chave</button></div>
        </div>}
        {tagUpgrade && <UpgradeGate kind="tags" plan={plan}/>}
      </div>}
    </section>

    <section className="tx-surface relative overflow-hidden rounded-[22px] p-5 md:p-6">
      <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-[var(--tx-accent)] opacity-[.06] blur-3xl"/>
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="tx-kicker"><Activity size={12} className="inline"/> KEYWORD INTELLIGENCE · ANÁLISE TUBEX</p><h2 className="mt-1 text-xl font-black">Analise uma palavra-chave do seu nicho</h2><p className="mt-1 max-w-2xl text-[10px] leading-5 text-[var(--tx-muted)]">Use os indicadores do TubeX para avaliar o potencial da palavra-chave. O volume é um índice estimado, não uma contagem oficial de buscas mensais.</p></div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl"><input value={pulseKeyword} onChange={e=>setPulseKeyword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter") void analyzePulse();}} placeholder={niche || "Digite uma palavra-chave"} className="min-w-0 flex-1 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-4 py-3 text-xs outline-none focus:border-[var(--tx-accent)]"/><button onClick={()=>void analyzePulse()} disabled={pulseLoading || pulseKeyword.trim().length<2} className="tx-btn tx-btn-primary shrink-0">{pulseLoading?<Loader2 size={13} className="animate-spin"/>:<Search size={13}/>} Analisar</button></div>
      </div>
      {pulseError && <p className="relative mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-[10px] leading-5 text-amber-300">{pulseError}</p>}
      {pulseData && <div className="relative mt-5 space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(250px,.8fr)_minmax(0,1.2fr)]">
          <TubeXScoreGauge score={pulseData.tubeXScore} />
          <div className="tx-surface flex flex-col justify-center gap-7 rounded-[19px] border border-[var(--tx-border)] p-5 md:p-6">
            <TubeXMetricBar title="SEARCH VOLUME" score={pulseData.volume} tone="volume" />
            <TubeXMetricBar title="COMPETITION" score={pulseData.competition} tone="competition" />
            <p className="text-[9px] leading-5 text-[var(--tx-muted)]">Volume estimado pelo TubeX. Competition é invertida: quanto maior a pontuação, menor a concorrência.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SmallStat label="Resultados estimados" value={fmt(pulseData.totalResults)} sub="Estimativa de resultados encontrados" icon={<Search size={15}/>}/>
          <SmallStat label="Vídeos analisados" value={fmt(pulseData.analyzed)} sub="Vídeos considerados na análise" icon={<Video size={15}/>}/>
          <SmallStat label="Média de visualizações" value={fmt(pulseData.avgViews)} sub="Por vídeo analisado" icon={<TrendingUp size={15}/>}/>
          <SmallStat label="Engajamento público" value={`${Number(pulseData.engagement||0).toFixed(2)}%`} sub="Curtidas + comentários / views" icon={<Activity size={15}/>}/>
        </div>
        {isPro ? <div className="rounded-2xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)]/50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="tx-kicker">GOOGLE TRENDS · PESQUISA NO YOUTUBE</p><h3 className="mt-1 text-sm font-black">Interesse ao longo do tempo · {pulseKeyword}</h3></div><div className="flex gap-1 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] p-1">{(["7d","30d","12m"] as const).map(range=><button key={range} onClick={()=>{setPulseRange(range);void loadPulseTrend(pulseKeyword,range);}} className={`rounded-lg px-3 py-1.5 text-[9px] font-black ${pulseRange===range?"bg-[var(--tx-accent)] text-[#11151a]":"text-[var(--tx-muted)]"}`}>{range==="12m"?"12 meses":range}</button>)}</div></div>
          {pulseTrendLoading?<div className="grid h-36 place-items-center text-[10px] text-[var(--tx-muted)]"><Loader2 size={16} className="animate-spin"/> Analisando tendência…</div>:pulseTrend.length>=2?<CreatorTrendChart points={pulseTrend}/>:<div className="mt-3 flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--tx-border)] px-4 text-center"><p className="text-[10px] text-[var(--tx-muted)]">Ainda não há dados de tendência suficientes para esse período. Experimente novamente mais tarde.</p><button onClick={()=>void loadPulseTrend(pulseKeyword,pulseRange)} className="rounded-lg border border-[var(--tx-border)] px-3 py-1.5 text-[9px] font-black text-[var(--tx-accent)] hover:bg-[var(--tx-surface-2)]">Atualizar tendências</button></div>}
        </div> : <div className="rounded-2xl border border-[var(--tx-accent)]/30 bg-[var(--tx-surface-2)]/60 p-5">
          <p className="tx-kicker">GOOGLE TRENDS · RECURSO PRO</p>
          <h3 className="mt-1 text-sm font-black">Descubra quando o público está mais interessado</h3>
          <p className="mt-2 text-[10px] leading-5 text-[var(--tx-muted)]">Acompanhe tendências no YouTube em 7 dias, 30 dias e 12 meses. Identifique picos de interesse e escolha o melhor momento para publicar.</p>
          <button onClick={()=>setUpgradeReason("trends")} className="tx-btn tx-btn-primary mt-4">Desbloquear Google Trends</button>
        </div>}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] text-[var(--tx-muted)]"><span>{pulseData.analyzed} vídeos · {fmt(pulseData.totalResults)} resultados · dados públicos do YouTube</span><span>Atualizado {new Date().toLocaleTimeString(getUiLocale())}</span></div>
      </div>}
    </section>

    <nav className="flex flex-wrap gap-2 rounded-2xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)]/65 p-2">
      <ModuleTab active={tab === "ideas"} onClick={() => setTab("ideas")} icon={<Lightbulb size={14}/>} label="Ideias em alta"/>
      <ModuleTab active={tab === "outliers"} onClick={() => setTab("outliers")} icon={<TrendingUp size={14}/>} label="Content Outliers"/>
      <ModuleTab active={tab === "calendar"} onClick={() => setTab("calendar")} icon={<CalendarDays size={14}/>} label="Planejamento" count={savedIdeas.length}/>
    </nav>
    {upgradeReason && plan !== "expert" && <UpgradeGate kind={upgradeReason} plan={plan}/>}

    {tab === "ideas" && <div className="space-y-4">
      <section className="tx-surface rounded-[20px] p-5 md:p-6"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="tx-kicker">TREND RADAR + IA</p><h2 className="mt-1 text-xl font-black">Ideias a partir do que está ganhando interesse no nicho</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--tx-muted)]">O TubeX identifica assuntos em alta, compara o interesse do público com o desempenho recente do seu canal e transforma essas oportunidades em ideias de vídeos.</p></div><button onClick={() => isPro ? void generateIdeas() : setUpgradeReason("trends")} disabled={ideaLoading || (isPro && !niche.trim())} className="tx-btn tx-btn-primary shrink-0">{ideaLoading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>} {ideaLoading ? "Preparando ideias…" : isPro ? "Gerar ideias para meu canal" : "Desbloquear ideias com Pro"}</button></div>{ideaLoading && <div className="mt-4 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-3 text-[10px] text-[var(--tx-muted)]">Identificando assuntos em alta e preparando ideias alinhadas ao seu canal. Isso pode levar alguns instantes.</div>}{ideaError && <p className="mt-4 rounded-xl border border-red-500/25 bg-red-500/5 p-3 text-[10px] leading-5 text-red-400">{ideaError}</p>}</section>
      {trendSignals.length > 0 && <section className="tx-surface rounded-[20px] p-5"><div className="mb-4 flex items-center justify-between"><div><p className="tx-kicker">SINAIS OBSERVADOS</p><h3 className="mt-1 text-base font-black">Termos com maior sinal recente</h3></div><span className="text-[9px] text-[var(--tx-muted)]">Google Trends · 30 dias</span></div><div className="grid gap-3 md:grid-cols-2">{trendSignals.slice(0, 6).map(item => <div key={item.keyword} className="rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)]/55 p-3"><div className="mb-2 flex items-center justify-between gap-2"><b className="truncate text-xs">{item.keyword}</b><span className={`shrink-0 text-[9px] font-black ${Number(item.change) >= 0 ? "text-emerald-400" : "text-amber-400"}`}>{item.change !== null ? `${item.change > 0 ? "+" : ""}${item.change} pts` : "—"}</span></div><MiniTrend points={item.points}/></div>)}</div></section>}
      {ideas.length > 0 && <section className="tx-surface rounded-[20px] p-5"><div className="mb-4 flex items-center justify-between"><div><p className="tx-kicker">PAUTAS PERSONALIZADAS</p><h3 className="mt-1 text-base font-black">Ideias para o canal {selected?.title ? `· ${selected.title}` : ""}</h3></div><span className="rounded-full bg-[var(--tx-accent-soft)] px-3 py-1 text-[9px] font-black text-[var(--tx-accent-strong)]">{ideas.length} ideias</span></div><div className="grid gap-3 lg:grid-cols-2">{ideas.map((idea, index) => <article key={`${idea.title}-${index}`} className="rounded-2xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)]/60 p-4"><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--tx-accent-soft)] text-xs font-black text-[var(--tx-accent-strong)]">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><h4 className="text-sm font-black leading-5">{idea.title}</h4><p className="mt-2 text-[10px] leading-5 text-[var(--tx-muted)]">{idea.angle}</p>{idea.trendEvidence && <p className="mt-2 rounded-lg border border-[var(--tx-border)] bg-[var(--tx-surface)] px-2.5 py-2 text-[9px] leading-4 text-[var(--tx-muted)]"><span className="font-black text-[var(--tx-accent)]">Sinal: </span>{idea.trendEvidence}</p>}</div></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void copyText(idea.title)} className="tx-btn tx-btn-secondary !px-3 !py-2 text-[10px]"><Copy size={12}/>{copied === idea.title ? "Copiado" : "Copiar título"}</button><button onClick={() => saveIdea(idea)} className="tx-btn tx-btn-primary !px-3 !py-2 text-[10px]"><BookmarkPlus size={12}/> Salvar no planejamento</button><a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(idea.title)}`} target="_blank" rel="noreferrer" className="tx-btn tx-btn-secondary !px-3 !py-2 text-[10px]"><Search size={12}/> Ver no YouTube</a></div></article>)}</div></section>}
      {ideas.length === 0 && !ideaLoading && <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]"><div className="tx-surface rounded-[20px] p-6"><div className="flex items-center gap-2"><Lightbulb size={17} className="text-[var(--tx-accent)]"/><h3 className="text-sm font-black">Como as ideias são escolhidas</h3></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><MiniFeature title="Nicho do canal" text="Descrição, títulos recentes e ajuste manual."/><MiniFeature title="Interesse do público" text="Assuntos procurados e tendências recentes."/><MiniFeature title="Histórico editorial" text="Evita repetir os últimos vídeos do canal."/><MiniFeature title="IA contextual" text="Transforma os sinais em pautas e ângulos de conteúdo."/></div></div><div className="tx-surface rounded-[20px] p-6"><p className="tx-kicker">SEU CONTEÚDO RECENTE</p><div className="mt-3 space-y-2">{videos.slice(0, 5).map(v => <div key={v.id} className="flex items-center justify-between gap-3 border-b border-[var(--tx-border)] pb-2"><span className="line-clamp-2 text-[10px] font-semibold">{v.title}</span><span className="shrink-0 text-[9px] text-[var(--tx-muted)]">{fmt(v.views)} views</span></div>)}{!videos.length && <p className="text-xs text-[var(--tx-muted)]">Os vídeos recentes aparecerão assim que o canal for carregado.</p>}</div></div></section>}
    </div>}

    {tab === "outliers" && <section className="tx-surface rounded-[20px] p-5 md:p-6"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="tx-kicker">CONTENT OUTLIERS</p><h2 className="mt-1 text-xl font-black">Encontre vídeos que performam fora do padrão do nicho</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--tx-muted)]">Compara vídeos de outros canais do nicho por visualizações relativas ao tamanho do canal. O multiplicador é uma heurística do TubeX calculada sobre a amostra retornada, não uma métrica oficial do YouTube.</p></div><button onClick={() => void findOutliers(true)} disabled={outlierLoading || !sessionToken} className="tx-btn tx-btn-primary shrink-0">{outlierLoading ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>} {outlierLoading ? "Analisando nicho…" : "Encontrar outliers"}</button></div>{outlierMessage && <p className="mt-4 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-3 text-[10px] leading-5 text-[var(--tx-muted)]">{outlierMessage}</p>}{outlierLoading && <div className="mt-4 flex items-center gap-2 text-xs text-[var(--tx-muted)]"><Loader2 size={15} className="animate-spin"/> Pesquisando vídeos e comparando desempenho relativo…</div>}{outliers.length > 0 && <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--tx-border)]"><div className="grid grid-cols-[1fr_85px_100px] gap-3 bg-[var(--tx-surface-2)] px-4 py-3 text-[9px] font-black uppercase tracking-wide text-[var(--tx-muted)]"><span>Vídeo / canal</span><span>Views</span><span>Índice Outlier</span></div>{outliers.map(v => <article key={v.id} className="grid grid-cols-[1fr_85px_100px] items-center gap-3 border-t border-[var(--tx-border)] px-4 py-3"><div className="flex min-w-0 items-center gap-3">{v.thumbnail && <img src={v.thumbnail} alt="" className="h-12 w-20 shrink-0 rounded-lg object-cover"/>}<div className="min-w-0"><a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer" className="line-clamp-2 text-[10px] font-bold hover:text-[var(--tx-accent)]">{v.title} <ExternalLink size={9} className="inline"/></a><p className="mt-1 truncate text-[9px] text-[var(--tx-muted)]">{v.channelTitle} · {v.subscribers === null ? "inscritos indisponíveis" : `${fmt(v.subscribers)} inscritos`} · média ${fmt(v.channelAvgViews)} views</p></div></div><span className="text-xs font-bold tabular-nums">{fmt(v.views)}</span><span className={`text-xs font-black tabular-nums ${v.multiple >= 2 ? "text-emerald-400" : "text-[var(--tx-muted)]"}`}>{v.multiple.toFixed(1)}× média do canal</span></article>)}</div>}{!outliers.length && !outlierLoading && <div className="mt-5 rounded-xl border border-dashed border-[var(--tx-border)] p-8 text-center"><TrendingUp size={24} className="mx-auto text-[var(--tx-accent)]"/><p className="mt-3 text-sm font-black">Radar de oportunidades do nicho</p><p className="mt-1 text-xs text-[var(--tx-muted)]">Clique em “Encontrar outliers” para comparar vídeos reais do YouTube.</p></div>}<p className="mt-4 text-[9px] leading-5 text-[var(--tx-muted)]">A análise compara o desempenho de cada vídeo com a média do próprio canal. Os resultados ajudam a identificar conteúdos que despertaram interesse acima do padrão observado.</p></section>}

    {tab === "calendar" && <section className="tx-surface rounded-[20px] p-5 md:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="tx-kicker">PLANEJAMENTO EDITORIAL</p><h2 className="mt-1 text-xl font-black">Ideias salvas para produzir</h2><p className="mt-2 text-xs text-[var(--tx-muted)]">Organize pautas geradas pelo Keyword Explorer. O planejamento fica salvo neste navegador.</p></div><span className="rounded-full bg-[var(--tx-accent-soft)] px-3 py-1 text-[9px] font-black text-[var(--tx-accent-strong)]">{savedIdeas.length} pautas salvas</span></div>{savedIdeas.length ? <div className="mt-5 space-y-3">{savedIdeas.map((idea, index) => <article key={`${idea.title}-${index}`} className="flex flex-col gap-3 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)]/60 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xs font-black">{idea.title}</h3><p className="mt-1 text-[9px] text-[var(--tx-muted)]">Data planejada: {dateLabel(idea.plannedFor)} · Salva em {dateLabel(idea.savedAt)}</p></div><button onClick={() => { const next = savedIdeas.filter(v => v.title !== idea.title); setSavedIdeas(next); localStorage.setItem(storageKey, JSON.stringify(next)); }} className="tx-btn tx-btn-secondary !px-3 !py-2 text-[10px]">Remover</button></article>)}</div> : <div className="mt-5 rounded-xl border border-dashed border-[var(--tx-border)] p-10 text-center"><CalendarDays size={24} className="mx-auto text-[var(--tx-accent)]"/><p className="mt-3 text-sm font-black">Seu calendário começa aqui</p><p className="mt-1 text-xs text-[var(--tx-muted)]">Gere ideias e salve as melhores no planejamento.</p></div>}</section>}

    <p className="px-1 text-[9px] leading-5 text-[var(--tx-muted)]">Os canais e vídeos são carregados com sua autorização do Google. As tendências refletem os dados disponíveis no momento da consulta, e as oportunidades são estimativas para apoiar seu planejamento — não uma garantia de visualizações.</p>
  </div>;
}

function TubeXScoreGauge({score}:{score:number}) {
  const [animated,setAnimated]=useState(0);
  const value=Math.max(0,Math.min(100,Number(score)||0));
  useEffect(()=>{const frame=requestAnimationFrame(()=>setAnimated(value));return()=>cancelAnimationFrame(frame);},[value]);
  const start=Math.PI+0.12, end=Math.PI*2-0.12, total=end-start;
  const cx=160, cy=135, radius=65;
  const polar=(angle:number)=>`${cx+radius*Math.cos(angle)},${cy+radius*Math.sin(angle)}`;
  const arc=(from:number,to:number)=>`M ${polar(from)} A ${radius} ${radius} 0 0 1 ${polar(to)}`;
  const redEnd=start+total*.38, yellowEnd=start+total*.63;
  const angle=start+total*(animated/100);
  const tipX=cx+(radius-2)*Math.cos(angle), tipY=cy+(radius-2)*Math.sin(angle);
  const status=value>=75?{label:"Forte",color:"#22C55E"}:value>=50?{label:"Médio",color:"#FACC15"}:{label:"Fraco",color:"#EF4444"};
  return <section className="tx-surface flex min-h-[260px] flex-col items-center rounded-[19px] border border-[var(--tx-border)] p-4">
    <p className="tx-kicker self-start">KEYWORD SCORE</p>
    <svg viewBox="0 0 320 235" className="mt-1 h-[190px] w-full max-w-[310px] overflow-visible" role="img" aria-label={`TubeX Score ${Math.round(animated)} de 100`}>
      <path d={arc(start,redEnd)} fill="none" stroke="#FF4B4B" strokeWidth="13" strokeLinecap="butt" style={{filter:"drop-shadow(0 0 5px #FF4B4B)"}}/>
      <path d={arc(redEnd,yellowEnd)} fill="none" stroke="#FACC15" strokeWidth="13" strokeLinecap="butt" style={{filter:"drop-shadow(0 0 5px #FACC15)"}}/>
      <path d={arc(yellowEnd,end)} fill="none" stroke="#22C55E" strokeWidth="13" strokeLinecap="butt" style={{filter:"drop-shadow(0 0 5px #22C55E)"}}/>
      <line x1={cx} y1={cy} x2={tipX} y2={tipY} stroke="#F8FAFC" strokeWidth="3.2" strokeLinecap="round" style={{filter:"drop-shadow(0 0 4px rgba(255,255,255,.45))"}}/>
      <circle cx={cx} cy={cy} r="5" fill="#F8FAFC"/><circle cx={cx} cy={cy} r="2.2" fill="#64748B"/>
      <text x={cx} y="169" textAnchor="middle" fill="#F8FAFC" fontSize="22" fontWeight="800">{Math.round(animated)}/100</text>
    </svg>
    <p className="-mt-1 text-[10px] font-bold"><span className="text-[var(--tx-text)]">Tube</span><span className="text-[var(--tx-accent)]">X</span><span className="text-[var(--tx-text)]"> Score</span><span className="text-[var(--tx-muted)]"> - </span><span style={{color:status.color}}>{status.label}</span></p>
    <p className="mt-3 text-[8px] text-[var(--tx-muted)]">Métrica proprietária TubeX · análise personalizada</p>
  </section>;
}

function TubeXMetricBar({title,score,tone}:{title:string;score:number;tone:"volume"|"competition"}) {
  const value=Math.max(0,Math.min(100,Math.round(Number(score)||0)));
  const visual=tone==="volume"&&value>=85?100:value;
  const color=visual>=70?"#22C55E":visual>=40?"#FACC15":"#EF4444";
  const label=tone==="volume"?(value>=85?"Muito Alto":value>=70?"Alto":value>=50?"Médio":value>=30?"Baixo":"Muito Baixo"):(value>=85?"Muito Baixa":value>=60?"Low":value>=40?"Média":value>=30?"Alta":"Muito Alta");
  return <div>
    <div className="mb-2 flex items-center justify-between gap-3"><span className="text-[10px] font-black tracking-wide text-[var(--tx-muted)]">{title}</span><span className="text-[10px] font-black" style={{color}}>{label}</span></div>
    <div className="relative h-[14px] overflow-visible rounded-full border border-white/10 bg-[#292D32] shadow-inner"><div className="h-full rounded-full transition-[width] duration-700" style={{width:`${visual}%`,backgroundColor:color}}/><span className="absolute -top-[6px] h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-0 border-b-[9px] border-x-transparent" style={{left:`${visual}%`,borderBottomColor:color}}/></div>
    <div className="mt-1 flex justify-between text-[8px] text-[var(--tx-muted)]"><span>0</span><span>{value}/100</span><span>100</span></div>
  </div>;
}

function CreatorTrendChart({points}:{points:{label:string;value:number}[]}) {
  const width=760,height=190,padX=12,padY=14;
  const coords=points.map((point,index)=>`${padX+(index/Math.max(1,points.length-1))*(width-padX*2)},${height-padY-(Math.max(0,Math.min(100,point.value))/100)*(height-padY*2)}`).join(" ");
  const id="creator-keyword-trend-fill";
  return <div className="mt-3 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)]/65 p-3"><div className="mb-2 flex items-center justify-between text-[9px] text-[var(--tx-muted)]"><span>Interesse relativo observado</span><span>0–100 · série real</span></div><svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full"><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--tx-accent)" stopOpacity=".25"/><stop offset="100%" stopColor="var(--tx-accent)" stopOpacity="0"/></linearGradient></defs>{[0,25,50,75,100].map(value=><g key={value}><line x1={padX} x2={width-padX} y1={height-padY-(value/100)*(height-padY*2)} y2={height-padY-(value/100)*(height-padY*2)} stroke="var(--tx-border)" strokeDasharray="4 5"/><text x="0" y={height-padY-(value/100)*(height-padY*2)+3} fontSize="9" fill="var(--tx-muted)">{value}</text></g>)}<polygon points={`${padX},${height-padY} ${coords} ${width-padX},${height-padY}`} fill={`url(#${id})`}/><polyline points={coords} fill="none" stroke="var(--tx-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{points.map((point,index)=><circle key={`${point.label}-${index}`} cx={padX+(index/Math.max(1,points.length-1))*(width-padX*2)} cy={height-padY-(Math.max(0,Math.min(100,point.value))/100)*(height-padY*2)} r="2.6" fill="var(--tx-accent)"/>)}</svg><div className="flex justify-between text-[8px] text-[var(--tx-muted)]"><span>{points[0]?.label}</span><span>{points[Math.floor(points.length/2)]?.label}</span><span>{points[points.length-1]?.label}</span></div></div>;
}

function SmallStat({ label, value, sub, icon }: any) { return <div className="tx-surface rounded-[17px] p-4"><div className="flex items-center justify-between"><span className="text-[9px] font-black uppercase tracking-wide text-[var(--tx-muted)]">{label}</span><span className="text-[var(--tx-accent)]">{icon}</span></div><p className="mt-3 truncate text-xl font-black">{value}</p><p className="mt-1 text-[9px] text-[var(--tx-muted)]">{sub}</p></div>; }
function ModuleTab({ active, onClick, icon, label, count }: any) { return <button onClick={onClick} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black transition ${active ? "bg-[var(--tx-accent)] text-[#11151a] shadow-[0_5px_16px_rgba(250,204,21,.14)]" : "text-[var(--tx-muted)] hover:bg-[var(--tx-surface)] hover:text-[var(--tx-text)]"}`}>{icon}{label}{count > 0 && <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[8px]">{count}</span>}</button>; }
function MiniFeature({ title, text }: any) { return <div className="rounded-xl border border-[var(--tx-border)] p-3"><p className="text-[10px] font-black">{title}</p><p className="mt-1 text-[9px] leading-4 text-[var(--tx-muted)]">{text}</p></div>; }
