"use client";
import { useMemo, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Sparkles, Search, Trophy, RefreshCw, MonitorPlay as Youtube, Lightbulb, Clock3, TrendingUp, PlayCircle, ChevronRight, Loader2 } from "lucide-react";
import { useChannelData, connectYouTube, baselineFor, nextMilestone, compact, ago, type YTVideo } from "@/lib/tubex-youtube";

const nf = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v || 0));
const go = (tab: string) => window.dispatchEvent(new CustomEvent("tubex-navigate-tab", { detail: tab }));
const askAI = (prompt: string) => { try { sessionStorage.setItem("tubex-ai-prefill", prompt); } catch {} go("ai"); };

function MilestoneCard({ label, value, spark }: { label: string; value: number; spark?: number[] }) {
  const m = nextMilestone(value);
  return (
    <div className="tx-home-metric">
      <div className="flex items-center justify-between"><span className="tx-home-label">{label}</span>{spark && spark.length > 1 && <Spark values={spark} />}</div>
      <p className="tx-home-big">{nf(value)}</p>
      <div className="tx-home-progress"><span style={{ width: `${Math.max(3, Math.min(100, m.progress * 100))}%` }} /></div>
      <div className="mt-1.5 flex justify-between text-[12px] text-[var(--tx-muted)]"><span>{compact(m.prev)}</span><span>Próximo marco: <b className="text-[var(--tx-text)]">{compact(m.next)}</b></span></div>
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  const w = 90, h = 28, min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><polyline points={pts} fill="none" stroke={up ? "var(--tx-green)" : "var(--tx-red)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function PerformanceChart({ videos }: { videos: YTVideo[] }) {
  const rows = videos.slice(0, 12).reverse();
  const [hover, setHover] = useState<number | null>(null);
  if (rows.length < 2) return <p className="text-sm text-[var(--tx-muted)]">Publique mais vídeos para ver a comparação.</p>;
  const W = 640, H = 200, pad = 28;
  const max = Math.max(1, ...rows.map((r) => r.views));
  const avg = rows.reduce((s, r) => s + r.views, 0) / rows.length;
  const slot = (W - pad) / rows.length, bw = Math.min(34, slot * 0.6);
  const y = (v: number) => H - 22 - (v / max) * (H - 40);
  const cur = hover !== null ? rows[hover] : null;
  return (
    <div>
      <div className="mb-2 flex min-h-[22px] flex-wrap items-center justify-between gap-2 text-[13px]">
        {cur ? <span className="truncate"><b>{cur.title}</b> · {nf(cur.views)} views · {ago(cur.publishedAt)}</span> : <span className="text-[var(--tx-muted)]">Passe o mouse nas barras para ver cada vídeo</span>}
        <span className="flex items-center gap-1.5 text-[var(--tx-muted)]"><i className="inline-block h-0.5 w-4 bg-[var(--tx-accent)]" />média {compact(avg)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="tx-home-chart block h-auto w-full" onMouseLeave={() => setHover(null)} role="img" aria-label="Views dos últimos vídeos">
        <defs><linearGradient id="txbar" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--tx-blue)" /><stop offset="1" stopColor="var(--tx-blue)" stopOpacity=".35" /></linearGradient></defs>
        {[0, .5, 1].map((t) => <line key={t} x1={pad} x2={W} y1={y(max * t)} y2={y(max * t)} stroke="currentColor" opacity=".08" />)}
        {rows.map((r, i) => {
          const x = pad + i * slot + (slot - bw) / 2, top = y(r.views);
          return <g key={r.id} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
            <rect x={pad + i * slot} y={0} width={slot} height={H} fill="transparent" />
            <rect className="tx-home-bar" style={{ animationDelay: `${i * 50}ms` }} x={x} y={top} width={bw} height={H - 22 - top} rx="6" fill={r.views >= avg ? "url(#txbar)" : "color-mix(in srgb, var(--tx-blue) 30%, transparent)"} opacity={hover === null || hover === i ? 1 : .45} />
          </g>;
        })}
        <line x1={pad} x2={W} y1={y(avg)} y2={y(avg)} stroke="var(--tx-accent)" strokeDasharray="5 5" strokeWidth="1.5" />
        <text x={2} y={y(max) + 4} fontSize="11" fill="currentColor" opacity=".5">{compact(max)}</text>
        <text x={2} y={H - 18} fontSize="11" fill="currentColor" opacity=".5">0</text>
      </svg>
    </div>
  );
}

export default function ChannelHome({ achievementSummary, displayName }: { achievementSummary: any; displayName: string }) {
  const { data, loading, error, reload } = useChannelData();
  const [connecting, setConnecting] = useState(false);
  const profile = achievementSummary?.profile;
  const history: any[] = achievementSummary?.history || [];
  const subsSpark = history.slice(0, 14).reverse().map((h) => Number(h.subscriber_count)).filter(Number.isFinite);
  const viewsSpark = history.slice(0, 14).reverse().map((h) => Number(h.total_views)).filter(Number.isFinite);
  const channel = data?.channel;
  const subs = channel?.subscribers ?? Number(profile?.subscriber_count || 0);
  const views = channel?.views ?? Number(profile?.total_views || 0);
  const name = channel?.title || profile?.channel_title || "";
  const thumb = channel?.thumbnail || profile?.channel_thumbnail || "";
  const videos = data?.videos || [];
  const latest = videos[0];
  const base = latest ? baselineFor(videos, 0) : 0;
  const ratio = latest && base ? latest.views / base : null;
  const nextAch = (achievementSummary?.achievements || []).filter((a: any) => !a.unlocked).sort((a: any, b: any) => Number(b.progress || 0) - Number(a.progress || 0))[0];
  const unlocked = (achievementSummary?.achievements || []).filter((a: any) => a.unlocked).length;

  const suggestions = useMemo(() => {
    const list: { icon: any; title: string; text: string; cta: string; action: () => void }[] = [];
    if (!videos.length) return list;
    const daysSince = (Date.now() - Date.parse(videos[0].publishedAt)) / 86400000;
    const recent = videos.filter((v) => Date.now() - Date.parse(v.publishedAt) < 60 * 86400000);
    const perWeek = recent.length / (60 / 7);
    if (daysSince > 7) list.push({ icon: Clock3, title: `${Math.round(daysSince)} dias sem publicar`, text: "Canais que publicam com regularidade são mais recomendados. Que tal planejar o próximo vídeo hoje?", cta: "Encontrar ideia", action: () => go("research:ideas") });
    else list.push({ icon: Clock3, title: `Ritmo de ${perWeek.toFixed(1).replace(".", ",")} vídeo(s) por semana`, text: "Bom ritmo. Mantenha a constância e use os dados para escolher temas que já funcionam.", cta: "Ver vídeos", action: () => go("optimize") });
    const best = [...videos.slice(0, 20)].sort((a, b) => b.views - a.views)[0];
    if (best) list.push({ icon: TrendingUp, title: "Repita o que deu certo", text: `"${best.title.slice(0, 70)}" é seu melhor vídeo recente (${compact(best.views)} views). Explore variações desse tema.`, cta: "Pedir ideias à IA", action: () => askAI(`Meu vídeo "${best.title}" teve ${best.views} views, o melhor dos recentes. Sugira 5 variações de tema e título para repetir esse resultado.`) });
    const shorts = videos.filter((v) => v.isShort).slice(0, 10), longs = videos.filter((v) => !v.isShort).slice(0, 10);
    const avg = (a: YTVideo[]) => a.length ? a.reduce((s, v) => s + v.views, 0) / a.length : 0;
    if (shorts.length >= 2 && longs.length >= 2) {
      const s = avg(shorts), l = avg(longs);
      list.push({ icon: PlayCircle, title: s > l ? "Shorts estão puxando mais views" : "Vídeos longos rendem mais", text: `Média recente: Shorts ${compact(s)} · longos ${compact(l)} views. Equilibre o formato que traz mais resultado.`, cta: "Comparar vídeos", action: () => go("optimize") });
    } else list.push({ icon: Search, title: "Pesquise antes de gravar", text: "Descubra palavras-chave com busca alta e pouca concorrência para o seu próximo título.", cta: "Pesquisar palavras-chave", action: () => go("research") });
    return list;
  }, [videos]);

  const needsConnect = !channel && !profile && !loading;
  // Sessão única: abre o aviso de login do site (não há mais "reconectar Google" separado).
  async function connect() { await connectYouTube(); }

  return (
    <div className="tx-home space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {thumb ? <img src={thumb} alt="" className="h-12 w-12 shrink-0 rounded-full border border-[var(--tx-border)] object-cover" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--tx-surface-2)] text-[var(--tx-red)]"><Youtube size={22} /></span>}
          <div className="min-w-0">
            <p className="tx-kicker">Início</p>
            <h1 className="truncate text-2xl font-extrabold sm:text-3xl">{name ? <>Olá, <span className="tx-gold">{displayName.split(" ")[0]}</span></> : "Bem-vindo ao TubeX"}</h1>
            {name && <p className="mt-0.5 flex items-center gap-2 text-sm text-[var(--tx-muted)]"><span className="tx-dot-green" />{name}</p>}
          </div>
        </div>
        {channel && <button onClick={reload} className="tx-btn tx-btn-secondary"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Atualizar</button>}
      </header>

      {(needsConnect || (error?.needsGoogle && !profile)) && (
        <section className="tx-surface tx-home-connect rounded-2xl p-6 sm:p-8">
          <div className="max-w-xl">
            <p className="tx-kicker">Primeiro passo</p>
            <h2 className="mt-2 text-2xl font-extrabold">Conecte seu canal do <span className="tx-gold">YouTube</span></h2>
            <p className="mt-2 text-[15px] leading-7 text-[var(--tx-muted)]">Com o canal conectado, o Início mostra suas métricas, o desempenho de cada vídeo e sugestões do que fazer a seguir. Entre com o Google no TubeX uma vez; depois o acesso é renovado sozinho.</p>
            <button onClick={connect} disabled={connecting} className="tx-btn tx-btn-primary mt-5">{connecting ? <Loader2 size={16} className="animate-spin" /> : <Youtube size={16} />} Entrar com Google</button>
          </div>
        </section>
      )}

      {(channel || profile) && (
        <div className="grid gap-4 md:grid-cols-2">
          <MilestoneCard label="Inscritos" value={subs} spark={subsSpark} />
          <MilestoneCard label="Visualizações" value={views} spark={viewsSpark} />
        </div>
      )}

      {error && !error.needsGoogle && <div className="rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-4 text-sm">{error.message} <button onClick={reload} className="ml-2 font-bold text-[var(--tx-blue)]">Tentar de novo</button></div>}
      {error?.needsGoogle && profile && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-4 text-sm"><span>Não conseguimos ler seu canal agora. Se continuar, entre novamente no TubeX.</span><button onClick={connect} className="tx-btn tx-btn-primary">{connecting ? <Loader2 size={14} className="animate-spin" /> : <Youtube size={14} />} Entrar novamente</button></div>}

      {loading && !data && !needsConnect && <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]"><div className="tx-skeleton h-56" /><div className="tx-skeleton h-56" /></div>}

      {latest && (
        <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <section className="tx-surface rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-bold"><span className="tx-dot-blue" />Último vídeo</h2><span className="text-[13px] text-[var(--tx-muted)]">{ago(latest.publishedAt)}</span></div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,240px)_1fr]">
              <a href={`https://www.youtube.com/watch?v=${latest.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-[var(--tx-border)]"><img src={latest.thumbnail} alt="" className="aspect-video w-full object-cover" /></a>
              <div className="min-w-0">
                <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{latest.title}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="tx-home-stat"><span>Views</span><b>{compact(latest.views)}</b></div>
                  <div className="tx-home-stat"><span>Curtidas</span><b>{compact(latest.likes)}</b></div>
                  <div className="tx-home-stat"><span>vs. média</span><b className={ratio === null ? "" : ratio >= 1 ? "text-[var(--tx-green)]" : "text-[var(--tx-red)]"}>{ratio === null ? "—" : `${ratio.toFixed(1).replace(".", ",")}x`}</b></div>
                </div>
                {ratio !== null && <div className="mt-4">
                  <div className="tx-home-gauge"><span style={{ left: `${Math.min(97, Math.max(3, (Math.log2(ratio) + 2) / 4 * 100))}%` }} /></div>
                  <div className="mt-1.5 flex justify-between text-[12px] text-[var(--tx-muted)]"><span>Abaixo</span><span>Na média</span><span className={ratio >= 1.2 ? "font-bold text-[var(--tx-green)]" : ""}>Acima</span></div>
                </div>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => askAI(`Analise o desempenho do meu último vídeo "${latest.title}": ${latest.views} views, ${latest.likes} curtidas, ${latest.comments} comentários, publicado ${ago(latest.publishedAt)}. A mediana dos meus vídeos anteriores é ${Math.round(base)} views. O que posso melhorar no título, thumbnail e próximos vídeos?`)} className="tx-btn tx-btn-primary"><Sparkles size={14} /> Analisar com IA</button>
                  <button onClick={() => go("optimize")} className="tx-btn tx-btn-secondary">Todos os vídeos <ChevronRight size={14} /></button>
                </div>
              </div>
            </div>
          </section>
          <section className="tx-surface rounded-2xl p-5">
            <h2 className="mb-3 text-lg font-bold">Desempenho dos últimos vídeos</h2>
            <PerformanceChart videos={videos} />
          </section>
        </div>
      )}

      {suggestions.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Lightbulb size={18} className="text-[var(--tx-accent)]" />Sugestões para agora</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {suggestions.map((s) => { const Icon = s.icon; return (
              <div key={s.title} className="tx-surface flex flex-col rounded-2xl p-5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--tx-blue-soft)] text-[var(--tx-blue)]"><Icon size={17} /></span>
                <p className="mt-3 font-semibold">{s.title}</p>
                <p className="mt-1 flex-1 text-[13.5px] leading-6 text-[var(--tx-muted)]">{s.text}</p>
                <button onClick={s.action} className="mt-3 inline-flex items-center gap-1 self-start text-[13.5px] font-bold text-[var(--tx-blue)]">{s.cta}<ArrowUpRight size={14} /></button>
              </div>
            ); })}
          </div>
        </section>
      )}

      {(achievementSummary?.achievements || []).length > 0 && (
        <button onClick={() => go("achievements")} className="tx-surface group flex w-full items-center gap-4 rounded-2xl p-5 text-left">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--tx-accent-soft)] text-[var(--tx-accent)]"><Trophy size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-[var(--tx-muted)]">Conquistas · {unlocked} de {achievementSummary.achievements.length}</p>
            <p className="truncate font-semibold">{nextAch ? `Próxima: ${nextAch.title}` : "Todas as conquistas desbloqueadas"}</p>
            {nextAch && <div className="tx-home-progress mt-2"><span style={{ width: `${Math.min(100, Math.max(3, Number(nextAch.progress || 0)))}%` }} /></div>}
          </div>
          <ChevronRight size={18} className="text-[var(--tx-muted)] transition group-hover:translate-x-0.5" />
        </button>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[["ai", Sparkles, "Perguntar à IA", "Tire dúvidas sobre o seu canal"], ["research", Search, "Pesquisar", "Palavras-chave e ideias de vídeo"], ["optimize", TrendingUp, "Otimizar", "Veja quais vídeos performam melhor"]].map(([id, Icon, t, d]: any) => (
          <button key={id} onClick={() => go(id)} className="tx-home-shortcut"><Icon size={18} /><span><b>{t}</b><small>{d}</small></span><ArrowUpRight size={15} className="ml-auto opacity-50" /></button>
        ))}
      </div>
    </div>
  );
}

export { ArrowDownRight };
