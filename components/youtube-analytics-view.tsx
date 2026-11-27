"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3, Eye, Clock3, Timer, Percent, UserPlus, MousePointerClick, ImageIcon, Wallet, RefreshCw, Loader2, ShieldCheck,
  ShieldAlert, MessageSquare, CheckCircle2, XCircle, AlertTriangle, X, Search, Globe2, MonitorSmartphone, Users, PlayCircle,
  ArrowUpRight, ArrowDownRight, Sparkles, ThumbsUp, Share2,
} from "lucide-react";
import { useChannelData, connectYouTube } from "@/lib/tubex-youtube";
import { getGoogleAccessToken, getGoogleScopes } from "@/lib/tubex-google-token-client";
import {
  fetchChannelAnalytics, fetchVideoAnalytics, checkCommentsAccess, fmtDuration, YT_SCOPE, AGE_LABELS, GENDER_LABELS,
  summarizeChannelAnalytics, summarizeVideoAnalytics,
  type ChannelAnalytics, type VideoAnalytics, type GoogleScopes, type CommentsCheck, type Section, type Slice, type DailyPoint,
  type TopVideo, type RetentionPoint, type DemographicRow,
} from "@/lib/tubex-yt-analytics";
import "./tubex-yt-analytics.css";

const nf = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v || 0));
const cf = (v: number) => new Intl.NumberFormat("pt-BR", { notation: Math.abs(v) >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(v || 0);
const pf = (v: number, d = 1) => `${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const hours = (min: number) => `${cf(min / 60)} h`;
const dayLabel = (d: string) => { const t = new Date(`${d}T12:00:00`); return t.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""); };
const askAI = (prompt: string) => { try { sessionStorage.setItem("tubex-ai-prefill", prompt); } catch {} window.dispatchEvent(new CustomEvent("tubex-navigate-tab", { detail: "ai" })); };

const RANGES: [number, string][] = [[7, "7 dias"], [28, "28 dias"], [90, "90 dias"], [365, "12 meses"]];
type Metric = "views" | "hours" | "subs";

/* --------------------------------- peças --------------------------------- */

function delta(cur: number, prev?: number) {
  if (prev === undefined || !Number.isFinite(prev) || prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

function Kpi({ icon: Icon, label, value, change, hint, gold, locked, delay = 0 }: { icon: any; label: string; value: string; change?: number | null; hint?: string; gold?: boolean; locked?: string; delay?: number }) {
  return (
    <div className={`tx-ya-kpi ${gold ? "is-gold" : ""} ${locked ? "is-locked" : ""}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="tx-ya-kpi-head"><span className="tx-ya-kpi-icon"><Icon size={15} /></span><span className="tx-ya-kpi-label">{label}</span></div>
      <p className="tx-ya-kpi-value">{locked ? "—" : value}</p>
      <div className="tx-ya-kpi-foot">
        {locked ? <span className="tx-ya-muted">{locked}</span> : <>
          {change !== null && change !== undefined && <span className={`tx-ya-delta ${change >= 0 ? "is-up" : "is-down"}`}>{change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{pf(Math.abs(change), Math.abs(change) >= 100 ? 0 : 1)}</span>}
          {hint && <span className="tx-ya-muted">{hint}</span>}
        </>}
      </div>
    </div>
  );
}

function TrendChart({ points, metric }: { points: DailyPoint[]; metric: Metric }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = points.map((p) => metric === "views" ? p.views : metric === "hours" ? p.minutesWatched / 60 : p.subscribersGained - p.subscribersLost);
  if (points.length < 2) return <p className="tx-ya-empty">Ainda não há dados diários suficientes neste período.</p>;
  const W = 720, H = 220, padL = 6, padB = 26, padT = 14;
  const max = Math.max(...values, 0), min = Math.min(...values, 0), span = max - min || 1;
  const x = (i: number) => padL + (i / (points.length - 1)) * (W - padL * 2);
  const y = (v: number) => padT + (1 - (v - min) / span) * (H - padT - padB);
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${x(0)},${y(Math.max(min, 0))} ${line} ${x(points.length - 1)},${y(Math.max(min, 0))}`;
  const ticks = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const fmt = (v: number) => metric === "hours" ? `${cf(v)} h` : metric === "subs" ? `${v >= 0 ? "+" : ""}${nf(v)}` : nf(v);
  const cur = hover !== null ? hover : null;
  return (
    <div className="tx-ya-chart">
      <div className="tx-ya-chart-tip">{cur !== null ? <><b>{fmt(values[cur])}</b><span>{dayLabel(points[cur].day)}</span></> : <span className="tx-ya-muted">Toque ou passe o mouse no gráfico</span>}</div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="tx-ya-svg" role="img" aria-label="Evolução diária"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); const i = Math.round(((e.clientX - r.left) / r.width) * (points.length - 1)); setHover(Math.max(0, Math.min(points.length - 1, i))); }}
        onTouchMove={(e) => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); const i = Math.round(((e.touches[0].clientX - r.left) / r.width) * (points.length - 1)); setHover(Math.max(0, Math.min(points.length - 1, i))); }}>
        <defs><linearGradient id="tx-ya-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--tx-accent)" stopOpacity=".32" /><stop offset="1" stopColor="var(--tx-accent)" stopOpacity="0" /></linearGradient></defs>
        {[0, .5, 1].map((t) => <line key={t} x1={0} x2={W} y1={padT + t * (H - padT - padB)} y2={padT + t * (H - padT - padB)} stroke="currentColor" opacity=".07" vectorEffect="non-scaling-stroke" />)}
        <polygon points={area} fill="url(#tx-ya-area)" className="tx-ya-area" />
        <polyline points={line} fill="none" stroke="var(--tx-accent)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="tx-ya-line" />
        {cur !== null && <><line x1={x(cur)} x2={x(cur)} y1={padT} y2={H - padB} stroke="var(--tx-accent)" opacity=".35" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" /><circle cx={x(cur)} cy={y(values[cur])} r="4.5" fill="var(--tx-accent)" stroke="var(--tx-surface)" strokeWidth="2" vectorEffect="non-scaling-stroke" /></>}
      </svg>
      <div className="tx-ya-axis">{ticks.map((i) => <span key={i}>{dayLabel(points[i].day)}</span>)}</div>
    </div>
  );
}

function BarList({ items, max = 7, showMinutes, onPick }: { items: Slice[]; max?: number; showMinutes?: boolean; onPick?: (s: Slice) => void }) {
  if (!items.length) return <p className="tx-ya-empty">Sem dados neste período.</p>;
  const top = items.slice(0, max);
  const peak = Math.max(...top.map((i) => i.share), 0.0001);
  return (
    <ul className="tx-ya-bars">
      {top.map((s, i) => (
        <li key={s.key} style={{ animationDelay: `${i * 45}ms` }} onClick={onPick ? () => onPick(s) : undefined} className={onPick ? "is-click" : ""}>
          <div className="tx-ya-bar-row"><span className="tx-ya-bar-label">{s.label}</span><span className="tx-ya-bar-val">{pf(s.share * 100)} <em>· {cf(s.value)}{showMinutes && s.minutes !== undefined ? ` · ${hours(s.minutes)}` : ""}</em></span></div>
          <div className="tx-ya-bar-track"><span style={{ width: `${Math.max(2, (s.share / peak) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

function Demographics({ rows }: { rows: DemographicRow[] }) {
  if (!rows.length) return <p className="tx-ya-empty">O YouTube só mostra idade e gênero quando há público suficiente.</p>;
  const ages = new Map<string, number>(); const genders = new Map<string, number>();
  for (const r of rows) { ages.set(r.ageGroup, (ages.get(r.ageGroup) || 0) + r.percentage); genders.set(r.gender, (genders.get(r.gender) || 0) + r.percentage); }
  const ageList = Object.keys(AGE_LABELS).map((k) => ({ key: k, v: ages.get(k) || 0 }));
  const peak = Math.max(...ageList.map((a) => a.v), 1);
  const g = [...genders].sort((a, b) => b[1] - a[1]);
  return (
    <div className="tx-ya-demo">
      <div className="tx-ya-ages">{ageList.map((a, i) => (
        <div key={a.key} className="tx-ya-age"><span className="tx-ya-age-col"><i style={{ height: `${Math.max(3, (a.v / peak) * 100)}%`, animationDelay: `${i * 50}ms` }} /></span><b>{pf(a.v, 0)}</b><small>{AGE_LABELS[a.key]}</small></div>
      ))}</div>
      <div className="tx-ya-gender">
        <div className="tx-ya-gender-bar">{g.map(([k, v]) => <span key={k} className={`is-${k}`} style={{ width: `${v}%` }} title={`${GENDER_LABELS[k] || k} ${pf(v)}`} />)}</div>
        <div className="tx-ya-gender-legend">{g.map(([k, v]) => <span key={k}><i className={`is-${k}`} />{GENDER_LABELS[k] || k} <b>{pf(v)}</b></span>)}</div>
      </div>
    </div>
  );
}

function RetentionChart({ points, durationSeconds }: { points: RetentionPoint[]; durationSeconds: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 3) return <p className="tx-ya-empty">Retenção indisponível (o vídeo precisa de mais visualizações).</p>;
  const W = 640, H = 180, pad = 12;
  const maxV = Math.max(1, ...points.map((p) => p.watchRatio));
  const x = (r: number) => pad + r * (W - pad * 2);
  const y = (v: number) => pad + (1 - v / maxV) * (H - pad * 2);
  const line = points.map((p) => `${x(p.ratio)},${y(p.watchRatio)}`).join(" ");
  const cur = hover !== null ? points[hover] : null;
  return (
    <div className="tx-ya-chart">
      <div className="tx-ya-chart-tip">{cur ? <><b>{pf(cur.watchRatio * 100, 0)} ainda assistindo</b><span>em {fmtDuration(cur.ratio * durationSeconds)} · {cur.relative > 0.55 ? "acima" : cur.relative < 0.45 ? "abaixo" : "na média"} de vídeos parecidos</span></> : <span className="tx-ya-muted">Curva de retenção ao longo do vídeo</span>}</div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="tx-ya-svg is-short" onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); const ratio = (e.clientX - r.left) / r.width; let best = 0; points.forEach((p, i) => { if (Math.abs(p.ratio - ratio) < Math.abs(points[best].ratio - ratio)) best = i; }); setHover(best); }}>
        <defs><linearGradient id="tx-ya-ret" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--tx-blue)" stopOpacity=".35" /><stop offset="1" stopColor="var(--tx-blue)" stopOpacity="0" /></linearGradient></defs>
        <line x1={0} x2={W} y1={y(Math.min(1, maxV))} y2={y(Math.min(1, maxV))} stroke="currentColor" opacity=".08" vectorEffect="non-scaling-stroke" />
        <polygon points={`${x(points[0].ratio)},${H - pad} ${line} ${x(points[points.length - 1].ratio)},${H - pad}`} fill="url(#tx-ya-ret)" />
        <polyline points={line} fill="none" stroke="var(--tx-blue)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" className="tx-ya-line" />
        {cur && <circle cx={x(cur.ratio)} cy={y(cur.watchRatio)} r="4.5" fill="var(--tx-accent)" stroke="var(--tx-surface)" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="tx-ya-axis"><span>0:00</span><span>{fmtDuration(durationSeconds / 2)}</span><span>{fmtDuration(durationSeconds)}</span></div>
    </div>
  );
}

function Card({ title, icon: Icon, children, action, className = "" }: { title: string; icon: any; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return <section className={`tx-ya-card ${className}`}><header><h3><Icon size={16} />{title}</h3>{action}</header>{children}</section>;
}

function SectionError<T>({ s, what }: { s: Section<T>; what: string }) {
  if (s.ok) return null;
  const msg = s.error === "scope" ? "Falta permissão do Google." : s.error === "unsupported" ? "O YouTube não libera este dado para o canal." : s.error === "quota" ? "Limite diário da API atingido; tente mais tarde." : s.error === "expired" ? "Conexão expirada; reconecte." : s.message;
  return <p className="tx-ya-empty">{what}: {msg}</p>;
}

/* ------------------------------ diagnóstico ------------------------------ */

function ConnectionStatus({ scopes, comments, onConnect, connecting }: { scopes: GoogleScopes | null; comments: CommentsCheck | null; onConnect: (extra?: string[]) => void; connecting: boolean }) {
  const items: [string, boolean, string][] = [
    ["Dados do canal", !!scopes?.readonly, "Vídeos, views e inscritos"],
    ["YouTube Analytics", !!scopes?.analytics, "CTR, retenção, tráfego e público"],
    ["Comentários", !!scopes?.forceSsl, "Ler e responder comentários"],
    ["Receita", !!scopes?.monetary, "Opcional · canais monetizados"],
  ];
  const commentLine = !comments ? <span className="tx-ya-muted"><Loader2 size={13} className="animate-spin" /> testando…</span>
    : comments.status === "ok" ? <span className="tx-ya-ok"><CheckCircle2 size={14} /> Funcionando: {comments.read} comentário(s) lidos{comments.total > comments.read ? ` de ${nf(comments.total)}` : ""}</span>
    : comments.status === "disabled" ? <span className="tx-ya-warn"><AlertTriangle size={14} /> Comentários desativados nos vídeos recentes</span>
    : comments.status === "no_videos" ? <span className="tx-ya-muted">Sem vídeos para testar</span>
    : comments.status === "scope" ? <span className="tx-ya-bad"><XCircle size={14} /> Sem permissão de comentários (reconecte e marque “Gerenciar sua conta do YouTube”)</span>
    : comments.status === "expired" ? <span className="tx-ya-bad"><XCircle size={14} /> Conexão expirada, reconecte</span>
    : comments.status === "quota" ? <span className="tx-ya-warn"><AlertTriangle size={14} /> Limite diário da API</span>
    : <span className="tx-ya-bad"><XCircle size={14} /> {comments.message || "Erro ao ler comentários"}</span>;
  return (
    <Card title="Conexão com o YouTube" icon={ShieldCheck} className="tx-ya-status">
      <ul className="tx-ya-scopes">{items.map(([name, ok, desc]) => (
        <li key={name} className={ok ? "is-ok" : "is-missing"}>{ok ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}<span><b>{name}</b><small>{desc}</small></span></li>
      ))}</ul>
      <div className="tx-ya-comments"><MessageSquare size={14} /><span>Teste de comentários:</span>{commentLine}</div>
      {comments?.status === "ok" && comments.sample.length > 0 && <div className="tx-ya-sample">{comments.sample.map((c, i) => <p key={i}><b>{c.author}</b> {c.text}</p>)}</div>}
      <div className="tx-ya-status-actions">
        {(!scopes?.analytics || !scopes?.forceSsl) && <button className="tx-btn-gold" disabled={connecting} onClick={() => onConnect()}>{connecting ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}Reconectar e liberar acesso</button>}
        {scopes?.analytics && !scopes?.monetary && <button className="tx-ya-ghost" disabled={connecting} onClick={() => onConnect([YT_SCOPE.monetary])}><Wallet size={14} />Liberar receita (opcional)</button>}
      </div>
    </Card>
  );
}

/* ------------------------------ painel de vídeo ------------------------------ */

function VideoPanel({ video, onClose }: { video: TopVideo; onClose: () => void }) {
  const [rep, setRep] = useState<VideoAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      const token = await getGoogleAccessToken();
      const scopes = await getGoogleScopes();
      const r = await fetchVideoAnalytics(token, video.id, { publishedAt: video.publishedAt, skipRevenue: !scopes.monetary });
      if (alive) { setRep(r); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [video.id, video.publishedAt]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const c = rep?.core.ok ? rep.core.data : null;
  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; }, []);
  return createPortal(
    <div className="tx-ya tx-ya-sheet-wrap" role="dialog" aria-modal="true" aria-label={video.title}>
      <button className="tx-ya-scrim" aria-label="Fechar" onClick={onClose} />
      <div className="tx-ya-sheet">
        <div className="tx-ya-sheet-head">
          <img src={video.thumbnail} alt="" />
          <div className="min-w-0 flex-1"><p className="tx-ya-kicker">Desde a publicação</p><h3>{video.title}</h3></div>
          <button className="tx-ya-icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        {loading ? <div className="tx-ya-loading"><Loader2 size={20} className="animate-spin" /> Lendo o Analytics do vídeo…</div> : rep && <>
          <div className="tx-ya-kpis is-compact">
            <Kpi icon={Eye} label="Views" value={c ? nf(c.views) : "—"} />
            <Kpi icon={Clock3} label="Horas assistidas" value={c ? hours(c.minutesWatched) : "—"} />
            <Kpi icon={Timer} label="Duração média" value={c ? fmtDuration(c.avgViewDuration) : "—"} />
            <Kpi icon={Percent} label="% assistida" value={c ? pf(c.avgViewPercentage) : "—"} gold />
            <Kpi icon={ImageIcon} label="Impressões" value={rep.reach.ok ? cf(rep.reach.data.impressions) : "—"} locked={rep.reach.ok ? undefined : "indisponível"} />
            <Kpi icon={MousePointerClick} label="CTR" value={rep.reach.ok ? pf(rep.reach.data.ctr) : "—"} locked={rep.reach.ok ? undefined : "indisponível"} gold />
            <Kpi icon={UserPlus} label="Inscritos" value={c ? `+${nf(c.subscribersGained)}` : "—"} />
            {rep.revenue.ok ? <Kpi icon={Wallet} label="Receita" value={brl(rep.revenue.data.estimatedRevenue)} /> : <Kpi icon={ThumbsUp} label="Likes" value={c ? nf(c.likes) : "—"} />}
          </div>
          <Card title="Retenção do público" icon={Timer}>{rep.retention.ok ? <RetentionChart points={rep.retention.data} durationSeconds={video.durationSeconds} /> : <SectionError s={rep.retention} what="Retenção" />}</Card>
          <div className="tx-ya-grid2">
            <Card title="Origem do tráfego" icon={Share2}>{rep.traffic.ok ? <BarList items={rep.traffic.data} /> : <SectionError s={rep.traffic} what="Tráfego" />}</Card>
            <Card title="Buscas que trouxeram views" icon={Search}>{rep.searchTerms.ok ? (rep.searchTerms.data.length ? <BarList items={rep.searchTerms.data} max={10} /> : <p className="tx-ya-empty">Nenhuma busca relevante ainda.</p>) : <SectionError s={rep.searchTerms} what="Buscas" />}</Card>
          </div>
          <button className="tx-btn-gold tx-ya-ai-btn" onClick={() => askAI(`Analise este vídeo com os dados reais do YouTube Analytics e me diga o que melhorar (título, thumbnail, gancho e retenção):\n\n${summarizeVideoAnalytics(rep, video.title)}`)}><Sparkles size={15} />Pedir diagnóstico à TubeX AI</button>
        </>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------------------------- view ---------------------------------- */

export default function YouTubeAnalyticsView() {
  const { data: channel, error: channelError } = useChannelData();
  const [days, setDays] = useState(28);
  const [metric, setMetric] = useState<Metric>("views");
  const [report, setReport] = useState<ChannelAnalytics | null>(null);
  const [scopes, setScopes] = useState<GoogleScopes | null>(null);
  const [comments, setComments] = useState<CommentsCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<"" | "connect" | "scope" | "error">("");
  const [connecting, setConnecting] = useState(false);
  const [open, setOpen] = useState<TopVideo | null>(null);

  const load = useCallback(async (range: number, retry = true) => {
    setLoading(true); setFatal("");
    try {
      const token = await getGoogleAccessToken(!retry);
      if (!token) { setFatal("connect"); setScopes(null); return; }
      const sc = await getGoogleScopes(!retry);
      setScopes(sc);
      if (!sc.valid) { if (retry) return void (await load(range, false)); setFatal("connect"); return; }
      if (!sc.analytics) { setFatal("scope"); return; }
      const rep = await fetchChannelAnalytics(token, { days: range, skipRevenue: !sc.monetary });
      if (!rep.core.ok && rep.core.error === "expired" && retry) return void (await load(range, false));
      if (!rep.core.ok && rep.core.error === "scope") { setFatal("scope"); return; }
      setReport(rep);
    } catch { setFatal("error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(days); }, [days, load]);

  // Teste real de leitura de comentários nos vídeos mais recentes com comentários.
  useEffect(() => {
    if (!channel) return;
    let alive = true;
    (async () => {
      const token = await getGoogleAccessToken();
      const ids = channel.videos.filter((v) => v.comments > 0).map((v) => v.id);
      const r = await checkCommentsAccess(token, ids.length ? ids : channel.videos.map((v) => v.id));
      if (alive) setComments(r);
    })();
    return () => { alive = false; };
  }, [channel]);

  async function connect(extra?: string[]) { setConnecting(true); try { await connectYouTube(extra || []); } catch { setConnecting(false); } }

  const c = report?.core.ok ? report.core.data : null;
  const p = report?.previous.ok ? report.previous.data : undefined;
  const net = c ? c.subscribersGained - c.subscribersLost : 0;
  const daily = report?.daily.ok ? report.daily.data : [];
  const totals = useMemo(() => ({ views: daily.reduce((s, d) => s + d.views, 0) }), [daily]);

  const header = (
    <div className="tx-ya-hero">
      <div className="min-w-0">
        <p className="tx-ya-kicker"><BarChart3 size={13} /> YouTube Analytics</p>
        <h1>Analytics <span className="tx-gold">completo</span> do canal</h1>
        <p className="tx-ya-sub">{channel?.channel.title ? `${channel.channel.title} · ` : ""}dados oficiais do YouTube Studio, com cerca de 2 dias de atraso.</p>
      </div>
      <div className="tx-ya-controls">
        <div className="tx-ya-seg" role="tablist" aria-label="Período">{RANGES.map(([d, l]) => <button key={d} role="tab" aria-selected={days === d} className={days === d ? "is-active" : ""} onClick={() => setDays(d)}>{l}</button>)}</div>
        <button className="tx-ya-icon-btn" onClick={() => void load(days)} aria-label="Atualizar" disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
      </div>
    </div>
  );

  if (fatal === "connect" || fatal === "scope" || channelError?.needsGoogle) {
    return (
      <div className="tx-ya">
        {header}
        <section className="tx-ya-card tx-ya-gate">
          <span className="tx-ya-gate-icon"><ShieldCheck size={22} /></span>
          <h2>{fatal === "scope" ? <>Libere o <span className="tx-gold">YouTube Analytics</span></> : <>Conecte seu <span className="tx-gold">canal</span></>}</h2>
          <p>{fatal === "scope" ? "Sua conexão atual só permite ver dados públicos. Reconecte e confirme as permissões do YouTube para ver CTR, impressões, retenção, tempo de exibição, origem do tráfego e público." : "Entre com a conta Google do seu canal para o TubeX ler o Analytics completo."}</p>
          <button className="tx-btn-gold" disabled={connecting} onClick={() => void connect()}>{connecting ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />}{fatal === "scope" ? "Reconectar com Analytics" : "Conectar YouTube"}</button>
          <small>Na tela do Google, deixe todas as caixas do YouTube marcadas.</small>
        </section>
        <ConnectionStatus scopes={scopes} comments={comments} onConnect={(e) => void connect(e)} connecting={connecting} />
      </div>
    );
  }

  return (
    <div className="tx-ya">
      {header}
      {loading && !report ? (
        <div className="tx-ya-kpis">{Array.from({ length: 8 }, (_, i) => <div key={i} className="tx-ya-kpi tx-ya-skel" />)}</div>
      ) : fatal === "error" || !report ? (
        <section className="tx-ya-card"><p className="tx-ya-empty">Não foi possível carregar o Analytics agora. <button className="tx-ya-link" onClick={() => void load(days)}>Tentar de novo</button></p></section>
      ) : <>
        <div className={`tx-ya-kpis ${loading ? "is-loading" : ""}`}>
          <Kpi icon={Eye} label="Visualizações" value={c ? nf(c.views) : "—"} change={c && delta(c.views, p?.views)} hint="vs. período anterior" delay={0} />
          <Kpi icon={Clock3} label="Tempo de exibição" value={c ? hours(c.minutesWatched) : "—"} change={c && delta(c.minutesWatched, p?.minutesWatched)} delay={40} />
          <Kpi icon={UserPlus} label="Inscritos (líquido)" value={c ? `${net >= 0 ? "+" : ""}${nf(net)}` : "—"} hint={c ? `+${nf(c.subscribersGained)} / −${nf(c.subscribersLost)}` : ""} delay={80} />
          <Kpi icon={Wallet} label="Receita estimada" value={report.revenue.ok ? brl(report.revenue.data.estimatedRevenue) : "—"} locked={report.revenue.ok ? undefined : scopes?.monetary ? "canal não monetizado" : "libere em Conexão"} gold delay={120} />
          <Kpi icon={ImageIcon} label="Impressões" value={report.reach.ok ? cf(report.reach.data.impressions) : "—"} locked={report.reach.ok ? undefined : "não liberado pela API"} delay={160} />
          <Kpi icon={MousePointerClick} label="CTR das impressões" value={report.reach.ok ? pf(report.reach.data.ctr) : "—"} locked={report.reach.ok ? undefined : "não liberado pela API"} gold delay={200} />
          <Kpi icon={Timer} label="Duração média" value={c ? fmtDuration(c.avgViewDuration) : "—"} change={c && delta(c.avgViewDuration, p?.avgViewDuration)} delay={240} />
          <Kpi icon={Percent} label="% média assistida" value={c ? pf(c.avgViewPercentage) : "—"} hint="retenção média" delay={280} />
        </div>

        <Card title="Evolução diária" icon={BarChart3} className="tx-ya-trend" action={
          <div className="tx-ya-seg is-small">{([["views", "Views"], ["hours", "Horas"], ["subs", "Inscritos"]] as [Metric, string][]).map(([k, l]) => <button key={k} className={metric === k ? "is-active" : ""} onClick={() => setMetric(k)}>{l}</button>)}</div>
        }>{report.daily.ok ? <TrendChart points={daily} metric={metric} /> : <SectionError s={report.daily} what="Gráfico" />}{report.daily.ok && <p className="tx-ya-foot">{nf(totals.views)} views no período · {c ? `${nf(c.likes)} likes · ${nf(c.comments)} comentários · ${nf(c.shares)} compartilhamentos` : ""}</p>}</Card>

        <div className="tx-ya-grid2">
          <Card title="Origem do tráfego" icon={Share2}>{report.traffic.ok ? <BarList items={report.traffic.data} showMinutes /> : <SectionError s={report.traffic} what="Tráfego" />}</Card>
          <Card title="Público por idade e gênero" icon={Users}>{report.demographics.ok ? <Demographics rows={report.demographics.data} /> : <SectionError s={report.demographics} what="Público" />}</Card>
        </div>

        <div className="tx-ya-grid3">
          <Card title="Formato" icon={PlayCircle}>{report.contentTypes.ok ? <BarList items={report.contentTypes.data} showMinutes /> : <SectionError s={report.contentTypes} what="Formato" />}</Card>
          <Card title="Inscritos x não inscritos" icon={UserPlus}>{report.subscribedStatus.ok ? <BarList items={report.subscribedStatus.data} /> : <SectionError s={report.subscribedStatus} what="Público" />}</Card>
          <Card title="Dispositivos" icon={MonitorSmartphone}>{report.devices.ok ? <BarList items={report.devices.data} /> : <SectionError s={report.devices} what="Dispositivos" />}</Card>
        </div>

        <Card title="Principais países" icon={Globe2}>{report.countries.ok ? <BarList items={report.countries.data} max={10} showMinutes /> : <SectionError s={report.countries} what="Países" />}</Card>

        <Card title="Vídeos com mais views no período" icon={PlayCircle} action={<span className="tx-ya-muted tx-ya-hide-sm">Toque para ver retenção e buscas</span>}>
          {report.topVideos.ok ? (report.topVideos.data.length ? (
            <div className="tx-ya-videos">
              <div className="tx-ya-vrow is-head"><span>Vídeo</span><span>Views</span><span>Horas</span><span>Duração média</span><span>% assistida</span><span>Inscritos</span></div>
              {report.topVideos.data.map((v, i) => (
                <button key={v.id} className="tx-ya-vrow" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }} onClick={() => setOpen(v)}>
                  <span className="tx-ya-vtitle"><img src={v.thumbnail} alt="" loading="lazy" /><b>{v.title}</b></span>
                  <span data-l="Views">{nf(v.views)}</span><span data-l="Horas">{hours(v.minutesWatched)}</span><span data-l="Duração">{fmtDuration(v.avgViewDuration)}</span>
                  <span data-l="% assistida" className={v.avgViewPercentage >= 50 ? "tx-ya-good" : ""}>{pf(v.avgViewPercentage)}</span><span data-l="Inscritos">+{nf(v.subscribersGained)}</span>
                </button>
              ))}
            </div>
          ) : <p className="tx-ya-empty">Nenhum vídeo com views neste período.</p>) : <SectionError s={report.topVideos} what="Vídeos" />}
        </Card>

        <div className="tx-ya-cta">
          <div><b>Quer saber o que fazer com esses números?</b><span>A TubeX AI lê este relatório e monta um plano de ação.</span></div>
          <button className="tx-btn-gold" onClick={() => askAI(`Use meus dados reais do YouTube Analytics e me dê um diagnóstico do canal com 5 ações prioritárias:\n\n${summarizeChannelAnalytics(report)}`)}><Sparkles size={15} />Analisar com a IA</button>
        </div>
      </>}

      <ConnectionStatus scopes={scopes} comments={comments} onConnect={(e) => void connect(e)} connecting={connecting} />
      {open && <VideoPanel video={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
