"use client";
import { useMemo, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Sparkles, LayoutGrid, List, Loader2, MonitorPlay as Youtube, RefreshCw, ThumbsUp, MessageCircle, Eye, Wrench } from "lucide-react";
import { useChannelData, connectYouTube, baselineFor, compact, ago, type YTVideo } from "@/lib/tubex-youtube";
import IntelligenceCenter from "./intelligence-center";
import FeedDashboard from "./feed-dashboard";

type Tab = "videos" | "shorts" | "tips" | "report";
type Sort = "recent" | "views" | "ratio" | "engagement";
const go = (tab: string) => window.dispatchEvent(new CustomEvent("tubex-navigate-tab", { detail: tab }));
const askAI = (prompt: string) => { try { sessionStorage.setItem("tubex-ai-prefill", prompt); } catch {} go("ai"); };

type Row = YTVideo & { ratio: number | null; engagement: number; hint: string | null; status: "up" | "avg" | "down" | "new" };

function analyse(videos: YTVideo[]): Row[] {
  const engAvg = (() => { const s = videos.filter((v) => v.views > 50); return s.length ? s.reduce((a, v) => a + (v.likes + v.comments) / v.views, 0) / s.length : 0; })();
  return videos.map((v, i) => {
    const base = baselineFor(videos, i);
    const ratio = base ? v.views / base : null;
    const engagement = v.views ? (v.likes + v.comments) / v.views : 0;
    const ageDays = (Date.now() - Date.parse(v.publishedAt)) / 86400000;
    let hint: string | null = null;
    if (ratio !== null && ratio < 0.7 && ageDays > 2) hint = v.title.length > 70 ? "Título longo: teste uma versão mais curta e direta." : "Abaixo da média: teste uma nova thumbnail com mais contraste e um título com benefício claro.";
    else if (engAvg && engagement < engAvg * 0.6 && v.views > 100) hint = "Pouco engajamento: peça um comentário específico no início do vídeo.";
    else if (v.comments > 5 && ratio !== null && ratio >= 1.5) hint = "Está performando bem: responda os comentários para manter o embalo.";
    const status = ageDays < 2 ? "new" : ratio === null ? "avg" : ratio >= 1.2 ? "up" : ratio < 0.8 ? "down" : "avg";
    return { ...v, ratio, engagement, hint, status };
  });
}

function VideoCard({ v, i }: { v: Row; i: number }) {
  return (
    <article className="tx-vcard tx-rise" style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}>
      <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer" className="tx-vcard-thumb">
        <img src={v.thumbnail} alt="" loading="lazy" />
        {v.ratio !== null && <span className={`tx-vcard-badge is-${v.status}`}>{v.status === "down" ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}{v.ratio.toFixed(1).replace(".", ",")}x</span>}
        {v.status === "new" && <span className="tx-vcard-badge is-new">Novo</span>}
      </a>
      <div className="tx-vcard-body">
        <p className="tx-vcard-title" title={v.title}>{v.title}</p>
        <div className="tx-vcard-stats">
          <span title="Views"><Eye size={13} />{compact(v.views)}</span>
          <span title="Curtidas"><ThumbsUp size={13} />{compact(v.likes)}</span>
          <span title="Comentários"><MessageCircle size={13} />{compact(v.comments)}</span>
          <span className="ml-auto">{ago(v.publishedAt)}</span>
        </div>
        {v.hint && <div className="tx-vcard-hint"><Wrench size={13} /><span>{v.hint}</span></div>}
        <button onClick={() => askAI(`Quero melhorar meu vídeo "${v.title}" (${v.views} views, ${v.likes} curtidas, ${v.comments} comentários, publicado ${ago(v.publishedAt)}${v.ratio !== null ? `, ${v.ratio.toFixed(1)}x minha média` : ""}). Sugira 3 títulos melhores e ideias de thumbnail.`)} className="tx-vcard-ai"><Sparkles size={13} /> Melhorar com IA</button>
      </div>
    </article>
  );
}

export default function OptimizeView({ user, plan }: { user: any; plan: string }) {
  const { data, loading, error, reload } = useChannelData();
  const [tab, setTab] = useState<Tab>("videos");
  const [sort, setSort] = useState<Sort>("recent");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [connecting, setConnecting] = useState(false);
  const all = useMemo(() => analyse(data?.videos || []), [data]);
  const rows = useMemo(() => {
    const list = all.filter((v) => (tab === "shorts" ? v.isShort : !v.isShort));
    const sorted = [...list];
    if (sort === "views") sorted.sort((a, b) => b.views - a.views);
    if (sort === "ratio") sorted.sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0));
    if (sort === "engagement") sorted.sort((a, b) => b.engagement - a.engagement);
    return sorted;
  }, [all, tab, sort]);
  const improvable = rows.filter((r) => r.hint && r.status === "down").length;
  const above = rows.filter((r) => r.status === "up").length;

  const tabs: [Tab, string, number | null][] = [["videos", "Vídeos", all.filter((v) => !v.isShort).length], ["shorts", "Shorts", all.filter((v) => v.isShort).length], ["tips", "Dicas do canal", null], ["report", "Relatório completo", null]];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="tx-kicker">Otimizar</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Seus vídeos, <span className="tx-gold">um por um</span></h1><p className="mt-1 text-sm text-[var(--tx-muted)]">Compare cada vídeo com a sua própria média e veja o que pode melhorar.</p></div>
        {data && <button onClick={reload} className="tx-btn tx-btn-secondary"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Atualizar</button>}
      </header>

      <nav className="tx-tabs" role="tablist">
        {tabs.map(([id, label, count]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={tab === id ? "is-active" : ""}>{label}{count !== null && data && <span>{count}</span>}</button>)}
      </nav>

      {tab === "tips" && <IntelligenceCenter user={user} plan={plan} />}
      {tab === "report" && <FeedDashboard />}

      {(tab === "videos" || tab === "shorts") && <>
        {error?.needsGoogle && <section className="tx-surface rounded-2xl p-6"><h2 className="text-xl font-bold">Conecte o YouTube para ver seus vídeos</h2><p className="mt-1 text-sm text-[var(--tx-muted)]">Acesso somente leitura. A autorização expira de tempos em tempos.</p><button onClick={async () => { setConnecting(true); try { await connectYouTube(); } catch { setConnecting(false); } }} className="tx-btn tx-btn-primary mt-4">{connecting ? <Loader2 size={15} className="animate-spin" /> : <Youtube size={15} />} Conectar com Google</button></section>}
        {error && !error.needsGoogle && <div className="rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-4 text-sm">{error.message}</div>}
        {loading && !data && <div className="tx-vgrid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="tx-skeleton h-[260px]" />)}</div>}
        {data && <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-[13px]">
              <span className="tx-chip is-up">{above} acima da média</span>
              <span className="tx-chip is-down">{improvable} podem melhorar</span>
            </div>
            <div className="flex items-center gap-2">
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar" className="tx-select"><option value="recent">Mais recentes</option><option value="views">Mais views</option><option value="ratio">Melhor vs. média</option><option value="engagement">Mais engajamento</option></select>
              <div className="tx-seg"><button aria-label="Grade" className={layout === "grid" ? "is-active" : ""} onClick={() => setLayout("grid")}><LayoutGrid size={15} /></button><button aria-label="Lista" className={layout === "list" ? "is-active" : ""} onClick={() => setLayout("list")}><List size={15} /></button></div>
            </div>
          </div>
          {!rows.length ? <p className="rounded-xl bg-[var(--tx-surface-2)] p-5 text-sm text-[var(--tx-muted)]">Nenhum {tab === "shorts" ? "Short" : "vídeo"} encontrado nos últimos 50 envios.</p>
            : layout === "grid" ? <div className="tx-vgrid">{rows.map((v, i) => <VideoCard key={v.id} v={v} i={i} />)}</div>
            : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
                <thead><tr><th className="px-3 py-2.5">Vídeo</th><th className="px-3 text-right">Views</th><th className="px-3 text-right">vs. média</th><th className="px-3 text-right">Engajamento</th><th className="px-3">Publicado</th></tr></thead>
                <tbody>{rows.map((v) => <tr key={v.id} className="border-t border-[var(--tx-border)]">
                  <td className="px-3 py-2.5"><div className="flex items-center gap-3"><img src={v.thumbnail} alt="" className="h-12 w-20 shrink-0 rounded-lg object-cover" /><div className="min-w-0"><p className="line-clamp-2 font-medium">{v.title}</p>{v.hint && <p className="mt-0.5 line-clamp-1 text-xs text-[var(--tx-accent)]">{v.hint}</p>}</div></div></td>
                  <td className="px-3 text-right tabular-nums">{compact(v.views)}</td>
                  <td className={`px-3 text-right font-bold tabular-nums ${v.status === "up" ? "text-[var(--tx-green)]" : v.status === "down" ? "text-[var(--tx-red)]" : ""}`}>{v.ratio === null ? "—" : `${v.ratio.toFixed(1).replace(".", ",")}x`}</td>
                  <td className="px-3 text-right tabular-nums">{(v.engagement * 100).toFixed(1).replace(".", ",")}%</td>
                  <td className="whitespace-nowrap px-3 text-[var(--tx-muted)]">{ago(v.publishedAt)}</td>
                </tr>)}</tbody></table></div>}
          <p className="text-xs text-[var(--tx-muted)]">"x vezes a média" compara cada vídeo com a mediana dos 10 vídeos anteriores do mesmo formato. Views públicas da API do YouTube.</p>
        </>}
      </>}
    </div>
  );
}
