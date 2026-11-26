"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, ArrowDownRight, Sparkles, LayoutGrid, List, Loader2, MonitorPlay as Youtube, RefreshCw, ThumbsUp, MessageCircle, Eye, Wrench, X, Send, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
import { useChannelData, connectYouTube, baselineFor, compact, ago, fetchUnansweredMany, fetchUnanswered, replyToComment, YT_COMMENT_SCOPE_HINT, type YTVideo, type CommentState, type YTComment } from "@/lib/tubex-youtube";
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

function VideoCard({ v, i, pending, onComments }: { v: Row; i: number; pending?: CommentState | "loading"; onComments: () => void }) {
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
        <PendingButton pending={pending} hasComments={v.comments > 0} onClick={onComments} />
        {v.hint && <div className="tx-vcard-hint"><Wrench size={13} /><span>{v.hint}</span></div>}
        <button onClick={() => askAI(`Quero melhorar meu vídeo "${v.title}" (${v.views} views, ${v.likes} curtidas, ${v.comments} comentários, publicado ${ago(v.publishedAt)}${v.ratio !== null ? `, ${v.ratio.toFixed(1)}x minha média` : ""}). Sugira 3 títulos melhores e ideias de thumbnail.`)} className="tx-vcard-ai"><Sparkles size={13} /> Melhorar com IA</button>
      </div>
    </article>
  );
}


function PendingButton({ pending, hasComments, onClick }: { pending?: CommentState | "loading"; hasComments: boolean; onClick: () => void }) {
  if (!hasComments) return null;
  if (pending === "loading" || pending === undefined) return <span className="tx-vcard-pending is-loading"><Loader2 size={13} className="animate-spin" />Verificando comentários…</span>;
  if (pending.status === "disabled") return null;
  if (pending.status !== "ok") return null;
  const n = pending.items.length;
  if (!n) return <span className="tx-vcard-pending is-done"><CheckCircle2 size={13} />Comentários respondidos</span>;
  return <button type="button" onClick={onClick} className="tx-vcard-pending is-open"><MessageCircle size={13} /><b>{n >= 300 ? "300+" : n}</b> {n === 1 ? "comentário sem resposta" : "comentários sem resposta"}</button>;
}

function CommentsSheet({ video, channelId, onClose, onChange }: { video: Row; channelId: string; onClose: () => void; onChange: (s: CommentState) => void }) {
  const [state, setState] = useState<CommentState | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [needsAuth, setNeedsAuth] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { let alive = true; fetchUnanswered(video.id, channelId).then((s) => { if (alive) { setState(s); if (s.status === "auth") setNeedsAuth(true); } }); return () => { alive = false; }; }, [video.id, channelId]);
  const closeFn = useRef(onClose); closeFn.current = onClose;
  useEffect(() => { closeRef.current?.focus(); const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeFn.current(); }; window.addEventListener("keydown", onKey); const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; }; }, []);
  async function send(c: YTComment) {
    const text = (drafts[c.id] || "").trim(); if (!text) return;
    setSending(c.id); setErrors((x) => ({ ...x, [c.id]: "" }));
    try {
      await replyToComment(c.id, video.id, text);
      setState((s) => { if (!s) return s; const next = { ...s, items: s.items.filter((x) => x.id !== c.id) }; onChange(next); return next; });
    } catch (e: any) {
      if (e?.needsGoogle) setNeedsAuth(true);
      setErrors((x) => ({ ...x, [c.id]: e?.message || "Não foi possível responder." }));
    } finally { setSending(null); }
  }
  const items = state?.items || [];
  return createPortal(
    <div className="tx-saas-shell tx-sheet-wrap" role="dialog" aria-modal="true" aria-label={`Comentários de ${video.title}`}>
      <button className="tx-sheet-scrim" aria-label="Fechar" onClick={onClose} />
      <section className="tx-sheet">
        <header className="tx-sheet-head">
          <img src={video.thumbnail} alt="" />
          <div className="min-w-0 flex-1"><p className="tx-kicker">Comentários sem resposta</p><h2 className="line-clamp-2 text-[15px] font-bold leading-snug">{video.title}</h2></div>
          <button ref={closeRef} onClick={onClose} className="tx-sheet-close" aria-label="Fechar"><X size={18} /></button>
        </header>
        <div className="tx-sheet-body">
          {needsAuth && <div className="tx-sheet-alert"><AlertCircle size={16} /><div><p>{YT_COMMENT_SCOPE_HINT}</p><button onClick={() => { void connectYouTube().catch(() => {}); }} className="tx-btn tx-btn-primary mt-3 px-4 py-2 text-xs">Reconectar YouTube</button></div></div>}
          {!state && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="tx-skeleton h-[96px]" />)}</div>}
          {state && state.status === "ok" && !items.length && <div className="py-10 text-center"><CheckCircle2 className="mx-auto text-[var(--tx-green)]" size={30} /><p className="mt-3 font-bold">Tudo respondido neste vídeo</p></div>}
          {state && (state.status === "quota" || state.status === "error") && <div className="tx-sheet-alert"><AlertCircle size={16} /><p>{state.status === "quota" ? "O limite diário da API do YouTube foi atingido. Tente mais tarde." : `Não foi possível ler os comentários (${state.detail || "erro desconhecido"}).`}</p></div>}
          {state?.status === "disabled" && <p className="py-8 text-center text-sm text-[var(--tx-muted)]">Os comentários estão desativados neste vídeo.</p>}
          {items.map((c, i) => (
            <article key={c.id} className="tx-comment tx-rise" style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
              <div className="flex items-start gap-3">
                {c.authorImage ? <img src={c.authorImage} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--tx-surface-2)] text-sm font-bold">{c.author.replace(/^@/, "").slice(0, 1).toUpperCase()}</span>}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]"><b className="truncate">{c.author}</b><span className="text-xs text-[var(--tx-muted)]">{ago(c.publishedAt)}</span>{c.likes > 0 && <span className="inline-flex items-center gap-1 text-xs text-[var(--tx-muted)]"><ThumbsUp size={11} />{c.likes}</span>}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed">{c.text}</p>
                  <div className="tx-comment-reply">
                    <textarea rows={1} value={drafts[c.id] || ""} onChange={(e) => { setDrafts((d) => ({ ...d, [c.id]: e.target.value })); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`; }} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(c); } }} placeholder="Escreva sua resposta…" aria-label={`Responder ${c.author}`} />
                    <button onClick={() => send(c)} disabled={!((drafts[c.id] || "").trim()) || sending === c.id} aria-label="Enviar resposta">{sending === c.id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}</button>
                  </div>
                  {errors[c.id] && <p className="mt-1.5 text-xs text-[var(--tx-red)]">{errors[c.id]}</p>}
                </div>
              </div>
            </article>
          ))}
        </div>
        <footer className="tx-sheet-foot"><a href={`https://studio.youtube.com/video/${video.id}/comments`} target="_blank" rel="noreferrer">Abrir no YouTube Studio <ExternalLink size={13} /></a><span>A resposta é publicada pelo seu canal.</span></footer>
      </section>
    </div>,
    document.body,
  );
}

export default function OptimizeView({ user, plan }: { user: any; plan: string }) {
  const { data, loading, error, reload } = useChannelData();
  const [tab, setTab] = useState<Tab>("videos");
  const [sort, setSort] = useState<Sort>("recent");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [connecting, setConnecting] = useState(false);
  const all = useMemo(() => analyse(data?.videos || []), [data]);
  const [pending, setPending] = useState<Record<string, CommentState | "loading">>({});
  const [commentsAuth, setCommentsAuth] = useState(false);
  const [openVideo, setOpenVideo] = useState<Row | null>(null);
  useEffect(() => {
    if (!data) return;
    const ids = data.videos.filter((v) => v.comments > 0).map((v) => v.id);
    setPending(Object.fromEntries(ids.map((id) => [id, "loading" as const])));
    setCommentsAuth(false);
    let alive = true;
    void fetchUnansweredMany(ids, data.channel.id, (id, st) => {
      if (!alive) return;
      if (st.status === "auth") setCommentsAuth(true);
      setPending((p) => ({ ...p, [id]: st }));
    }).then(() => { if (alive) setPending((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v === "loading" ? { status: "error", items: [] } as CommentState : v]))); });
    return () => { alive = false; };
  }, [data]);
  const totalPending = Object.values(pending).reduce((a, v) => a + (v !== "loading" && v.status === "ok" ? v.items.length : 0), 0);
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
              {totalPending > 0 && <span className="tx-chip is-comments"><MessageCircle size={13} />{totalPending} comentários sem resposta</span>}
            </div>
            <div className="flex items-center gap-2">
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar" className="tx-select"><option value="recent">Mais recentes</option><option value="views">Mais views</option><option value="ratio">Melhor vs. média</option><option value="engagement">Mais engajamento</option></select>
              <div className="tx-seg"><button aria-label="Grade" className={layout === "grid" ? "is-active" : ""} onClick={() => setLayout("grid")}><LayoutGrid size={15} /></button><button aria-label="Lista" className={layout === "list" ? "is-active" : ""} onClick={() => setLayout("list")}><List size={15} /></button></div>
            </div>
          </div>
          {commentsAuth && <div className="tx-comments-auth"><AlertCircle size={17} /><p>{YT_COMMENT_SCOPE_HINT}</p><button onClick={() => { void connectYouTube().catch(() => {}); }} className="tx-btn tx-btn-primary px-4 py-2 text-xs">Reconectar YouTube</button></div>}
          {!rows.length ? <p className="rounded-xl bg-[var(--tx-surface-2)] p-5 text-sm text-[var(--tx-muted)]">Nenhum {tab === "shorts" ? "Short" : "vídeo"} encontrado nos últimos 50 envios.</p>
            : layout === "grid" ? <div className="tx-vgrid">{rows.map((v, i) => <VideoCard key={v.id} v={v} i={i} pending={pending[v.id]} onComments={() => setOpenVideo(v)} />)}</div>
            : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
                <thead><tr><th className="px-3 py-2.5">Vídeo</th><th className="px-3 text-right">Views</th><th className="px-3 text-right">vs. média</th><th className="px-3 text-right">Engajamento</th><th className="px-3">Publicado</th></tr></thead>
                <tbody>{rows.map((v) => <tr key={v.id} className="border-t border-[var(--tx-border)]">
                  <td className="px-3 py-2.5"><div className="flex items-center gap-3"><img src={v.thumbnail} alt="" className="h-12 w-20 shrink-0 rounded-lg object-cover" /><div className="min-w-0"><p className="line-clamp-2 font-medium">{v.title}</p>{v.hint && <p className="mt-0.5 line-clamp-1 text-xs text-[var(--tx-accent)]">{v.hint}</p>}{(() => { const st = pending[v.id]; return st && st !== "loading" && st.status === "ok" && st.items.length ? <button onClick={() => setOpenVideo(v)} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[var(--tx-gold,#f2c94c)]"><MessageCircle size={12} />{st.items.length} sem resposta</button> : null; })()}</div></div></td>
                  <td className="px-3 text-right tabular-nums">{compact(v.views)}</td>
                  <td className={`px-3 text-right font-bold tabular-nums ${v.status === "up" ? "text-[var(--tx-green)]" : v.status === "down" ? "text-[var(--tx-red)]" : ""}`}>{v.ratio === null ? "—" : `${v.ratio.toFixed(1).replace(".", ",")}x`}</td>
                  <td className="px-3 text-right tabular-nums">{(v.engagement * 100).toFixed(1).replace(".", ",")}%</td>
                  <td className="whitespace-nowrap px-3 text-[var(--tx-muted)]">{ago(v.publishedAt)}</td>
                </tr>)}</tbody></table></div>}
          {openVideo && data && <CommentsSheet video={openVideo} channelId={data.channel.id} onClose={() => setOpenVideo(null)} onChange={(st) => setPending((p) => ({ ...p, [openVideo.id]: st }))} />}
          <p className="text-xs text-[var(--tx-muted)]">"x vezes a média" compara cada vídeo com a mediana dos 10 vídeos anteriores do mesmo formato. Views públicas da API do YouTube.</p>
        </>}
      </>}
    </div>
  );
}
