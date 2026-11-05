"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowUpRight, BarChart3, CalendarDays, ChevronDown, CircleHelp,
  ExternalLink, Eye, Gauge, Layers3, Loader2, Search, ShieldCheck, Sparkles,
  Target, TrendingUp, Users, Video, RefreshCw
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type YTChannel = {
  id: string;
  title: string;
  customUrl?: string;
  description?: string;
  thumbnail?: string;
  subscribers?: number | null;
  views?: number;
  videoCount?: number;
};
type YTVideo = {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnail?: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  duration?: string;
};
type Analysis = {
  keyword: string;
  totalResults: number;
  analyzed: number;
  volume: number;
  competition: number;
  opportunity: number;
  tubeXScore: number;
  avgViews: number;
  medianViews: number;
  totalViews: number;
  engagement: number;
  titleAdoption: number;
  titleMatches: number;
  recentCount: number;
  recentShare: number;
  videos: YTVideo[];
  related: string[];
  weekly: { label: string; count: number }[];
  analyzedAt: string;
};

const YT_API = "https://www.googleapis.com/youtube/v3";
const STOPWORDS = new Set([
  "para", "como", "voce", "voces", "youtube", "canal", "canais", "video", "videos",
  "com", "sem", "uma", "mais", "muito", "sobre", "esse", "essa", "isso", "seu", "sua",
  "dos", "das", "que", "por", "the", "and", "for", "with", "from", "your", "this", "that",
  "how", "what", "why", "are", "was", "you", "can", "all", "new", "best", "howto"
]);

function fmt(value: number | undefined | null) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", { notation: n >= 100000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
}
function pct(value: number) { return `${Math.round(value)}%`; }
function normalize(text: string) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
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
      if (!Number.isNaN(date.getTime())) label = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
    }
    return { label, value: Number(rawValue) };
  }).filter(point => Number.isFinite(point.value)).map(point => ({ ...point, value: Math.max(0, Math.min(100, point.value)) }));
}
function parseDuration(value?: string) {
  if (!value) return "—";
  const m = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "—";
  const h = Number(m[1] || 0), min = Number(m[2] || 0), sec = Number(m[3] || 0);
  return h ? `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${min}:${String(sec).padStart(2, "0")}`;
}
function relativeDate(date: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
  if (!Number.isFinite(days)) return "—";
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 30) return `Há ${days} dias`;
  if (days < 365) return `Há ${Math.floor(days / 30)} meses`;
  return `Há ${Math.floor(days / 365)} anos`;
}
function deriveRelated(titles: string[], keyword: string) {
  const counts = new Map<string, number>();
  const base = normalize(keyword).split(" ").filter(Boolean);
  titles.forEach(title => {
    const words = normalize(title).split(" ").filter(w => w.length >= 3 && !STOPWORDS.has(w));
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      if (base.some(w => phrase.includes(w)) || phrase.length < 7) continue;
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
      if (i < words.length - 2) {
        const phrase3 = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        if (!base.some(w => phrase3.includes(w))) counts.set(phrase3, (counts.get(phrase3) || 0) + 1);
      }
    }
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([phrase]) => phrase);
}
function buildWeekly(videos: YTVideo[]) {
  const now = new Date();
  const groups = Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (7 - i) * 7);
    weekStart.setHours(0, 0, 0, 0);
    const next = new Date(weekStart); next.setDate(weekStart.getDate() + 7);
    const count = videos.filter(v => {
      const d = new Date(v.publishedAt).getTime();
      return d >= weekStart.getTime() && d < next.getTime();
    }).length;
    return { label: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`, count };
  });
  return groups;
}
async function googleGet(path: string, token: string) {
  const response = await fetch(`${YT_API}/${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = data?.error?.errors?.[0]?.reason || data?.error?.status || "youtube_api_error";
    const message = response.status === 401 || response.status === 403
      ? "Reconecte sua conta Google para atualizar os dados do canal."
      : "Não foi possível atualizar os dados do canal neste momento.";
    const error = new Error(message) as Error & { code?: string; status?: number };
    error.code = reason; error.status = response.status; throw error;
  }
  return data;
}

export default function SeoWorkspace({ user, plan: initialPlan = "free" }: { user: any; plan?: string }) {
  const [accessToken, setAccessToken] = useState("");
  const [channels, setChannels] = useState<YTChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [channelLoading, setChannelLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [channelError, setChannelError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [showDefinitions, setShowDefinitions] = useState(false);
  const [trendPoints, setTrendPoints] = useState<{ label: string; value: number }[]>([]);
  const [trendRange, setTrendRange] = useState<"7d" | "30d" | "12m">("30d");
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState("");
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number; plan: string } | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<"quota" | "trends" | "expert" | null>(null);
  const plan = ["owner", "admin", "administrator", "expert"].includes(String(initialPlan).toLowerCase())
    ? "expert"
    : ["pro", "member"].includes(String(initialPlan).toLowerCase()) ? "pro" : "free";
  const isPro = plan === "pro" || plan === "expert";
  const isExpert = plan === "expert";
  const dailyLimit = plan === "free" ? 5 : plan === "pro" ? 50 : 0;
  const visibleVideoLimit = isExpert ? Infinity : isPro ? 20 : 5;

  const trendRequestId = useRef(0);

  const selected = useMemo(() => channels.find(c => c.id === selectedChannel) || channels[0], [channels, selectedChannel]);
  const activeAnalysisCacheKey = `tubex-keyword-active-v1:${user?.id || user?.email || "user"}`;

  const loadChannels = useCallback(async (token: string) => {
    setChannelLoading(true); setChannelError("");
    try {
      let pageToken = "";
      const found: YTChannel[] = [];
      let pages = 0;
      do {
        const query = new URLSearchParams({ part: "snippet,statistics,contentDetails", mine: "true", maxResults: "50" });
        if (pageToken) query.set("pageToken", pageToken);
        const data = await googleGet(`channels?${query.toString()}`, token);
        (data.items || []).forEach((item: any) => found.push({
          id: String(item.id), title: item.snippet?.title || "Canal sem nome",
          customUrl: item.snippet?.customUrl || "", description: item.snippet?.description || "",
          thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "",
          subscribers: item.statistics?.hiddenSubscriberCount ? null : Number(item.statistics?.subscriberCount || 0),
          views: Number(item.statistics?.viewCount || 0), videoCount: Number(item.statistics?.videoCount || 0)
        }));
        pageToken = String(data.nextPageToken || ""); pages += 1;
      } while (pageToken && pages < 100);
      const unique = [...new Map(found.map(c => [c.id, c])).values()];
      setChannels(unique);
      if (pageToken) setChannelError("A conta possui mais de 5.000 canais retornados pela API. Foram carregados os primeiros 5.000.");
      if (!unique.length) setChannelError("O Google autorizou o acesso, mas não retornou canais para esta conta. Confira se ela é proprietária ou gerente dos canais.");
      const saved = typeof window !== "undefined" ? localStorage.getItem(`tubex-channel:${user?.email || "user"}`) : null;
      const nextSelected = unique.some(c => c.id === saved) ? String(saved) : unique[0]?.id || "";
      setSelectedChannel(nextSelected);
      if (nextSelected) localStorage.setItem(`tubex-channel:${user?.email || "user"}`, nextSelected);
    } catch (error: any) {
      const expired = error?.status === 401 || error?.code === "authError";
      setChannelError(expired ? "Sua conexão com o YouTube precisa ser renovada. Reconecte sua conta Google para continuar acompanhando seus canais." : "Não foi possível atualizar seus canais agora. Tente novamente ou reconecte sua conta Google.");
      if (expired) setAccessToken("");
      setChannels([]);
    } finally { setChannelLoading(false); }
  }, [user?.email]);

  const refreshSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = String((data.session as any)?.provider_token || "");
    if (token) { setAccessToken(token); await loadChannels(token); }
    else { setAccessToken(""); setChannelLoading(false); setChannelError("Conecte sua conta Google para visualizar seus canais do YouTube e acompanhar seus resultados em um só lugar."); }
  }, [loadChannels]);

  useEffect(() => {
    let active = true;
    const savedHistory = localStorage.getItem(`tubex-keyword-history:${user?.email || "user"}`);
    if (savedHistory) { try { setHistory(JSON.parse(savedHistory).slice(0, 8)); } catch {} }
    // Restaura a última análise ao voltar para o Workspace SEO após trocar de menu.
    try {
      const activeRaw = localStorage.getItem(activeAnalysisCacheKey);
      if (activeRaw) {
        const active = JSON.parse(activeRaw) as { keyword?: string; result?: Analysis };
        if (active?.result && Array.isArray(active.result.videos) && active.result.keyword) {
          setKeyword(active.result.keyword);
          setAnalysis(active.result);
          if (isPro) void loadKeywordTrends(active.result.keyword, "30d");
        } else localStorage.removeItem(activeAnalysisCacheKey);
      }
    } catch { localStorage.removeItem(activeAnalysisCacheKey); }
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const token = String((data.session as any)?.provider_token || "");
      if (token) { setAccessToken(token); await loadChannels(token); }
      else { setChannelLoading(false); setChannelError("Sua conta está conectada ao TubeX. Autorize o YouTube para carregar automaticamente todos os canais disponíveis."); }
    })();
    return () => { active = false; };
  }, [loadChannels, user?.email]);

  async function connectGoogle() {
    setConnecting(true); setChannelError("");
    const options = {
      redirectTo: `${window.location.origin}/dashboard`,
      scopes: "openid email profile https://www.googleapis.com/auth/youtube.readonly",
      queryParams: { access_type: "offline", prompt: "consent" }
    };
    const { data: authData } = await supabase.auth.getSession();
    const currentUser = authData.session?.user;
    const hasGoogleIdentity = (currentUser?.identities || []).some((identity: any) => identity.provider === "google");

    // Link Google to the existing TubeX account when the person originally
    // registered with e-mail/password. This avoids creating a second account.
    const result = currentUser && !hasGoogleIdentity
      ? await supabase.auth.linkIdentity({ provider: "google", options })
      : await supabase.auth.signInWithOAuth({ provider: "google", options });

    if (result.error) {
      setConnecting(false);
      setChannelError("Não foi possível concluir a conexão com o Google. Tente novamente para liberar os dados dos seus canais.");
    }
  }

  async function loadKeywordTrends(value: string, range: "7d" | "30d" | "12m" = trendRange) {
    const term = String(value || "").trim();
    if (!term) return;
    if (!isPro) {
      setTrendPoints([]);
      setTrendLoading(false);
      setTrendError("");
      setUpgradeReason("trends");
      return;
    }
    const requestId = ++trendRequestId.current;
    const cacheKey = `tubex-google-trends-v2:${normalize(term)}:${range}`;
    setTrendRange(range);
    setTrendLoading(true);
    setTrendError("");
    try {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
        if (cached?.points?.length >= 2 && Date.now() - Number(cached.savedAt || 0) < 6 * 3600000) {
          if (requestId === trendRequestId.current) setTrendPoints(cached.points);
          return;
        }
      } catch { localStorage.removeItem(cacheKey); }

      const { data: sessionData } = await supabase.auth.getSession();
      const bearer = sessionData.session?.access_token;
      if (!bearer) throw new Error("Sua sessão expirou. Entre novamente para continuar usando o TubeX.");
      const response = await fetch("/api/seo/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ keyword: term, range, geo: "", property: "youtube" }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 429) throw new Error("O Google Trends está recebendo muitas consultas neste momento. Sua análise de palavras-chave continua disponível. Aguarde alguns minutos e tente novamente.");
        throw new Error("Não foi possível atualizar as tendências neste momento. Sua análise de palavras-chave continua disponível.");
      }
      const raw = payload?.trend ?? payload?.data?.trend ?? payload?.result?.trend ?? payload?.timelineData ?? payload?.data?.default?.timelineData ?? payload?.history ?? payload?.data?.history;
      const points = normaliseTrend(raw);
      if (requestId !== trendRequestId.current) return;
      if (points.length < 2) throw new Error("Ainda não há dados de tendência suficientes para este termo. Experimente novamente mais tarde.");
      setTrendPoints(points);
      try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), points })); } catch { /* cache opcional */ }
    } catch (error: any) {
      if (requestId !== trendRequestId.current) return;
      setTrendPoints([]);
      setTrendError(["Sua sessão expirou. Entre novamente para continuar usando o TubeX.", "O Google Trends está recebendo muitas consultas neste momento. Sua análise de palavras-chave continua disponível. Aguarde alguns minutos e tente novamente.", "Não foi possível atualizar as tendências neste momento. Sua análise de palavras-chave continua disponível.", "Ainda não há dados de tendência suficientes para este termo. Experimente novamente mais tarde."].includes(error?.message) ? error.message : "As tendências estão temporariamente indisponíveis. Sua análise de palavras-chave continua disponível.");
    } finally {
      if (requestId === trendRequestId.current) setTrendLoading(false);
    }
  }

  async function analyzeKeyword(value?: string, force = false) {
    const q = String(value ?? keyword).trim();
    if (!q) { setSearchError("Digite uma palavra-chave para começar a pesquisa."); return; }
    setKeyword(q); setSearching(true); setSearchError(""); setUpgradeReason(null); setAnalysis(null); setTrendPoints([]); setTrendError("");
    const cacheKey = activeAnalysisCacheKey;
    try {
      // Reutiliza a análise atual para a mesma palavra, exceto quando solicitar atualização.
      if (!force) {
        try {
          const cachedRaw = localStorage.getItem(cacheKey);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw) as { keyword?: string; result?: Analysis };
            if (normalize(cached.keyword || "") === normalize(q) && cached.result && Array.isArray(cached.result.videos)) {
              setAnalysis(cached.result);
              setSearching(false);
              if (isPro) void loadKeywordTrends(q, trendRange);
              return;
            }
            // A pesquisa de outra palavra descarta imediatamente o resultado anterior.
            localStorage.removeItem(cacheKey);
          }
        } catch { localStorage.removeItem(cacheKey); }
      }
      // Uma nova palavra-chave substitui a análise ativa anterior.
      const { data: sessionData } = await supabase.auth.getSession();
      const bearer = sessionData.session?.access_token;
      if (!bearer) throw new Error("Sua sessão expirou. Entre novamente para continuar usando o TubeX.");
      const response = await fetch("/api/seo/keyword", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ keyword: q }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (payload?.usage) setUsage(payload.usage);
      if (!response.ok) {

        if (response.status === 429 && payload?.code === "PLAN_LIMIT_REACHED") {

          setUpgradeReason("quota");

          setSearchError("");

          return;

        }

        if (response.status === 401) throw new Error("Sua sessão expirou. Entre novamente para continuar pesquisando.");

        if (response.status === 429) throw new Error("Estamos recebendo muitas pesquisas neste momento. Aguarde um instante e tente novamente.");

        throw new Error("Não foi possível concluir esta análise agora. Tente novamente em alguns instantes.");

      }
      const server = payload?.analysis;
      if (!server || !Array.isArray(server.videos)) throw new Error("Não foi possível concluir esta análise agora. Tente novamente em alguns instantes.");
      const videos: YTVideo[] = server.videos.map((v: any) => ({
        id: String(v.id || ""), title: String(v.title || "Sem título"), channelId: String(v.channelId || ""),
        channelTitle: String(v.channelTitle || "Canal"), thumbnail: String(v.thumbnail || ""),
        publishedAt: String(v.publishedAt || ""), views: Number(v.views || 0), likes: Number(v.likes || 0),
        comments: Number(v.comments || 0), duration: String(v.duration || ""),
      }));
      const result: Analysis = {
        keyword: q,
        totalResults: Number(server.totalResults || 0),
        analyzed: Number(server.analyzed || videos.length),
        volume: Number(server.volume || 0),
        competition: Number(server.competition || 0),
        opportunity: Number(server.opportunity || 0),
        tubeXScore: Number(server.tubeXScore || 0),
        avgViews: Number(server.avgViews || 0),
        medianViews: Number(server.medianViews || 0),
        totalViews: Number(server.totalViews || 0),
        engagement: Number(server.engagement || 0),
        titleAdoption: Number(server.titleAdoption || 0),
        titleMatches: Number(server.exactTitleMatches || 0),
        recentCount: Number(server.recentCount || 0),
        recentShare: Number(server.recentShare || 0),
        videos,
        related: deriveRelated(videos.map(v => v.title), q),
        weekly: Array.isArray(server.weekly) ? server.weekly : buildWeekly(videos),
        analyzedAt: new Date().toISOString(),
      };
      setAnalysis(result);
      try { localStorage.setItem(cacheKey, JSON.stringify({ keyword: q, result })); } catch { /* cache is optional */ }
      const nextHistory = [q, ...history.filter(x => normalize(x) !== normalize(q))].slice(0, 8);
      setHistory(nextHistory);
      localStorage.setItem(`tubex-keyword-history:${user?.email || "user"}`, JSON.stringify(nextHistory));
      if (isPro) void loadKeywordTrends(q, trendRange);
    } catch (error: any) {
      setSearchError(error?.message === "Sua sessão expirou. Entre novamente para continuar usando o TubeX." ? error.message : "Não foi possível concluir esta análise agora. Tente novamente em alguns instantes.");
    } finally { setSearching(false); }
  }

  const maxWeekly = Math.max(1, ...(analysis?.weekly.map(x => x.count) || [1]));

  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[24px] border border-[var(--tx-border)] bg-[linear-gradient(120deg,var(--tx-surface),color-mix(in_srgb,var(--tx-accent)_8%,var(--tx-surface)))] p-6 md:p-8">
      <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-[var(--tx-accent)] opacity-[.09] blur-3xl" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <span className="tx-eyebrow"><Sparkles size={12}/> TUBEX · SEO WORKSPACE</span>
          <h1 className="mt-4 text-3xl font-black tracking-[-.05em] md:text-4xl">Encontre oportunidades antes de publicar.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--tx-muted)]">Pesquise palavras-chave, compare a força dos vídeos posicionados e descubra onde seu próximo conteúdo pode competir.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void refreshSession()} className="tx-btn tx-btn-secondary"><RefreshCw size={14}/> Atualizar canais</button>
          <button onClick={() => void connectGoogle()} disabled={connecting} className="tx-btn tx-btn-primary">{connecting ? <Loader2 size={14} className="animate-spin"/> : <Video size={15}/>} {accessToken ? "Reconectar Google" : "Conectar YouTube"}</button>
        </div>
      </div>
    </section>

    <section className="tx-surface rounded-[20px] p-4 md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <ChannelAvatar src={selected?.thumbnail} title={selected?.title} />
          <div className="min-w-0"><div className="flex items-center gap-2"><p className="text-xs font-black">Seus canais do YouTube</p><span className="rounded-full bg-[var(--tx-accent-soft)] px-2 py-0.5 text-[9px] font-black text-[var(--tx-accent-strong)]">{channelLoading ? "CARREGANDO" : `${channels.length} ${channels.length === 1 ? "CANAL" : "CANAIS"}`}</span></div><p className="mt-1 truncate text-[11px] text-[var(--tx-muted)]">{selected?.title || (channelLoading ? "Buscando canais vinculados à sua conta Google..." : "Nenhum canal selecionado")}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {channels.length > 0 && <div className="relative min-w-[230px]"><select value={selectedChannel} onChange={(e: { target: { value: string } }) => { setSelectedChannel(e.target.value); localStorage.setItem(`tubex-channel:${user?.email || "user"}`, e.target.value); }} className="h-10 w-full appearance-none rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-3 pr-9 text-xs font-bold text-[var(--tx-text)] outline-none focus:border-[var(--tx-accent)]">{channels.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-[var(--tx-muted)]"/></div>}
          <span className="flex items-center gap-1.5 rounded-lg border border-[var(--tx-border)] px-3 py-2 text-[10px] font-bold text-[var(--tx-muted)]"><ShieldCheck size={13} className="text-emerald-500"/> Acesso somente leitura</span>
        </div>
      </div>
      {channelError && <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-5 text-[var(--tx-muted)]">{channelError}</p><button onClick={() => void connectGoogle()} className="tx-btn tx-btn-secondary shrink-0">Autorizar Google</button></div>}
      {selected && <>
        <div className="mt-4 grid gap-2 sm:grid-cols-3"><ChannelStat icon={<Users size={14}/>} label="Inscritos" value={selected.subscribers === null ? "Ocultos" : fmt(selected.subscribers)}/><ChannelStat icon={<Eye size={14}/>} label="Visualizações" value={fmt(selected.views)}/><ChannelStat icon={<Video size={14}/>} label="Vídeos publicados" value={fmt(selected.videoCount)}/></div>
        <p className="mt-3 text-[9px] leading-4 text-[var(--tx-muted)]">O TubeX mostra os canais que sua conta Google tem permissão para acessar. Se algum canal não aparecer, confirme se você está conectado à conta proprietária ou administradora.</p>
      </>}
    </section>

    <section className="tx-surface rounded-[20px] p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><p className="tx-kicker">KEYWORD EXPLORER</p><h2 className="mt-1 text-xl font-black">Pesquisa de palavras-chave</h2><p className="mt-1 text-xs text-[var(--tx-muted)]">Descubra a força da concorrência, encontre oportunidades e escolha temas com mais potencial para seus próximos vídeos.</p></div><span className="text-[10px] text-[var(--tx-muted)]">
        {plan === "expert" ? "EXPERT · Pesquisas ilimitadas" : `${plan.toUpperCase()} · ${usage ? `${usage.remaining} de ${usage.limit} pesquisas restantes hoje` : `${dailyLimit} pesquisas por dia`}`}
      </span></div>
      <form onSubmit={(e: { preventDefault: () => void }) => { e.preventDefault(); void analyzeKeyword(); }} className="grid gap-2 lg:grid-cols-[1fr_auto]">
        <div className="tx-input-wrap tx-focus"><Search size={16}/><input value={keyword} onChange={(e: { target: { value: string } }) => setKeyword(e.target.value)} placeholder="Digite uma palavra-chave (ex.: como crescer no YouTube)" className="tx-input"/></div>
        <div className="hidden items-center rounded-xl border border-[var(--tx-border)] px-3 text-[9px] font-bold text-[var(--tx-muted)] sm:flex"><ShieldCheck size={12} className="mr-2 text-emerald-500"/>Análise com tecnologia TubeX</div>
        <button disabled={searching} className="tx-btn tx-btn-primary min-w-[132px]">{searching ? <Loader2 size={15} className="animate-spin"/> : <Search size={15}/>} Pesquisar</button>
      </form>
      {!accessToken && !channelLoading && <p className="mt-3 text-[11px] text-[var(--tx-muted)]">Conecte seu YouTube para visualizar seus canais e acompanhar os resultados do seu conteúdo em um só lugar.</p>}
      {history.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold text-[var(--tx-muted)]">Recentes:</span>{history.map(item => <button key={item} onClick={() => void analyzeKeyword(item)} className="rounded-full border border-[var(--tx-border)] px-3 py-1.5 text-[10px] font-semibold text-[var(--tx-muted)] hover:border-[var(--tx-accent)] hover:text-[var(--tx-text)]">{item}</button>)}</div>}
      {searchError && <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/5 p-3 text-[11px] leading-5 text-red-400">{searchError}</div>}
      {upgradeReason && <UpgradeGate kind={upgradeReason} plan={plan}/>}
    </section>

    {searching && <div className="tx-surface flex items-center gap-3 rounded-[18px] p-5 text-xs text-[var(--tx-muted)]"><Loader2 size={17} className="animate-spin text-[var(--tx-accent)]"/> Analisando palavra-chave...</div>}

    {analysis && !searching && <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="tx-kicker">ANÁLISE CONCLUÍDA</p><h2 className="mt-1 text-2xl font-black">{analysis.keyword}</h2><p className="mt-1 text-[10px] text-[var(--tx-muted)]">{fmt(analysis.totalResults)} resultados estimados · {analysis.analyzed} vídeos analisados · {new Date(analysis.analyzedAt).toLocaleString("pt-BR")}</p></div><button onClick={() => void analyzeKeyword(undefined, true)} className="tx-btn tx-btn-secondary"><RefreshCw size={13}/> Atualizar análise</button></div>

      <TubeXScoreGauge
        score={analysis.tubeXScore}
        volume={analysis.volume}
        competition={analysis.competition}
        opportunity={analysis.opportunity}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard icon={<Eye size={15}/>} label="Média de visualizações" value={fmt(analysis.avgViews)} sub="Por vídeo analisado"/>
        <MetricCard icon={<BarChart3 size={15}/>} label="Mediana de visualizações" value={fmt(analysis.medianViews)} sub="Reduz o peso de vídeos fora da curva"/>
        <MetricCard icon={<Activity size={15}/>} label="Engajamento público" value={pct(analysis.engagement)} sub="Curtidas + comentários / views"/>
        <MetricCard icon={<CalendarDays size={15}/>} label="Vídeos recentes" value={`${analysis.recentCount}/${analysis.analyzed}`} sub={`${pct(analysis.recentShare)} publicados nos últimos 30 dias`}/>
        <MetricCard icon={<BarChart3 size={15}/>} label="Visualizações somadas" value={fmt(analysis.totalViews)} sub="Total dos vídeos analisados"/>
        <MetricCard icon={<Target size={15}/>} label="Presença no título" value={pct(analysis.titleAdoption)} sub={`${analysis.titleMatches} vídeos contêm os termos pesquisados`}/>
      </div>

      {isPro ? (
      <section className="tx-surface rounded-[20px] p-5 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="tx-kicker">GOOGLE TRENDS · YOUTUBE SEARCH</p><h3 className="mt-1 text-base font-black">Interesse da palavra-chave ao longo do tempo</h3><p className="mt-1 text-[10px] text-[var(--tx-muted)]">Acompanhe a evolução do interesse e identifique os melhores momentos para publicar. Escala relativa de 0 a 100.</p></div>
          <div className="flex gap-1 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-1">{(["7d", "30d", "12m"] as const).map(range => <button key={range} onClick={() => void loadKeywordTrends(analysis.keyword, range)} className={`rounded-lg px-3 py-2 text-[9px] font-black ${trendRange === range ? "bg-[var(--tx-accent)] text-[#11151a]" : "text-[var(--tx-muted)] hover:text-[var(--tx-text)]"}`}>{range === "12m" ? "12 meses" : range}</button>)}</div>
        </div>
        {trendLoading ? <div className="mt-4 flex h-36 items-center justify-center gap-2 text-xs text-[var(--tx-muted)]"><Loader2 size={15} className="animate-spin text-[var(--tx-accent)]"/> Analisando tendências…</div> : trendPoints.length >= 2 ? <TrendChart points={trendPoints}/> : <div className="mt-4 grid h-36 place-items-center rounded-xl border border-dashed border-[var(--tx-border)] px-4 text-center"><div><p className="text-xs font-bold">{trendError || "Ainda não há uma série disponível para esta palavra-chave."}</p><button onClick={() => void loadKeywordTrends(analysis.keyword, trendRange)} className="mt-3 text-[10px] font-black text-[var(--tx-accent)]">Tentar novamente</button></div></div>}
      </section>
      ) : (
        <section className="tx-surface relative overflow-hidden rounded-[20px] border border-[var(--tx-border)] p-5 md:p-6">
          <div className="pointer-events-none absolute inset-0 opacity-20 blur-sm" aria-hidden="true">
            <div className="mt-16 flex h-28 items-end gap-2 px-8">{[35,62,48,82,55,94,70,45,76,60,88,52].map((h,i)=><span key={i} className="flex-1 rounded-t-md bg-[var(--tx-accent)]" style={{height:`${h}%`}}/>)}</div>
          </div>
          <div className="relative flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="tx-kicker">GOOGLE TRENDS · RECURSO PRO</p>
              <h3 className="mt-1 text-lg font-black">Descubra se o interesse está crescendo</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--tx-muted)]">Compare a evolução da procura no YouTube, identifique sazonalidade e escolha o melhor momento para publicar.</p>
              <ul className="mt-3 grid gap-1 text-[11px] text-[var(--tx-muted)]">
                <li>✓ Histórico de interesse em 7 dias, 30 dias e 12 meses</li>
                <li>✓ Identificação de picos e oportunidades de conteúdo</li>
                <li>✓ Dados de tendência para apoiar seu calendário editorial</li>
              </ul>
            </div>
            <button onClick={() => setUpgradeReason("trends")} className="tx-btn tx-btn-primary shrink-0">Desbloquear Trends <ArrowUpRight size={14}/></button>
          </div>
        </section>
      )}


      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="tx-surface rounded-[20px] p-5"><div className="flex items-center justify-between"><div><p className="tx-kicker">COMPETIÇÃO NA SERP</p><h3 className="mt-1 text-base font-black">Distribuição de publicações recentes</h3></div><span className="text-[10px] text-[var(--tx-muted)]">Top {analysis.analyzed}</span></div><div className="mt-6 grid h-36 grid-cols-8 items-end gap-2">{analysis.weekly.map((w, i) => <div key={w.label} className="flex h-full flex-col items-center justify-end gap-2"><div className="flex w-full flex-1 items-end"><div className="w-full rounded-t-md bg-[linear-gradient(180deg,var(--tx-accent),color-mix(in_srgb,var(--tx-accent)_36%,transparent))] transition-all" style={{ height: `${Math.max(w.count ? 8 : 2, (w.count / maxWeekly) * 100)}%`, opacity: w.count ? 0.65 + (i / 7) * 0.35 : 0.2 }} title={`${w.count} vídeos`}/></div><span className="text-[9px] text-[var(--tx-muted)]">{w.label}</span></div>)}</div><p className="mt-3 text-[10px] leading-5 text-[var(--tx-muted)]">Quantidade de vídeos do conjunto analisado publicados em cada semana recente. Não representa histórico de volume de buscas.</p></section>
        <section className="tx-surface rounded-[20px] p-5"><div className="flex items-center gap-2"><Layers3 size={16} className="text-[var(--tx-accent)]"/><h3 className="text-base font-black">Termos relacionados</h3></div><p className="mt-1 text-[10px] text-[var(--tx-muted)]">Extraídos dos títulos dos vídeos posicionados.</p><div className="mt-4 flex flex-wrap gap-2">{analysis.related.length ? analysis.related.slice(0, isExpert ? analysis.related.length : isPro ? 8 : 4).map(term => <button key={term} onClick={() => { setKeyword(term); void analyzeKeyword(term); }} className="rounded-full border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-3 py-2 text-[10px] font-bold hover:border-[var(--tx-accent)]">{term} <ArrowUpRight size={10} className="ml-1 inline"/></button>) : <p className="text-xs text-[var(--tx-muted)]">Não há termos relacionados suficientes nos títulos retornados.</p>}</div></section>
      </div>

      <section className="tx-surface overflow-hidden rounded-[20px]">
        <div className="flex flex-col gap-2 border-b border-[var(--tx-border)] p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="tx-kicker">ANÁLISE DE RESULTADOS</p><h3 className="mt-1 text-base font-black">Vídeos que disputam essa palavra-chave</h3></div><span className="text-[10px] text-[var(--tx-muted)]">Ordenados por visualizações públicas</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-[var(--tx-surface-2)] text-[9px] font-black uppercase tracking-wider text-[var(--tx-muted)]"><tr><th className="px-5 py-3">Vídeo</th><th className="px-4 py-3">Visualizações</th><th className="px-4 py-3">Curtidas</th><th className="px-4 py-3">Comentários</th><th className="px-4 py-3">Publicado</th><th className="px-4 py-3">Duração</th></tr></thead><tbody>{analysis.videos.slice(0, visibleVideoLimit).map((video, index) => <tr key={video.id} className="border-t border-[var(--tx-border)] hover:bg-[var(--tx-surface-2)]/60"><td className="px-5 py-3"><div className="flex max-w-[390px] items-center gap-3"><span className="w-5 shrink-0 text-[10px] font-black text-[var(--tx-muted)]">{index + 1}</span>{video.thumbnail && <img src={video.thumbnail} alt="" className="h-12 w-[76px] shrink-0 rounded-lg object-cover"/>}<div className="min-w-0"><a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="line-clamp-2 text-[11px] font-bold hover:text-[var(--tx-accent-strong)]">{video.title}<ExternalLink size={10} className="ml-1 inline"/></a><p className="mt-1 truncate text-[9px] text-[var(--tx-muted)]">{video.channelTitle}</p></div></div></td><td className="px-4 py-3 text-xs font-bold tabular-nums">{fmt(video.views)}</td><td className="px-4 py-3 text-xs tabular-nums">{fmt(video.likes)}</td><td className="px-4 py-3 text-xs tabular-nums">{fmt(video.comments)}</td><td className="px-4 py-3 text-[10px] text-[var(--tx-muted)]">{relativeDate(video.publishedAt)}</td><td className="px-4 py-3 text-[10px] text-[var(--tx-muted)]">{parseDuration(video.duration)}</td></tr>)}</tbody></table></div>
      </section>
      {!isExpert && analysis.videos.length > visibleVideoLimit && <section className="tx-surface relative overflow-hidden rounded-[20px] border border-[var(--tx-border)] p-5">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--tx-accent)]/[0.04] to-transparent"/>
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="tx-kicker">{isPro ? "RECURSOS EXPERT" : "PRÉVIA FREE"}</p>
            <h3 className="mt-1 text-base font-black">{isPro ? "Veja todos os concorrentes, sem cortes" : "Você viu uma amostra. Há mais concorrentes para analisar."}</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--tx-muted)]">{isPro ? "O Expert libera a lista completa de vídeos, análise aprofundada e pesquisas ilimitadas." : "No Pro, você amplia a análise para até 20 vídeos por pesquisa e desbloqueia Google Trends e mais pesquisas diárias."}</p>
          </div>
          <button onClick={() => setUpgradeReason(isPro ? "expert" : "quota")} className="tx-btn tx-btn-primary shrink-0">{isPro ? "Conhecer Expert" : "Desbloquear Pro"} <ArrowUpRight size={14}/></button>
        </div>
      </section>}


      <section className="rounded-[16px] border border-[var(--tx-border)] bg-[var(--tx-surface-2)]/70 p-4"><button onClick={() => setShowDefinitions(v => !v)} className="flex w-full items-center justify-between text-left"><span className="flex items-center gap-2 text-xs font-black"><CircleHelp size={15} className="text-[var(--tx-accent)]"/> Como o TubeX calcula esses indicadores?</span><ChevronDown size={14} className={`transition ${showDefinitions ? "rotate-180" : ""}`}/></button>{showDefinitions && <div className="mt-3 grid gap-3 text-[10px] leading-5 text-[var(--tx-muted)] md:grid-cols-2"><p><b className="text-[var(--tx-text)]">Interesse de busca:</b> índice 0–100 baseado em desempenho dos vídeos do resultado, amplitude estimada de resultados, adoção da frase nos títulos e publicações recentes. Não é volume mensal fornecido pelo YouTube.</p><p><b className="text-[var(--tx-text)]">Baixa concorrência:</b> índice invertido, alinhado ao motor atual da extensão. 100 indica menor pressão competitiva estimada; 0 indica maior.</p><p><b className="text-[var(--tx-text)]">Engajamento:</b> soma de curtidas e comentários públicos dividida pelas visualizações dos vídeos analisados.</p><p><b className="text-[var(--tx-text)]">Oportunidade:</b> combina espaço de título, baixa concorrência e frescor dos resultados. É um indicador comparativo, não uma previsão de ranking.</p></div>}</section>
    </>}

    {!analysis && !searching && <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]"><div className="tx-surface rounded-[20px] p-6"><div className="flex items-center gap-2"><Target size={17} className="text-[var(--tx-accent)]"/><p className="text-sm font-black">Seu laboratório de palavras-chave</p></div><p className="mt-2 max-w-xl text-xs leading-6 text-[var(--tx-muted)]">Pesquise uma frase para comparar os resultados do YouTube, identificar a força dos vídeos concorrentes e avaliar o espaço para um novo conteúdo.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><FeatureLine icon={<Gauge size={15}/>} title="Velocímetros" text="Interesse e baixa concorrência"/><FeatureLine icon={<TrendingUp size={15}/>} title="Métricas de mercado" text="Views, mediana e engajamento"/><FeatureLine icon={<Video size={15}/>} title="Vídeos concorrentes" text="Analise os resultados reais"/><FeatureLine icon={<Sparkles size={15}/>} title="Termos relacionados" text="Descubra novas abordagens"/></div></div><div className="tx-surface rounded-[20px] p-6"><p className="tx-kicker">EXPERIMENTE UMA PESQUISA</p><div className="mt-4 flex flex-wrap gap-2">{["como crescer no YouTube","ideias de vídeos para canal pequeno","como melhorar o CTR","como conseguir inscritos no YouTube"].map(item => <button key={item} onClick={() => { setKeyword(item); void analyzeKeyword(item); }} className="rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-3 py-2 text-[10px] font-bold hover:border-[var(--tx-accent)]">{item}</button>)}</div><p className="mt-5 text-[10px] leading-5 text-[var(--tx-muted)]">As pesquisas usam a região e o idioma escolhidos acima. A API do YouTube aplica sua própria ordenação de relevância.</p></div></section>}
    <p className="px-1 text-[9px] leading-5 text-[var(--tx-muted)]">Os indicadores são estimativas calculadas a partir de informações públicas dos vídeos encontrados no YouTube. Eles ajudam a comparar oportunidades, mas não representam volume mensal oficial de buscas nem garantem posições, visualizações ou crescimento. Os resultados podem variar conforme a pesquisa e a disponibilidade dos dados.</p>
  </div>;
}

export function UpgradeGate({ kind, plan }: { kind: "quota" | "trends" | "expert" | "tags"; plan: string }) {
  const [closed, setClosed] = useState(false);
  if (closed) return <div className="mt-4 flex justify-end"><button onClick={() => setClosed(false)} className="text-[10px] font-bold text-[var(--tx-accent)]">Ver opções de upgrade</button></div>;
  const target = plan === "pro" || kind === "expert" ? "expert" : "pro";
  const isExpertOffer = target === "expert";
  const checkout = isExpertOffer
    ? "https://buy.stripe.com/dRmaEW98dggV3Z3d2mgjC02"
    : "https://buy.stripe.com/3cI7sK7058OtdzDaUegjC01";
  const title = isExpertOffer
    ? kind === "quota"
      ? "Continue pesquisando sem limites."
      : "Leve sua análise de concorrência ao nível máximo."
    : kind === "trends"
      ? "Descubra tendências antes de escolher seu próximo vídeo."
      : kind === "tags"
        ? "Encontre mais palavras-chave para cada vídeo."
        : "Desbloqueie até 50 análises por dia.";
  const description = isExpertOffer
    ? "Com o Expert, você pesquisa sem limite diário, visualiza todos os concorrentes e aprofunda cada oportunidade. Tenha liberdade para validar quantas ideias quiser e planejar seu conteúdo com mais confiança."
    : kind === "quota"
      ? "Você já aproveitou suas análises gratuitas de hoje. Com o Pro, continue sua pesquisa com até 50 análises por dia, acesse o Google Trends do YouTube e compare até 20 vídeos por palavra-chave."
      : kind === "tags"
        ? "No Free, você experimenta três sugestões por pesquisa. Com o Pro, desbloqueie a lista completa de palavras-chave encontradas em vídeos relevantes e no autocomplete do YouTube, além de até 50 análises diárias e Google Trends."
        : "Com o Pro, acompanhe o interesse ao longo do tempo no Google Trends do YouTube, compare até 20 vídeos por pesquisa e tenha até 50 análises diárias para escolher pautas com mais potencial.";
  return <section className="relative mt-4 overflow-hidden rounded-[20px] border border-[var(--tx-accent)]/35 bg-[linear-gradient(115deg,var(--tx-surface),color-mix(in_srgb,var(--tx-accent)_10%,var(--tx-surface)))] p-5 md:p-6">
    <button aria-label="Fechar mensagem" onClick={() => setClosed(true)} className="absolute right-4 top-4 text-sm text-[var(--tx-muted)] hover:text-[var(--tx-text)]">×</button>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-2xl">
        <p className="tx-kicker">{isExpertOffer ? "TUBEX EXPERT" : "TUBEX PRO"} · MAIS PODER PARA CRESCER</p>
        <h3 className="mt-2 pr-6 text-xl font-black md:text-2xl">{title}</h3>
        <p className="mt-2 text-xs leading-6 text-[var(--tx-muted)]">{description}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-bold text-[var(--tx-text)]">
          {(isExpertOffer
            ? ["Pesquisas ilimitadas", "Todos os vídeos concorrentes", "Mais profundidade em cada oportunidade"]
            : kind === "tags"
              ? ["Lista completa de palavras-chave", "50 análises por dia", "Google Trends no YouTube"]
              : ["50 análises por dia", "Google Trends no YouTube", "Até 20 vídeos por palavra-chave"]
          ).map(item => <span key={item} className="flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-500"/>{item}</span>)}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:min-w-[180px]">
        <a href={checkout} target="_blank" rel="noreferrer" className="tx-btn tx-btn-primary justify-center">{isExpertOffer ? "Quero o Expert · R$49,99/mês" : "Quero o Pro · R$29,99/mês"} <ArrowUpRight size={14}/></a>
        <a href="/#planos" className="text-center text-[10px] font-bold text-[var(--tx-muted)] hover:text-[var(--tx-text)]">Ver todos os benefícios</a>
      </div>
    </div>
  </section>;
}

function ChannelAvatar({ src, title }: { src?: string; title?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const initial = String(title || "YouTube").trim().slice(0, 1).toUpperCase() || "Y";
  return <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)]">
    {src && !failed ? <img src={src} alt={`Imagem do canal ${title || ""}`} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover"/> : <span className="text-sm font-black text-[var(--tx-accent)]">{initial}</span>}
  </div>;
}

function ChannelStat({ icon, label, value }: any) { return <div className="flex items-center gap-2 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)]/70 px-3 py-2.5"><span className="text-[var(--tx-accent)]">{icon}</span><div className="min-w-0"><p className="text-[9px] font-bold text-[var(--tx-muted)]">{label}</p><p className="truncate text-xs font-black">{value}</p></div></div>; }
function MetricCard({ icon, label, value, sub }: any) { return <div className="tx-surface rounded-[17px] p-4"><div className="flex items-center gap-2 text-[var(--tx-accent)]">{icon}<span className="text-[9px] font-black uppercase tracking-wide text-[var(--tx-muted)]">{label}</span></div><p className="mt-3 text-2xl font-black tabular-nums">{value}</p><p className="mt-1 text-[9px] leading-4 text-[var(--tx-muted)]">{sub}</p></div>; }
function FeatureLine({ icon, title, text }: any) { return <div className="flex items-start gap-2 rounded-xl border border-[var(--tx-border)] p-3"><span className="mt-0.5 text-[var(--tx-accent)]">{icon}</span><div><p className="text-[10px] font-black">{title}</p><p className="mt-1 text-[9px] text-[var(--tx-muted)]">{text}</p></div></div>; }
function ScoreLine({ label, value }: { label: string; value: number }) { return <div><div className="mb-1 flex items-center justify-between text-[9px]"><span className="text-[var(--tx-muted)]">{label}</span><b className="tabular-nums">{Math.round(value)}/100</b></div><div className="h-1.5 overflow-hidden rounded-full bg-[var(--tx-surface-2)]"><div className="h-full rounded-full bg-[var(--tx-accent)]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }}/></div></div>; }
function TubeXScoreGauge({
  score,
  volume,
  competition,
  opportunity,
}: {
  score: number;
  volume: number;
  competition: number;
  opportunity: number;
}) {
  const [animated, setAnimated] = useState(0);
  const value = Math.max(0, Math.min(100, Number(score) || 0));

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimated(value));
    return () => cancelAnimationFrame(frame);
  }, [value]);

  // Faixas coerentes com o status do TubeX Score.
  // "Bom", "Muito bom" e "Excelente" usam verde.
  const status =
    value >= 80
      ? { label: "EXCELENTE", color: "#22C55E", soft: "rgba(34,197,94,.13)" }
      : value >= 65
        ? { label: "MUITO BOM", color: "#22C55E", soft: "rgba(34,197,94,.13)" }
        : value >= 50
          ? { label: "BOM", color: "#22C55E", soft: "rgba(34,197,94,.13)" }
          : value >= 40
            ? { label: "MÉDIO", color: "#FACC15", soft: "rgba(250,204,21,.13)" }
            : { label: "EM DESENVOLVIMENTO", color: "#EF4444", soft: "rgba(239,68,68,.13)" };

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (1 - animated / 100);

  return (
    <section className="tx-surface min-h-[300px] rounded-[20px] border border-[var(--tx-border)] p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="tx-kicker">TUBEX SCORE</p>
          <h3 className="mt-1 text-xl font-black tracking-tight md:text-2xl">
            Potencial da palavra-chave
          </h3>
        </div>
        <span
          className="rounded-full px-4 py-2 text-[10px] font-black tracking-wide"
          style={{ color: status.color, backgroundColor: status.soft }}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-6 grid items-center gap-6 md:grid-cols-[138px_minmax(0,1fr)] md:gap-7">
        <div className="mx-auto grid h-[138px] w-[138px] place-items-center">
          <svg viewBox="0 0 140 140" className="h-[138px] w-[138px]" role="img" aria-label={`TubeX Score ${Math.round(value)} de 100`}>
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#172126"
              strokeWidth="13"
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={status.color}
              strokeWidth="13"
              strokeLinecap="butt"
              strokeDasharray={circumference}
              strokeDashoffset={progress}
              transform="rotate(-90 70 70)"
              style={{
                transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1), stroke 250ms ease",
                filter: `drop-shadow(0 0 5px ${status.color}55)`,
              }}
            />
            <text
              x="70"
              y="79"
              textAnchor="middle"
              fill="#F8FAFC"
              fontSize="29"
              fontWeight="900"
              letterSpacing="-1"
            >
              {Math.round(animated)}
            </text>
          </svg>
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-5">
          <TubeXMetricBar title="Volume de pesquisa" score={volume} tone="volume"/>
          <TubeXMetricBar title="Baixa concorrência" score={competition} tone="competition"/>
          <TubeXMetricBar title="Força de otimização" score={opportunity} tone="opportunity"/>
        </div>
      </div>

      <p className="mt-5 text-[10px] leading-6 text-[var(--tx-muted)] md:text-[11px]">
        TubeX Score alinhado ao cálculo da extensão: combina volume, concorrência e oportunidade. É comparativo, não garantia de posicionamento.
      </p>
    </section>
  );
}

function TubeXMetricBar({
  title,
  score,
  tone,
}: {
  title: string;
  score: number;
  tone: "volume" | "competition" | "opportunity";
}) {
  const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const label =
    tone === "volume"
      ? value >= 85 ? "Muito Alto" : value >= 70 ? "Alto" : value >= 50 ? "Médio" : value >= 30 ? "Baixo" : "Muito Baixo"
      : tone === "competition"
        ? value >= 85 ? "Muito Baixa" : value >= 60 ? "Baixa" : value >= 40 ? "Média" : value >= 30 ? "Alta" : "Muito Alta"
        : value >= 75 ? "Forte" : value >= 50 ? "Boa" : value >= 35 ? "Moderada" : "Baixa";

  // Barras mantêm o amarelo característico do layout de referência.
  const barColor = "#FACC15";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-medium text-[var(--tx-muted)] md:text-[11px]">
          {title}
        </span>
        <span className="text-[10px] font-extrabold tabular-nums text-[var(--tx-text)] md:text-[11px]">
          {value}/100
        </span>
      </div>
      <div className="h-[9px] overflow-hidden rounded-full bg-[#151E22]">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${value}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

function TrendChart({ points }: { points: { label: string; value: number }[] }) {
  const width = 760, height = 190, padX = 12, padY = 14;
  const coords = points.map((point, index) => `${padX + (index / Math.max(1, points.length - 1)) * (width - padX * 2)},${height - padY - (point.value / 100) * (height - padY * 2)}`).join(" ");
  return <div className="mt-4 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)]/45 p-3"><div className="mb-2 flex items-center justify-between text-[9px] text-[var(--tx-muted)]"><span>Interesse relativo</span><span>0–100</span></div><svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full"><defs><linearGradient id="tubex-trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--tx-accent)" stopOpacity=".25"/><stop offset="100%" stopColor="var(--tx-accent)" stopOpacity="0"/></linearGradient></defs>{[0,25,50,75,100].map(value => <g key={value}><line x1={padX} x2={width-padX} y1={height-padY-(value/100)*(height-padY*2)} y2={height-padY-(value/100)*(height-padY*2)} stroke="var(--tx-border)" strokeDasharray="4 5"/><text x="0" y={height-padY-(value/100)*(height-padY*2)+3} fontSize="9" fill="var(--tx-muted)">{value}</text></g>)}<polygon points={`${padX},${height-padY} ${coords} ${width-padX},${height-padY}`} fill="url(#tubex-trend-fill)"/><polyline points={coords} fill="none" stroke="var(--tx-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{points.map((point,index)=><circle key={index} cx={padX+(index/Math.max(1,points.length-1))*(width-padX*2)} cy={height-padY-(point.value/100)*(height-padY*2)} r="2.4" fill="var(--tx-accent)"/>)}</svg><div className="flex justify-between text-[8px] text-[var(--tx-muted)]"><span>{points[0]?.label}</span><span>{points[Math.floor(points.length/2)]?.label}</span><span>{points[points.length-1]?.label}</span></div></div>;
}
