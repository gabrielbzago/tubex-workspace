"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import {
  Activity, AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, CheckCircle2,
  Clock3, Eye, MessageCircle, PlayCircle, RefreshCw, ThumbsUp, TrendingDown,
  TrendingUp, Video, Zap, Users, CalendarDays, Target, Lightbulb, ExternalLink
} from "lucide-react";

type Channel = {
  id: string; title: string; description: string; thumbnail: string;
  subscribers: number; views: number; videoCount: number; uploads: string;
};
type VideoRow = {
  id: string; title: string; thumbnail: string; publishedAt: string;
  views: number; likes: number; comments: number; durationSeconds: number;
};
type CommentRow = {
  id: string; videoId: string; videoTitle: string; author: string;
  text: string; publishedAt: string; likes: number; replies: number;
};
type Period = "7" | "28" | "90";

const API = "https://www.googleapis.com/youtube/v3";
const number = (v: number) => new Intl.NumberFormat("pt-BR", {
  notation: v > 99999 ? "compact" : "standard", maximumFractionDigits: 1
}).format(v || 0);
const date = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};
const short = (s: string, n = 100) => s.length > n ? s.slice(0, n - 1) + "…" : s;
const durationSeconds = (iso: string) => {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : 0;
};
const durationLabel = (seconds: number) => seconds >= 3600
  ? `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}min`
  : `${Math.floor(seconds / 60)}min ${seconds % 60}s`;
const words = (title: string) => title.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
  .filter(w => w.length >= 4 && !new Set(["para","como","voce","seus","suas","sobre","mais","menos","youtube","video","videos","canal","guia","dicas","com","uma","que","por","dos","das","seu","sua","the","and","with"]).has(w));

async function yt(path: string, token: string) {
  const r = await fetch(`${API}/${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const error = new Error(d?.error?.message || `YouTube API: ${r.status}`) as Error & { status?: number };
    error.status = r.status;
    throw error;
  }
  return d;
}

function Metric({ label, value, sub, icon: Icon, tone = "gold" }: any) {
  return <div className="rounded-2xl border border-[var(--tx-border)] bg-[var(--tx-surface)] p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-black uppercase tracking-[.13em] text-[var(--tx-muted)]">{label}</span>
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone === "green" ? "bg-emerald-500/10 text-emerald-500" : tone === "red" ? "bg-rose-500/10 text-rose-500" : "bg-[var(--tx-accent-soft)] text-[var(--tx-accent-strong)]"}`}><Icon size={17}/></span>
    </div>
    <div className="mt-3 text-3xl font-black tracking-tight">{value}</div>
    <div className="mt-1 text-[11px] text-[var(--tx-muted)]">{sub}</div>
  </div>;
}
function Panel({ title, subtitle, icon: Icon, children, action }: any) {
  return <section className="overflow-hidden rounded-2xl border border-[var(--tx-border)] bg-[var(--tx-surface)] shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-[var(--tx-border)] px-5 py-4">
      <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--tx-accent-soft)] text-[var(--tx-accent-strong)]"><Icon size={17}/></span>
        <div><h3 className="text-sm font-black">{title}</h3>{subtitle && <p className="mt-0.5 text-[10px] text-[var(--tx-muted)]">{subtitle}</p>}</div>
      </div>{action}
    </div>
    <div className="p-5">{children}</div>
  </section>;
}
function Insight({ tone, title, children }: { tone: "good" | "warn" | "neutral"; title: string; children: ReactNode }) {
  const style = tone === "good" ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-500" : tone === "warn" ? "border-rose-500/20 bg-rose-500/5 text-rose-500" : "border-[var(--tx-border)] bg-[var(--tx-surface-2)] text-[var(--tx-muted)]";
  return <div className={`rounded-xl border p-3 ${style}`}><p className="flex items-center gap-2 text-xs font-black">{tone === "good" ? <TrendingUp size={15}/> : tone === "warn" ? <TrendingDown size={15}/> : <Lightbulb size={15}/>} {title}</p><p className="mt-2 text-xs leading-5 text-[var(--tx-text)]">{children}</p></div>;
}

export default function FeedDashboard() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState("");
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentWarning, setCommentWarning] = useState("");
  const [updated, setUpdated] = useState("");
  const [range, setRange] = useState<Period>("28");

  const load = useCallback(async (requestedChannelId?: string) => {
    setLoading(true); setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = String((data.session as any)?.provider_token || "");
      if (!token) throw new Error("O canal não está autorizado para leitura. Reconecte sua conta Google e conceda acesso de leitura ao YouTube.");
      const mine = await yt("channels?part=snippet,statistics,contentDetails&mine=true&maxResults=50", token);
      const found: Channel[] = (mine.items || []).map((c: any) => ({
        id: String(c.id), title: c.snippet?.title || "Canal", description: c.snippet?.description || "",
        thumbnail: c.snippet?.thumbnails?.high?.url || c.snippet?.thumbnails?.medium?.url || c.snippet?.thumbnails?.default?.url || "",
        subscribers: Number(c.statistics?.subscriberCount || 0), views: Number(c.statistics?.viewCount || 0),
        videoCount: Number(c.statistics?.videoCount || 0), uploads: String(c.contentDetails?.relatedPlaylists?.uploads || "")
      }));
      setChannels(found);
      if (!found.length) throw new Error("Nenhum canal foi encontrado nesta conta Google.");
      const savedId = typeof window !== "undefined" ? localStorage.getItem("tubex-feed-channel") || "" : "";
      const selected = found.find(c => c.id === (requestedChannelId || channelId || savedId)) || found[0];
      setChannelId(selected.id);
      if (typeof window !== "undefined") localStorage.setItem("tubex-feed-channel", selected.id);
      setChannel(selected);
      if (!selected.uploads) throw new Error("Não foi possível localizar a playlist de vídeos deste canal.");

      const playlistItems: any[] = [];
      let pageToken = "";
      for (let page = 0; page < 2; page++) {
        const p = new URLSearchParams({ part: "snippet,contentDetails", playlistId: selected.uploads, maxResults: "50" });
        if (pageToken) p.set("pageToken", pageToken);
        const result = await yt(`playlistItems?${p.toString()}`, token);
        playlistItems.push(...(result.items || []));
        pageToken = String(result.nextPageToken || "");
        if (!pageToken) break;
      }
      const ids = playlistItems.map(x => x.contentDetails?.videoId).filter(Boolean);
      const rows: VideoRow[] = [];
      for (let i = 0; i < ids.length; i += 50) {
        const p = new URLSearchParams({ part: "snippet,statistics,contentDetails", id: ids.slice(i, i + 50).join(",") });
        const result = await yt(`videos?${p.toString()}`, token);
        for (const v of result.items || []) rows.push({
          id: String(v.id), title: v.snippet?.title || "Sem título",
          thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || "",
          publishedAt: v.snippet?.publishedAt || "", views: Number(v.statistics?.viewCount || 0),
          likes: Number(v.statistics?.likeCount || 0), comments: Number(v.statistics?.commentCount || 0),
          durationSeconds: durationSeconds(String(v.contentDetails?.duration || ""))
        });
      }
      rows.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      setVideos(rows);

      const pending: CommentRow[] = [];
      let commentDenied = false;
      for (const v of rows.slice(0, 12)) {
        try {
          const p = new URLSearchParams({ part: "snippet,replies", videoId: v.id, maxResults: "100", order: "time" });
          const result = await yt(`commentThreads?${p.toString()}`, token);
          for (const item of result.items || []) {
            const top = item.snippet?.topLevelComment?.snippet;
            if (!top) continue;
            if (Number(item.snippet?.totalReplyCount || 0) === 0) pending.push({
              id: String(item.id), videoId: v.id, videoTitle: v.title, author: top.authorDisplayName || "Usuário",
              text: top.textDisplay || "", publishedAt: top.publishedAt || "", likes: Number(top.likeCount || 0), replies: 0
            });
          }
        } catch (e: any) { commentDenied = true; console.warn("TubeX comments", e?.message); }
      }
      pending.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      setComments(pending);
      setCommentWarning(commentDenied ? "A API não liberou todos os comentários. O total pendente pode estar incompleto; confira as permissões OAuth do canal." : "");
      setUpdated(new Date().toLocaleString("pt-BR"));
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar os dados.");
    } finally { setLoading(false); }
  }, [channelId]);

  useEffect(() => { void load(); }, []); // carga inicial deliberada

  const days = Number(range);
  const cutoff = Date.now() - days * 86400000;
  const filtered = useMemo(() => videos.filter(v => new Date(v.publishedAt).getTime() >= cutoff), [videos, cutoff]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => b.views - a.views), [filtered]);
  const best = sorted[0];
  const worst = sorted.length ? sorted[sorted.length - 1] : undefined;
  const avg = filtered.length ? filtered.reduce((s, v) => s + v.views, 0) / filtered.length : 0;
  const totalViews = filtered.reduce((s, v) => s + v.views, 0);
  const totalLikes = filtered.reduce((s, v) => s + v.likes, 0);
  const totalComments = filtered.reduce((s, v) => s + v.comments, 0);
  const engagement = totalViews ? (totalLikes + totalComments) / totalViews * 100 : 0;
  const shorts = filtered.filter(v => v.durationSeconds > 0 && v.durationSeconds <= 60);
  const longs = filtered.filter(v => v.durationSeconds > 60);
  const shortAvg = shorts.length ? shorts.reduce((s, v) => s + v.views, 0) / shorts.length : 0;
  const longAvg = longs.length ? longs.reduce((s, v) => s + v.views, 0) / longs.length : 0;
  const max = Math.max(1, ...filtered.map(v => v.views));
  const chart = [...filtered].reverse().slice(-14);
  const bestEngagement = [...filtered].sort((a, b) => ((b.likes + b.comments) / Math.max(1, b.views)) - ((a.likes + a.comments) / Math.max(1, a.views)))[0];
  const underperforming = sorted.filter(v => avg > 0 && v.views < avg * 0.5);
  const topicInsights = useMemo(() => {
    const map = new Map<string, { count: number; views: number; titles: string[] }>();
    filtered.forEach(v => new Set(words(v.title)).forEach(w => {
      const item = map.get(w) || { count: 0, views: 0, titles: [] };
      item.count++; item.views += v.views; item.titles.push(v.title); map.set(w, item);
    }));
    return [...map.entries()].filter(([, x]) => x.count >= 2)
      .map(([word, x]) => ({ word, count: x.count, avg: x.views / x.count }))
      .sort((a, b) => b.avg - a.avg).slice(0, 6);
  }, [filtered]);
  const weekdays = useMemo(() => {
    const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return names.map((name, day) => {
      const items = filtered.filter(v => new Date(v.publishedAt).getDay() === day);
      return { name, count: items.length, avg: items.length ? items.reduce((s, v) => s + v.views, 0) / items.length : 0 };
    });
  }, [filtered]);
  const strongestDay = [...weekdays].filter(x => x.count >= 2).sort((a, b) => b.avg - a.avg)[0];

  if (loading) return <div className="grid min-h-[55vh] place-items-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-[var(--tx-accent-strong)]" size={28}/><p className="mt-3 text-sm font-bold">Preparando seu painel de desempenho…</p><p className="mt-1 text-xs text-[var(--tx-muted)]">Buscando canais, vídeos e comentários no YouTube.</p></div></div>;
  if (error) return <div className="mx-auto max-w-3xl rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6"><div className="flex gap-3"><AlertCircle className="text-rose-500"/><div><h2 className="font-black">Não foi possível carregar seu feed</h2><p className="mt-2 text-sm text-[var(--tx-muted)]">{error}</p><button onClick={() => void load()} className="mt-4 rounded-xl bg-[var(--tx-accent)] px-4 py-2 text-xs font-black text-[#171717]">Tentar novamente</button></div></div></div>;

  return <div className="space-y-5">
    <div className="overflow-hidden rounded-3xl border border-[var(--tx-border)] bg-[radial-gradient(circle_at_85%_10%,rgba(244,197,66,.18),transparent_35%),var(--tx-surface)] p-5 md:p-7">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div className="flex min-w-0 items-center gap-4">{channel?.thumbnail && <img src={channel.thumbnail} alt="" className="h-16 w-16 rounded-2xl border border-[var(--tx-border)] object-cover"/>}
          <div className="min-w-0"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500"/><span className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-500">Canal conectado</span></div>
            <h1 className="mt-1 truncate text-2xl font-black tracking-tight md:text-3xl">{channel?.title}</h1>
            <p className="mt-1 text-xs text-[var(--tx-muted)]">{number(channel?.subscribers || 0)} inscritos · {number(channel?.videoCount || 0)} vídeos · atualizado {updated}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {channels.length > 1 && <select aria-label="Selecionar canal" value={channelId} onChange={e => void load(e.target.value)} className="max-w-[220px] rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] px-3 py-2.5 text-xs font-bold">{channels.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>}
          <select aria-label="Período" value={range} onChange={e => setRange(e.target.value as Period)} className="rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] px-3 py-2.5 text-xs font-bold"><option value="7">Últimos 7 dias</option><option value="28">Últimos 28 dias</option><option value="90">Últimos 90 dias</option></select>
          <button onClick={() => void load(channelId)} className="flex items-center gap-2 rounded-xl bg-[var(--tx-accent)] px-4 py-2.5 text-xs font-black text-[#171717]"><RefreshCw size={14}/> Atualizar</button>
        </div>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Visualizações do canal" value={number(channel?.views || 0)} sub="Total acumulado do canal" icon={Eye}/>
      <Metric label="Inscritos" value={number(channel?.subscribers || 0)} sub="Inscritos públicos atuais" icon={Users} tone="green"/>
      <Metric label="Views em novos vídeos" value={number(totalViews)} sub={`${filtered.length} publicações nos últimos ${days} dias`} icon={PlayCircle}/>
      <Metric label="Comentários sem resposta" value={number(comments.length)} sub="Nos 12 vídeos mais recentes" icon={MessageCircle} tone={comments.length ? "red" : "green"}/>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Engajamento público" value={`${engagement.toFixed(2).replace(".", ",")}%`} sub="(Curtidas + comentários) ÷ views" icon={Activity}/>
      <Metric label="Média por publicação" value={number(avg)} sub="Visualizações por vídeo no período" icon={Target}/>
      <Metric label="Shorts identificados" value={number(shorts.length)} sub="Duração de até 60 segundos (estimativa)" icon={Video}/>
      <Metric label="Vídeos longos" value={number(longs.length)} sub="Duração acima de 60 segundos" icon={Clock3}/>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
      <Panel title="Ritmo de visualizações por publicação" subtitle={`Comparação dos vídeos publicados nos últimos ${days} dias · não representa views por hora`} icon={BarChart3}>
        {chart.length ? <div className="flex h-52 items-end gap-2 border-b border-[var(--tx-border)] pb-2">{chart.map(v => <div key={v.id} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"><div title={`${v.title}: ${number(v.views)} views`} className="w-full rounded-t-lg bg-gradient-to-t from-amber-500 to-yellow-300 transition hover:brightness-110" style={{ height: `${Math.max(4, v.views / max * 100)}%` }}/><span className="mt-2 truncate text-center text-[9px] text-[var(--tx-muted)]">{date(v.publishedAt)}</span></div>)}</div> : <p className="py-12 text-center text-sm text-[var(--tx-muted)]">Sem vídeos publicados neste período.</p>}
        <div className="mt-4 flex flex-wrap gap-4 text-xs"><span className="font-bold">Média por vídeo: {number(avg)} views</span><span className="text-[var(--tx-muted)]">Curtidas: {number(totalLikes)}</span><span className="text-[var(--tx-muted)]">Comentários: {number(totalComments)}</span></div>
      </Panel>
      <Panel title="Diagnóstico TubeX" subtitle="Leituras calculadas a partir dos dados públicos" icon={Zap}>
        <div className="space-y-3">
          <Insight tone="good" title="O que está dando certo">{best ? `“${short(best.title, 68)}” lidera com ${number(best.views)} visualizações. Está ${avg ? (best.views / avg).toFixed(1).replace(".", ",") : "—"}× acima da média do período.` : "Publique vídeos para formar uma base de comparação."}</Insight>
          <Insight tone="warn" title="O que merece atenção">{worst ? `“${short(worst.title, 60)}” tem ${number(worst.views)} views. ${underperforming.length} vídeo(s) estão abaixo de metade da média do período.` : "Ainda não há dados suficientes para apontar vídeos fracos."}</Insight>
          <Insight tone="neutral" title="Engajamento">{bestEngagement ? `“${short(bestEngagement.title, 52)}” lidera em interação pública proporcional: ${(((bestEngagement.likes + bestEngagement.comments) / Math.max(1, bestEngagement.views)) * 100).toFixed(2).replace(".", ",")}% de curtidas + comentários por view.` : "Sem dados de engajamento no período."}</Insight>
          <Insight tone="neutral" title="Formato">{shorts.length && longs.length ? `Média de views: Shorts ${number(shortAvg)} · vídeos longos ${number(longAvg)}. Compare formatos com cautela: a duração é usada como aproximação, não como classificação oficial do YouTube.` : "Publique os dois formatos para comparar o desempenho médio."}</Insight>
        </div>
      </Panel>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Vídeos em destaque" subtitle="Maiores resultados do período, com capas reais" icon={TrendingUp}>
        {sorted.length ? <div className="space-y-3">{sorted.slice(0, 5).map((v, i) => <div key={v.id} className="flex gap-3"><a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer" className="relative w-32 shrink-0 overflow-hidden rounded-xl bg-[var(--tx-surface-2)]"><img src={v.thumbnail} alt="" className="aspect-video h-full w-full object-cover"/><span className="absolute left-1 top-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-black text-white">#{i + 1}</span></a><div className="min-w-0 flex-1"><p className="line-clamp-2 text-xs font-extrabold">{v.title}</p><p className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[var(--tx-muted)]"><span className="flex items-center gap-1"><Eye size={12}/>{number(v.views)}</span><span className="flex items-center gap-1"><ThumbsUp size={12}/>{number(v.likes)}</span><span>{date(v.publishedAt)}</span></p></div></div>)}</div> : <p className="text-xs text-[var(--tx-muted)]">Sem dados suficientes.</p>}
      </Panel>
      <Panel title="Vídeos que precisam de atenção" subtitle="Resultados abaixo da média do período" icon={TrendingDown}>
        {underperforming.length ? <div className="space-y-3">{underperforming.slice(0, 5).map(v => <div key={v.id} className="flex gap-3"><a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer"><img src={v.thumbnail} alt="" className="aspect-video w-32 rounded-xl object-cover"/></a><div className="min-w-0 flex-1"><p className="line-clamp-2 text-xs font-extrabold">{v.title}</p><p className="mt-2 text-[10px] text-[var(--tx-muted)]">{number(v.views)} views · {avg ? Math.round(v.views / avg * 100) : 0}% da média · {date(v.publishedAt)}</p></div></div>)}</div> : <Insight tone="good" title="Sem alerta crítico">Nenhum vídeo ficou abaixo de 50% da média neste período. Isso não significa que todos estejam performando bem em impressões ou retenção, dados que não estão disponíveis nesta consulta.</Insight>}
      </Panel>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Temas que mais se repetem" subtitle="Palavras presentes em pelo menos dois títulos e média de views associada" icon={Lightbulb}>
        {topicInsights.length ? <div className="space-y-3">{topicInsights.map((t, i) => <div key={t.word} className="flex items-center gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--tx-surface-2)] text-[10px] font-black">{i + 1}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><span className="truncate text-xs font-bold capitalize">{t.word}</span><span className="text-xs font-black">{number(t.avg)} views/vídeo</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--tx-surface-2)]"><div className="h-full rounded-full bg-[var(--tx-accent)]" style={{ width: `${Math.max(4, t.avg / Math.max(1, topicInsights[0].avg) * 100)}%` }}/></div><p className="mt-1 text-[10px] text-[var(--tx-muted)]">{t.count} vídeos com essa palavra no título</p></div></div>)}</div> : <p className="text-xs text-[var(--tx-muted)]">Ainda não há repetição suficiente de palavras nos títulos para identificar padrões.</p>}
      </Panel>
      <Panel title="Desempenho por dia de publicação" subtitle="Média de views dos vídeos publicados em cada dia · mínimo de 2 para destacar" icon={CalendarDays}>
        <div className="space-y-3">{weekdays.map(d => <div key={d.name} className="flex items-center gap-3"><span className="w-8 text-[10px] font-bold text-[var(--tx-muted)]">{d.name}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--tx-surface-2)]"><div className="h-full rounded-full bg-[var(--tx-accent)]" style={{ width: `${Math.max(d.count ? 3 : 0, d.avg / Math.max(1, ...weekdays.map(x => x.avg)) * 100)}%` }}/></div><span className="w-20 text-right text-[10px] font-bold">{d.count ? number(d.avg) : "—"}</span></div>)}</div>
        <p className="mt-4 rounded-xl bg-[var(--tx-surface-2)] p-3 text-xs text-[var(--tx-muted)]">{strongestDay ? `Sinal inicial: ${strongestDay.name} tem a maior média (${number(strongestDay.avg)} views), com ${strongestDay.count} vídeos. Use como hipótese de teste, não como horário ideal comprovado.` : "Ainda são necessários pelo menos dois vídeos publicados no mesmo dia da semana para apontar um padrão."}</p>
      </Panel>
    </div>

    <Panel title="Comentários que aguardam resposta" subtitle="Comentários sem resposta nos 12 vídeos mais recentes. A resposta é feita no YouTube Studio." icon={MessageCircle} action={<span className="rounded-full bg-rose-500/10 px-3 py-1 text-[10px] font-black text-rose-500">{comments.length} pendentes</span>}>
      {commentWarning && <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-amber-600">{commentWarning}</div>}
      {comments.length ? <div className="grid gap-3 lg:grid-cols-2">{comments.slice(0, 16).map(c => <div key={c.id} className="rounded-xl border border-[var(--tx-border)] p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black">{c.author}</p><span className="text-[10px] text-[var(--tx-muted)]">{date(c.publishedAt)}</span></div><p className="mt-2 text-xs leading-5 text-[var(--tx-muted)]">{short(c.text.replace(/<[^>]*>/g, ""), 220)}</p><p className="mt-2 text-[10px] text-[var(--tx-muted)]">No vídeo: {short(c.videoTitle, 80)}</p><a target="_blank" rel="noreferrer" href={`https://studio.youtube.com/video/${c.videoId}/comments`} className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-[var(--tx-accent-strong)]">Responder no YouTube <ExternalLink size={12}/></a></div>)}</div> : <div className="py-8 text-center"><CheckCircle2 className="mx-auto text-emerald-500" size={28}/><p className="mt-2 text-sm font-bold">{commentWarning ? "Não foi possível confirmar os comentários pendentes" : "Nenhum comentário sem resposta encontrado"}</p><p className="mt-1 text-[10px] text-[var(--tx-muted)]">A busca considera os 12 vídeos mais recentes e comentários acessíveis pela API.</p></div>}
    </Panel>

    <p className="rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-3 text-[10px] leading-5 text-[var(--tx-muted)]">Transparência dos dados: este painel usa a YouTube Data API. Views, curtidas, comentários, inscritos, duração e datas são dados públicos retornados pelo YouTube. CTR, impressões, retenção, tempo de exibição, origem de tráfego e crescimento diário de inscritos exigem YouTube Analytics API e permissões adicionais; não são estimados aqui.</p>
  </div>;
}
