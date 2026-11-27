"use client";

import { Fragment, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import {
  ArrowUp, Plus, Sparkles, ImagePlus, LoaderCircle, Download,
  Eye, Users, Video, ChevronDown, PanelRightClose, PanelRightOpen,
  MessageSquare, MoreHorizontal, Paperclip, Search, ChartNoAxesCombined,
  Lightbulb, WandSparkles, Clock3, Check, X, RefreshCw, Copy, Square,
  ArrowDown, Trash2, Menu, Coins, Crown, ShieldCheck
} from "lucide-react";
import { AI_CREDIT_PACKS, AI_UPGRADE_PATH, formatBRL } from "@/lib/tubex-ai-packs";
import "./tubex-ai-credits.css";

type Message = { role: "user" | "assistant"; content: string };
type ChatSession = { id: string; title: string; updatedAt: number; messages: Message[] };
type Mode = "fast" | "deep";
type ChannelVideo = { id: string; title: string; thumbnail: string; publishedAt: string; views: number; likes: number; comments: number; tags?: string[]; description?: string; analytics?: VideoAnalytics };
/** Métricas privadas do YouTube Analytics (dono do canal). status explica quando não vieram. */
type VideoAnalytics = {
  status: "ok" | "no_permission" | "no_data" | "error";
  views?: number; minutesWatched?: number; avgViewDuration?: number; avgViewPercentage?: number;
  subscribersGained?: number; shares?: number; impressions?: number; ctr?: number;
  trafficSources?: { source: string; views: number }[];
};

const ANALYTICS_TTL = 10 * 60 * 1000;
// Se a API recusar as métricas de impressões/CTR (400), não tenta de novo nesta sessão.
let reachMetricsUnsupported = false;

/**
 * Busca no YouTube Analytics as métricas do vídeo anexado: tempo de exibição, retenção,
 * inscritos, origem do tráfego e, quando a API liberar, impressões e CTR. Cada consulta
 * é independente: se uma falhar (métrica indisponível), as outras continuam valendo.
 */
async function fetchVideoAnalytics(token: string, video: ChannelVideo): Promise<VideoAnalytics> {
  const today = new Date().toISOString().slice(0, 10);
  const published = Date.parse(video.publishedAt);
  const startDate = Number.isFinite(published) ? new Date(published).toISOString().slice(0, 10) : "2005-04-23";
  const report = async (params: Record<string, string>) => {
    const query = new URLSearchParams({ ids: "channel==MINE", startDate, endDate: today, filters: `video==${video.id}`, ...params });
    const response = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${query}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload?.error?.message || `Analytics ${response.status}`), { status: response.status });
    return payload as { columnHeaders?: { name: string }[]; rows?: any[][] };
  };
  const firstRow = (data: { columnHeaders?: { name: string }[]; rows?: any[][] }) => {
    const row = data.rows?.[0];
    if (!row) return null;
    return Object.fromEntries((data.columnHeaders || []).map((h, i) => [h.name, Number(row[i]) || 0]));
  };
  const [core, reach, traffic] = await Promise.allSettled([
    report({ metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,shares" }),
    reachMetricsUnsupported ? Promise.reject(new Error("skip")) : report({ metrics: "videoThumbnailImpressions,videoThumbnailImpressionsClickRate" }),
    report({ metrics: "views", dimensions: "insightTrafficSourceType", sort: "-views", maxResults: "6" }),
  ]);
  if (core.status === "rejected") {
    const status = Number((core.reason as any)?.status || 0);
    return { status: status === 401 || status === 403 ? "no_permission" : "error" };
  }
  const main = firstRow(core.value);
  if (!main) return { status: "no_data" };
  const result: VideoAnalytics = {
    status: "ok",
    views: main.views, minutesWatched: main.estimatedMinutesWatched, avgViewDuration: main.averageViewDuration,
    avgViewPercentage: main.averageViewPercentage, subscribersGained: main.subscribersGained, shares: main.shares,
  };
  if (reach.status === "rejected" && Number((reach.reason as any)?.status) === 400) reachMetricsUnsupported = true;
  if (reach.status === "fulfilled") {
    const r = firstRow(reach.value);
    if (r) { result.impressions = r.videoThumbnailImpressions; result.ctr = r.videoThumbnailImpressionsClickRate; }
  }
  if (traffic.status === "fulfilled") {
    result.trafficSources = (traffic.value.rows || []).slice(0, 6).map(row => ({ source: String(row[0]), views: Number(row[1]) || 0 }));
  }
  return result;
}
type AIQuota = { plan: string; planLabel: string; used: number; limit: number; remaining?: number; planRemaining?: number; packBalance?: number; cost?: number };
type CreditPack = { id: string; name: string; credits: number; amountCents: number; highlight?: string };
type UpgradeOffer = { plan: string; label: string; credits: number } | null;

function fmt(n: number) { return Number(n || 0).toLocaleString("pt-BR"); }

/** Loja de créditos: pacotes avulsos + upgrade de plano. Usada inline (créditos esgotados) e no modal. */
function CreditStore({ quota, packs, upgrade, buying, onBuy, compact = false }: {
  quota: AIQuota | null; packs: CreditPack[]; upgrade: UpgradeOffer; buying: string; onBuy: (id: string) => void; compact?: boolean;
}) {
  const planRemaining = quota ? quota.planRemaining ?? Math.max(0, quota.limit - quota.used) : 0;
  return (
    <div className={`tx-credit-store ${compact ? "is-compact" : ""}`}>
      {quota && (
        <div className="tx-credit-balance">
          <div><small>Franquia {quota.planLabel}</small><b>{fmt(planRemaining)}<span> / {fmt(quota.limit)}</span></b><em>renova todo mês</em></div>
          <div><small>Pacotes</small><b>{fmt(quota.packBalance || 0)}</b><em>não expiram</em></div>
        </div>
      )}
      <div className="tx-credit-packs">
        {packs.map(pack => (
          <button key={pack.id} type="button" onClick={() => onBuy(pack.id)} disabled={!!buying} className={`tx-credit-pack ${pack.highlight ? "is-featured" : ""}`}>
            {pack.highlight && <span className="tx-credit-badge">{pack.highlight}</span>}
            <span className="tx-credit-pack-icon"><Coins size={16}/></span>
            <span className="tx-credit-pack-body">
              <b>{fmt(pack.credits)} créditos</b>
              <small>{pack.name} · ≈ {fmt(pack.credits)} respostas rápidas</small>
            </span>
            <span className="tx-credit-price">{buying === pack.id ? <LoaderCircle size={15} className="animate-spin"/> : formatBRL(pack.amountCents)}</span>
          </button>
        ))}
      </div>
      {upgrade && (
        <a href="/plans" className="tx-credit-upgrade">
          <span className="tx-credit-pack-icon is-gold"><Crown size={16}/></span>
          <span className="min-w-0 flex-1"><b>Fazer upgrade para o {upgrade.label}</b><small>{fmt(upgrade.credits)} créditos todo mês, mais recursos do TubeX</small></span>
          <ArrowUp size={14} className="rotate-45"/>
        </a>
      )}
      <p className="tx-credit-note"><ShieldCheck size={13}/> Pagamento único e seguro pela Stripe. Os créditos entram assim que o pagamento é confirmado e são usados depois da franquia do mês.</p>
    </div>
  );
}

const STORAGE_KEY = "tubex-ai-conversations-v2";
const starters = [
  { icon: ChartNoAxesCombined, title: "Analise meu canal", text: "Faça um diagnóstico do meu canal com os dados disponíveis. Identifique oportunidades e prioridades." },
  { icon: Lightbulb, title: "Encontre ideias", text: "Sugira ideias de vídeos alinhadas ao meu canal e explique por que podem funcionar." },
  { icon: Search, title: "Entenda meu desempenho", text: "Analise meus vídeos recentes e identifique padrões nos que tiveram melhor desempenho." },
  { icon: ImagePlus, title: "Crie uma thumbnail", text: "Quero criar uma thumbnail para um vídeo." },
];

const welcome: Message = {
  role: "assistant",
  content: "Sou o TubeX AI, seu copiloto de crescimento no YouTube. Posso ajudar a interpretar os dados do canal, encontrar oportunidades, planejar conteúdos e desenvolver thumbnails. O que você quer trabalhar hoje?"
};

function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

function renderInlineMarkdown(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*[^*\s][^*]*\*)/g;
  const parts = text.split(pattern).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) {
      return <a key={index} href={link[2]} target="_blank" rel="noreferrer noopener">{link[1]}</a>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function splitMarkdownTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());
}

function isMarkdownTableDivider(line: string): boolean {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="tx-ai-code">
      <div className="tx-ai-code-head"><span>{lang || "código"}</span><button type="button" onClick={() => { void navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check size={12}/> : <Copy size={12}/>}{copied ? "Copiado" : "Copiar"}</button></div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

// Ritmo da digitação: ~190 caracteres/s (parecido com ChatGPT/Claude) e
// no máximo 9s no total — respostas longas aceleram para não fazer esperar.
const TYPE_BASE_CPS = 190;
const TYPE_MAX_MS = 9000;

// Avança o corte até o fim da palavra; em tabelas Markdown revela a linha
// inteira (e o divisor junto do cabeçalho) para a tabela nunca "quebrar".
// Durante a digitação, esconde um "**" ainda sem par para não piscar asteriscos.
function hidePartialMarkdown(text: string): string {
  const bold = text.split("**").length - 1;
  return bold % 2 === 1 ? text.slice(0, text.lastIndexOf("**")) + text.slice(text.lastIndexOf("**") + 2) : text;
}

function snapRevealCut(text: string, pos: number): number {
  let next = Math.min(text.length, pos);
  while (next < text.length && !/\s/.test(text[next])) next++;
  const lineStart = next > 0 ? text.lastIndexOf("\n", next - 1) + 1 : 0;
  const lineEndIdx = text.indexOf("\n", lineStart);
  const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
  const line = text.slice(lineStart, lineEnd).trim();
  if (line.includes("|")) {
    const nextLineEndIdx = lineEnd < text.length ? text.indexOf("\n", lineEnd + 1) : -1;
    const nextLineEnd = nextLineEndIdx === -1 ? text.length : nextLineEndIdx;
    const nextLine = lineEnd < text.length ? text.slice(lineEnd + 1, nextLineEnd).trim() : "";
    if (line.startsWith("|") || isMarkdownTableDivider(nextLine)) {
      next = lineEnd;
      if (nextLine && isMarkdownTableDivider(nextLine)) next = nextLineEnd;
    }
  }
  return next;
}

function AssistantMessage({ content }: { content: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { i++; continue; }

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { code.push(lines[i]); i++; }
      i++;
      blocks.push(<CodeBlock key={key++} lang={lang} code={code.join("\n")} />);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line)) { blocks.push(<hr className="tx-ai-md-hr" key={key++} />); i++; continue; }

    // GitHub-flavored Markdown table
    if (line.includes("|") && i + 1 < lines.length && isMarkdownTableDivider(lines[i + 1].trim())) {
      const headers = splitMarkdownTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|") && lines[i].trim()) {
        rows.push(splitMarkdownTableRow(lines[i]));
        i++;
      }
      blocks.push(
        <div className="tx-ai-table-wrap" key={key++}>
          <table className="tx-ai-markdown-table">
            <thead><tr>{headers.map((cell, idx) => <th key={idx}>{renderInlineMarkdown(cell)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIdx) => <tr key={rowIdx}>{headers.map((_, cellIdx) => <td key={cellIdx}>{renderInlineMarkdown(row[cellIdx] || "")}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const Tag = (level === 1 ? "h3" : level === 2 ? "h4" : "h5") as "h3" | "h4" | "h5";
      blocks.push(<Tag className="tx-ai-md-heading" key={key++}>{renderInlineMarkdown(heading[2])}</Tag>);
      i++;
      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, "").trim());
        i++;
      }
      blocks.push(<ul className="tx-ai-md-list" key={key++}>{items.map((item, idx) => <li key={idx}>{renderInlineMarkdown(item)}</li>)}</ul>);
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, "").trim());
        i++;
      }
      blocks.push(<ol className="tx-ai-md-list" key={key++}>{items.map((item, idx) => <li key={idx}>{renderInlineMarkdown(item)}</li>)}</ol>);
      continue;
    }

    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(<blockquote className="tx-ai-md-quote" key={key++}>{quote.map((part, idx) => <p key={idx}>{renderInlineMarkdown(part)}</p>)}</blockquote>);
      continue;
    }

    const paragraph = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("```") && !/^(#{1,3})\s+/.test(lines[i].trim()) &&
      !/^[-*•]\s+/.test(lines[i].trim()) && !/^\d+[.)]\s+/.test(lines[i].trim()) &&
      !(lines[i].trim().includes("|") && i + 1 < lines.length && isMarkdownTableDivider(lines[i + 1].trim()))) {
      paragraph.push(lines[i].trim());
      i++;
    }
    blocks.push(<p className="tx-ai-md-paragraph" key={key++}>{renderInlineMarkdown(paragraph.join(" "))}</p>);
  }

  return <div className="tx-ai-markdown">{blocks}</div>;
}

export default function TubeXAIChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [thumbnailMode, setThumbnailMode] = useState(false);
  const [thumbnailPrompt, setThumbnailPrompt] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [error, setError] = useState("");
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [channelContext, setChannelContext] = useState<any>(null);
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const [videoQuery, setVideoQuery] = useState("");
  const [videoLibrary, setVideoLibrary] = useState<ChannelVideo[]>([]);
  const [videoLibraryLoadedFor, setVideoLibraryLoadedFor] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState("");
  const [selectedVideos, setSelectedVideos] = useState<ChannelVideo[]>([]);
  const [visibleVideoCount, setVisibleVideoCount] = useState(40);
  const [mode, setMode] = useState<Mode>("fast");
  const [modeOpen, setModeOpen] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [quota, setQuota] = useState<AIQuota | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>(() => AI_CREDIT_PACKS.map(({ envPriceKey, ...pack }) => pack));
  const [upgrade, setUpgrade] = useState<UpgradeOffer>(null);
  const [storeOpen, setStoreOpen] = useState(false);
  const [buying, setBuying] = useState("");
  const [creditNotice, setCreditNotice] = useState<"" | "success" | "canceled">("");
  // Efeito de digitação: a resposta chega inteira e é revelada aos poucos, como num chat de IA real.
  const [typing, setTyping] = useState<{ sessionId: string; index: number; shown: number } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stickRef = useRef(true);
  const prefillRef = useRef<string | null>(null);
  const analyticsCacheRef = useRef(new Map<string, { at: number; data: VideoAnalytics }>());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) as ChatSession[] : [];
      if (parsed.length) { setSessions(parsed); setActiveId(parsed[0].id); }
      else {
        const initial = { id: makeId(), title: "Nova conversa", updatedAt: Date.now(), messages: [welcome] };
        setSessions([initial]); setActiveId(initial.id);
      }
    } catch {
      const initial = { id: makeId(), title: "Nova conversa", updatedAt: Date.now(), messages: [welcome] };
      setSessions([initial]); setActiveId(initial.id);
    }
    if (window.matchMedia?.("(min-width: 1500px)").matches) setShowContext(true);
    try { const pre = sessionStorage.getItem("tubex-ai-prefill"); if (pre) { prefillRef.current = pre; sessionStorage.removeItem("tubex-ai-prefill"); } } catch {}
    const load = () => {
      try { const raw = localStorage.getItem("tubex-ai-channel-context"); setChannelContext(raw ? JSON.parse(raw) : null); }
      catch { setChannelContext(null); }
    };
    load();
    const loadQuota = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const response = await fetch("/api/ai/chat", { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        setQuota(payload);
        if (Array.isArray(payload.packs) && payload.packs.length) setPacks(payload.packs);
        setUpgrade(payload.upgrade ?? AI_UPGRADE_PATH[payload.plan] ?? null);
      } catch {}
    };
    void loadQuota();
    // Volta do pagamento na Stripe: o webhook pode levar alguns segundos, então consulta de novo.
    try {
      const params = new URLSearchParams(window.location.search);
      const credits = params.get("credits");
      if (credits === "success" || credits === "canceled") {
        setCreditNotice(credits);
        if (credits === "success") [2500, 6000, 12000].forEach(ms => window.setTimeout(() => void loadQuota(), ms));
        ["credits", "session_id", "tab"].forEach(key => params.delete(key));
        const query = params.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
      }
    } catch {}
    window.addEventListener("tubex-channel-context", load); window.addEventListener("storage", load);
    return () => { window.removeEventListener("tubex-channel-context", load); window.removeEventListener("storage", load); };
  }, []);

  useEffect(() => {
    try { if (sessions.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 30))); } catch {}
  }, [sessions]);

  useEffect(() => {
    setVideoLibrary([]);
    setVideoLibraryLoadedFor("");
    setSelectedVideos([]);
    setVideoQuery("");
    setVisibleVideoCount(40);
  }, [channelContext?.channelId]);

  const active = sessions.find(s => s.id === activeId) || sessions[0];
  const messages = active?.messages || [welcome];
  const isFresh = messages.length <= 1;

  // Pedido vindo de outra tela (ex.: "Analisar com IA" no Início): abre uma conversa nova e envia.
  useEffect(() => {
    if (!prefillRef.current || !active) return;
    if (!isFresh) { newChat(); return; }
    const text = prefillRef.current; prefillRef.current = null;
    void send(text);
  }, [active?.id, isFresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Revela a resposta no ritmo do ChatGPT/Claude: palavra por palavra, com
  // velocidade base confortável e aceleração automática em respostas longas
  // (o total nunca passa de TYPE_MAX_MS). Linhas de tabela aparecem inteiras.
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const typingKey = typing ? `${typing.sessionId}:${typing.index}` : "";
  useEffect(() => {
    if (!typing) return;
    const { sessionId, index } = typing;
    const target = sessionsRef.current.find(s => s.id === sessionId)?.messages[index]?.content || "";
    const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!target || reduceMotion) { setTyping(null); return; }
    const cps = Math.max(TYPE_BASE_CPS, target.length / (TYPE_MAX_MS / 1000));
    let raf = 0; let budget = 0; let last = performance.now(); let lastPaint = 0; let shown = 0;
    const tick = (now: number) => {
      budget += Math.min(now - last, 100) * cps / 1000; last = now;
      let next = shown;
      while (budget > 0 && next < target.length) {
        const cut = snapRevealCut(target, next + 1);
        budget -= cut - next;
        // Pequena pausa natural no fim de parágrafos.
        if (target[cut] === "\n" && target[cut + 1] === "\n") budget -= cps * 0.12;
        next = cut;
      }
      if (next !== shown && (now - lastPaint >= 32 || next >= target.length)) {
        shown = next; lastPaint = now;
        setTyping(t => (t && t.sessionId === sessionId && t.index === index ? { ...t, shown } : t));
      }
      if (shown >= target.length) { setTyping(t => (t && t.sessionId === sessionId && t.index === index ? null : t)); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [typingKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rolagem inteligente: acompanha a resposta só se o usuário estiver no fim da conversa.
  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current; if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);
  useLayoutEffect(() => { if (stickRef.current && (!isFresh || busy)) scrollToBottom(false); }, [messages, busy, thumbnail, typing?.shown, error, isFresh, scrollToBottom]);
  useEffect(() => { stickRef.current = true; setAtBottom(true); requestAnimationFrame(() => { if (isFresh) scrollRef.current?.scrollTo({ top: 0 }); else scrollToBottom(false); }); }, [activeId, scrollToBottom]); // eslint-disable-line react-hooks/exhaustive-deps
  function onThreadScroll() {
    const el = scrollRef.current; if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickRef.current = near; setAtBottom(near);
  }

  // Campo de texto cresce com o conteúdo, como no ChatGPT/Claude.
  useLayoutEffect(() => {
    const el = textareaRef.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [prompt]);

  function updateMessages(next: Message[], sessionId = activeId) {
    setSessions(current => current.map(s => s.id === sessionId ? {
      ...s, messages: next, updatedAt: Date.now(),
      title: s.title === "Nova conversa" && next.find(m => m.role === "user") ? next.find(m => m.role === "user")!.content.slice(0, 42) : s.title
    } : s).sort((a,b) => b.updatedAt-a.updatedAt));
  }

  function newChat() {
    if (busy) stop();
    const session = { id: makeId(), title: "Nova conversa", updatedAt: Date.now(), messages: [welcome] };
    setSessions(current => [session, ...current]); setActiveId(session.id); setThumbnail(""); setError(""); setPrompt(""); setHistoryOpen(false); setTyping(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function deleteChat(id: string) {
    setSessions(current => {
      const rest = current.filter(s => s.id !== id);
      if (!rest.length) {
        const session = { id: makeId(), title: "Nova conversa", updatedAt: Date.now(), messages: [welcome] };
        setActiveId(session.id); return [session];
      }
      if (id === activeId) setActiveId(rest[0].id);
      return rest;
    });
  }

  function stop() {
    abortRef.current?.abort(); abortRef.current = null;
    setTyping(null); setBusy(false);
  }

  async function send(text = prompt, base: Message[] = messages) {
    const value = text.trim(); if (!value || busy || !active) return;
    const sessionId = active.id;
    const next: Message[] = [...base, { role: "user", content: value }];
    updateMessages(next, sessionId); setPrompt(""); setBusy(true); setError(""); setUpgradeRequired(false); setThumbnail(""); setTyping(null);
    stickRef.current = true;
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const { data } = await supabase.auth.getSession(); const token = data.session?.access_token;
      // Métricas privadas do Analytics para os vídeos anexados (cache de 10 min por vídeo).
      const googleToken = String((data.session as any)?.provider_token || "");
      const videosWithAnalytics = await Promise.all(selectedVideos.map(async (video) => {
        const cached = analyticsCacheRef.current.get(video.id);
        if (cached && Date.now() - cached.at < ANALYTICS_TTL) return { ...video, analytics: cached.data };
        if (!googleToken) return { ...video, analytics: { status: "no_permission" } as VideoAnalytics };
        const analytics = await fetchVideoAnalytics(googleToken, video).catch((): VideoAnalytics => ({ status: "error" }));
        if (analytics.status !== "error") analyticsCacheRef.current.set(video.id, { at: Date.now(), data: analytics });
        return { ...video, analytics };
      }));
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ messages: next.slice(-12), channelContext, selectedVideos: videosWithAnalytics, mode }),
      });
      const payload = await response.json();
      if (payload.quota) setQuota(payload.quota);
      if (!response.ok) { setUpgradeRequired(Boolean(payload.upgradeRequired)); throw new Error(payload.error || "Não foi possível responder."); }
      updateMessages([...next, { role: "assistant", content: payload.answer }], sessionId);
      setTyping({ sessionId, index: next.length, shown: 0 });
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message || "Falha ao conversar com a IA.");
    }
    finally { setBusy(false); abortRef.current = null; requestAnimationFrame(() => textareaRef.current?.focus()); }
  }

  async function openVideoPicker() {
    setVideoPickerOpen(true);
    setVideoQuery("");
    setVideoLoadError("");
    setVisibleVideoCount(40);
    const channelId = String(channelContext?.channelId || "");
    if (!channelId) {
      setVideoLoadError("Conecte um canal no Feed para carregar seus vídeos.");
      return;
    }
    if (videoLibraryLoadedFor === channelId) return;
    setVideoLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = String((data.session as any)?.provider_token || "");
      if (!token) throw new Error("A autorização do YouTube expirou. Reconecte sua conta Google no Feed.");

      const yt = async (path: string) => {
        const response = await fetch("https://www.googleapis.com/youtube/v3/" + path, {
          headers: { Authorization: "Bearer " + token }, cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error?.message || "Falha ao carregar vídeos do YouTube (" + response.status + ").");
        return payload;
      };

      const channelParams = new URLSearchParams({ part: "contentDetails", id: channelId });
      const channelData = await yt("channels?" + channelParams);
      const uploadsId = String(channelData?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || "");
      if (!uploadsId) throw new Error("Não foi possível localizar a playlist de envios deste canal.");

      const playlistItems: any[] = [];
      let pageToken = "";
      for (let page = 0; page < 1000; page++) {
        const params = new URLSearchParams({ part: "snippet,contentDetails", playlistId: uploadsId, maxResults: "50" });
        if (pageToken) params.set("pageToken", pageToken);
        const result = await yt("playlistItems?" + params);
        playlistItems.push(...(result.items || []));
        pageToken = String(result.nextPageToken || "");
        if (!pageToken) break;
      }

      const ids = [...new Set(playlistItems.map(item => String(item.contentDetails?.videoId || "")).filter(Boolean))];
      const allVideos: ChannelVideo[] = [];
      for (let i = 0; i < ids.length; i += 50) {
        const params = new URLSearchParams({ part: "snippet,statistics", id: ids.slice(i, i + 50).join(",") });
        const result = await yt("videos?" + params);
        for (const item of result.items || []) {
          allVideos.push({
            id: String(item.id),
            title: String(item.snippet?.title || "Sem título"),
            thumbnail: String(item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || ""),
            publishedAt: String(item.snippet?.publishedAt || ""),
            views: Number(item.statistics?.viewCount || 0),
            likes: Number(item.statistics?.likeCount || 0),
            comments: Number(item.statistics?.commentCount || 0),
            // Tags e início da descrição deixam a IA avaliar o SEO atual do vídeo anexado.
            tags: Array.isArray(item.snippet?.tags) ? item.snippet.tags.slice(0, 30).map((t: unknown) => String(t)) : [],
            description: String(item.snippet?.description || "").slice(0, 400),
          });
        }
      }
      allVideos.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      setVideoLibrary(allVideos);
      setVideoLibraryLoadedFor(channelId);
    } catch (e: any) {
      setVideoLoadError(e?.message || "Não foi possível carregar os vídeos deste canal.");
    } finally {
      setVideoLoading(false);
    }
  }

  function toggleSelectedVideo(video: ChannelVideo) {
    if (selectedVideos.some(item => item.id === video.id)) {
      setSelectedVideos(current => current.filter(item => item.id !== video.id));
      return;
    }
    if (selectedVideos.length >= 5) {
      setVideoLoadError("Selecione até 5 vídeos por pergunta para a análise manter o foco.");
      return;
    }
    setVideoLoadError("");
    setSelectedVideos(current => [...current, video]);
  }

  function regenerate() {
    const lastUser = [...messages].map((m, i) => ({ m, i })).reverse().find(x => x.m.role === "user");
    if (!lastUser || busy) return;
    void send(lastUser.m.content, messages.slice(0, lastUser.i));
  }

  function retry() {
    const last = messages[messages.length - 1];
    if (last?.role !== "user" || busy) return;
    setError("");
    void send(last.content, messages.slice(0, -1));
  }

  function copyMessage(content: string, index: number) {
    void navigator.clipboard?.writeText(content);
    setCopiedIndex(index); setTimeout(() => setCopiedIndex(null), 1500);
  }

  async function generateThumbnail() {
    if (thumbnailPrompt.trim().length < 5 || imageBusy) return;
    setImageBusy(true); setError(""); setUpgradeRequired(false); setThumbnail("");
    try {
      const { data } = await supabase.auth.getSession(); const token = data.session?.access_token;
      const response = await fetch("/api/ai/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ prompt: thumbnailPrompt, channelContext }),
      });
      const payload = await response.json();
      if (payload.quota) setQuota(payload.quota);
      if (!response.ok) { setUpgradeRequired(Boolean(payload.upgradeRequired)); throw new Error(payload.error || "Não foi possível gerar a imagem."); }
      setThumbnail(payload.image);
      updateMessages([...messages, { role: "user", content: `Criar thumbnail: ${thumbnailPrompt}` }, { role: "assistant", content: "Sua thumbnail foi gerada. Você pode visualizar e salvar a imagem abaixo." }]);
      setThumbnailMode(false); setThumbnailPrompt("");
    } catch (e: any) { setError(e?.message || "Falha ao gerar thumbnail."); }
    finally { setImageBusy(false); }
  }

  useEffect(() => {
    if (!storeOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setStoreOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [storeOpen]);

  useEffect(() => {
    if (!videoPickerOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setVideoPickerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [videoPickerOpen]);

  async function buyPack(packId: string) {
    if (buying) return;
    setBuying(packId); setError("");
    try {
      const { data } = await supabase.auth.getSession(); const token = data.session?.access_token;
      const response = await fetch("/api/ai/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ pack: packId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url) throw new Error(payload.error || "Não foi possível abrir o pagamento.");
      window.location.href = payload.url;
    } catch (e: any) {
      setError(e?.message || "Não foi possível abrir o pagamento."); setStoreOpen(false); setBuying("");
    }
  }

  const metrics = useMemo(() => channelContext ? [
    { label: "Inscritos", value: Number(channelContext.subscribers || 0).toLocaleString("pt-BR"), icon: Users },
    { label: "Visualizações", value: Number(channelContext.totalViews || 0).toLocaleString("pt-BR"), icon: Eye },
    { label: "Vídeos", value: Number(channelContext.videoCount || 0).toLocaleString("pt-BR"), icon: Video },
  ] : [], [channelContext]);

  const visible = messages.map((m, i) => ({ m, i })).slice(isFresh ? 1 : 0);
  const lastAssistantIndex = messages.length - 1 >= 0 && messages[messages.length - 1].role === "assistant" ? messages.length - 1 : -1;
  const canRetry = !busy && !!error && messages[messages.length - 1]?.role === "user";
  const remaining = quota ? quota.remaining ?? Math.max(0, quota.limit - quota.used) : null;
  const filteredChannelVideos = useMemo(() => {
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    const query = normalize(videoQuery.trim());
    return videoLibrary.filter(video => !query || normalize(video.title).includes(query));
  }, [videoLibrary, videoQuery]);

  return (
    <main className={`tx-ai-workspace ${showContext ? "has-context" : ""}`}>
      {historyOpen && <button type="button" aria-label="Fechar conversas" className="tx-ai-scrim" onClick={() => setHistoryOpen(false)} />}
      <aside className={`tx-ai-history ${historyOpen ? "is-open" : ""}`}>
        <div className="flex items-center justify-between px-2 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="tx-ai-brand-mark"><Sparkles size={15}/></span>
            <div><p className="text-[14px] font-extrabold tracking-tight">TubeX AI</p><p className="text-[11px] text-[var(--tx-muted)]">Copiloto do criador</p></div>
          </div>
          <button onClick={() => setHistoryOpen(false)} title="Fechar" className="tx-ai-icon-btn tx-ai-only-mobile"><X size={16}/></button>
        </div>
        <button onClick={newChat} className="tx-ai-new-chat"><Plus size={16}/> Nova conversa</button>
        <div className="mt-5 px-2"><p className="tx-ai-section-label">Recentes</p></div>
        <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-1">
          {sessions.map(s => (
            <div key={s.id} className={`tx-ai-history-item ${s.id === activeId ? "is-active" : ""}`}>
              <button onClick={() => { setActiveId(s.id); setError(""); setThumbnail(""); setHistoryOpen(false); setTyping(null); }} className="tx-ai-history-open">
                <MessageSquare size={15}/><span>{s.title}</span>
              </button>
              <button onClick={() => deleteChat(s.id)} className="tx-ai-history-delete" title="Apagar conversa" aria-label={`Apagar conversa ${s.title}`}><Trash2 size={14}/></button>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-[var(--tx-border)] px-1 pt-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-[var(--tx-surface-2)] p-3">
            <span className={`h-2 w-2 shrink-0 rounded-full ${channelContext?.channelName ? "bg-emerald-400" : "bg-amber-400"}`}/>
            <div className="min-w-0"><p className="truncate text-[12px] font-bold">{channelContext?.channelName || "Canal não conectado"}</p><p className="text-[11px] text-[var(--tx-muted)]">{channelContext?.channelName ? "Contexto disponível" : "Conecte pelo Feed"}</p></div>
          </div>
        </div>
      </aside>

      <section className="tx-ai-main">
        <header className="tx-ai-topbar">
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => setHistoryOpen(true)} className="tx-ai-icon-btn tx-ai-only-mobile" title="Conversas" aria-label="Abrir conversas"><Menu size={16}/></button>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold">{active?.title || "Nova conversa"}</p>
              <p className="mt-0.5 hidden text-[12px] text-[var(--tx-muted)] sm:block">{mode === "fast" ? "Modo rápido" : "Análise profunda"}{channelContext?.channelName ? ` · ${channelContext.channelName}` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {quota && <button type="button" onClick={() => setStoreOpen(true)} title={`Plano ${quota.planLabel}: ${quota.used} de ${quota.limit} créditos do mês usados${quota.packBalance ? ` · ${quota.packBalance} créditos de pacotes` : ""}. Clique para comprar mais.`} className={`tx-ai-quota tx-ai-quota-btn ${remaining !== null && remaining < 20 ? "is-low" : ""}`}><Coins size={12}/>{quota.planLabel} · {fmt(remaining || 0)}<span className="tx-ai-hide-mobile">créditos</span><Plus size={12} className="tx-ai-quota-plus"/></button>}
            <button onClick={newChat} className="tx-ai-icon-btn tx-ai-only-mobile" title="Nova conversa" aria-label="Nova conversa"><Plus size={16}/></button>
            <button onClick={() => setShowContext(v => !v)} className="tx-ai-icon-btn tx-ai-hide-mobile" title="Painel do canal" aria-pressed={showContext}>{showContext ? <PanelRightClose size={16}/> : <PanelRightOpen size={16}/>}</button>
          </div>
        </header>

        <div className="tx-ai-content">
          <div className="tx-ai-thread" ref={scrollRef} onScroll={onThreadScroll} aria-live="polite">
            <div className="tx-ai-thread-inner">
            {isFresh && (
              <div className="tx-ai-welcome">
                <div className="tx-ai-orb"><span><Sparkles size={24}/></span></div>
                <h1>Como posso ajudar seu canal <em>hoje?</em></h1>
                <p>Analise dados, descubra oportunidades e transforme ideias em conteúdo melhor, tudo em uma conversa.</p>
                <div className="tx-ai-starters">
                  {starters.map(({icon: Icon,title,text}) => (
                    <button key={title} onClick={() => title === "Crie uma thumbnail" ? setThumbnailMode(true) : send(text)} className="tx-ai-starter">
                      <span className="tx-ai-starter-icon"><Icon size={17}/></span><span className="min-w-0"><b>{title}</b><small>{title === "Crie uma thumbnail" ? "Desenvolva uma capa para seu vídeo" : text.length > 64 ? `${text.slice(0,64)}…` : text}</small></span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {visible.map(({ m, i }) => {
              const isTyping = typing && typing.sessionId === active?.id && typing.index === i;
              const content = isTyping ? hidePartialMarkdown(m.content.slice(0, typing!.shown)) : m.content;
              return (
                <div key={`${activeId}-${i}`} className={`tx-ai-message-row ${m.role === "user" ? "user" : "assistant"}`}>
                  {m.role === "assistant" && <span className="tx-ai-avatar"><Sparkles size={14}/></span>}
                  <div className="tx-ai-message-col">
                    <div className={`tx-ai-message ${m.role === "user" ? "user" : "assistant"} ${isTyping ? "is-typing" : ""}`}>{m.role === "assistant" ? <AssistantMessage content={content} /> : m.content}</div>
                    {m.role === "assistant" && !isTyping && i > 0 && (
                      <div className="tx-ai-message-actions">
                        <button type="button" onClick={() => copyMessage(m.content, i)} title="Copiar resposta">{copiedIndex === i ? <Check size={14}/> : <Copy size={14}/>}<span>{copiedIndex === i ? "Copiado" : "Copiar"}</span></button>
                        {i === lastAssistantIndex && !busy && <button type="button" onClick={regenerate} title="Gerar outra resposta"><RefreshCw size={14}/><span>Gerar novamente</span></button>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {busy && <div className="tx-ai-message-row assistant"><span className="tx-ai-avatar is-thinking"><Sparkles size={14}/></span><div className="tx-ai-thinking"><span/><span/><span/> <small>{mode === "deep" ? "Analisando com profundidade…" : "Pensando…"}</small></div></div>}
            {thumbnail && <div className="tx-ai-generated"><img src={thumbnail} alt="Thumbnail gerada pelo TubeX AI"/><a href={thumbnail} download="tubex-thumbnail.png"><Download size={14}/> Salvar imagem</a></div>}
            {error && <div className="tx-ai-error"><span>{error}</span><div className="flex items-center gap-2">{canRetry && <button onClick={retry} className="tx-ai-retry"><RefreshCw size={13}/> Tentar novamente</button>}<button onClick={() => { setError(""); setUpgradeRequired(false); }} aria-label="Fechar aviso"><X size={14}/></button></div></div>}
            {creditNotice && <div className={`tx-credit-notice ${creditNotice === "success" ? "is-success" : ""}`}><span>{creditNotice === "success" ? <><Check size={14}/> Pagamento recebido! Seus créditos entram em instantes{quota?.packBalance ? `. Saldo de pacotes: ${fmt(quota.packBalance)}` : ""}.</> : "Compra cancelada. Nenhum valor foi cobrado."}</span><button onClick={() => setCreditNotice("")} aria-label="Fechar aviso"><X size={14}/></button></div>}
            {upgradeRequired && <div className="tx-credit-out"><div className="tx-credit-out-head"><span className="tx-credit-pack-icon is-gold"><Sparkles size={16}/></span><div><b>Seus créditos acabaram</b><p>Escolha um pacote avulso para continuar agora ou faça upgrade do plano.</p></div></div><CreditStore quota={quota} packs={packs} upgrade={upgrade} buying={buying} onBuy={buyPack} compact/></div>}
            </div>
          </div>

          <div className="tx-ai-composer-wrap">
            {!atBottom && !isFresh && <button type="button" className="tx-ai-jump" onClick={() => { stickRef.current = true; scrollToBottom(); }} aria-label="Ir para o fim da conversa"><ArrowDown size={16}/></button>}
            {thumbnailMode && <div className="tx-ai-tool-panel">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[13px] font-bold"><ImagePlus size={16} className="text-[var(--tx-blue)]"/> Criar thumbnail</div><button onClick={() => setThumbnailMode(false)} className="tx-ai-icon-btn" aria-label="Fechar"><X size={14}/></button></div>
              <textarea value={thumbnailPrompt} onChange={e => setThumbnailPrompt(e.target.value)} placeholder="Descreva o vídeo, o conceito visual, texto da capa e elementos que deseja incluir..." rows={3}/>
              <div className="flex justify-end"><button onClick={generateThumbnail} disabled={imageBusy || thumbnailPrompt.trim().length < 5} className="tx-ai-generate-btn">{imageBusy ? <LoaderCircle size={14} className="animate-spin"/> : <WandSparkles size={14}/>} Gerar thumbnail · 100 créditos</button></div>
            </div>}
            <form onSubmit={e => { e.preventDefault(); void send(); }} className="tx-ai-composer">
              {selectedVideos.length > 0 && <div className="flex flex-wrap gap-2 pb-2">
                {selectedVideos.map(video => <span key={video.id} className="flex max-w-[230px] items-center gap-2 rounded-lg border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-1.5 text-[10px]">
                  {video.thumbnail && <img src={video.thumbnail} alt="" className="h-8 w-12 shrink-0 rounded object-cover"/>}
                  <span className="min-w-0 truncate">{video.title} · {fmt(video.views)} visualizações</span>
                  <button type="button" onClick={() => setSelectedVideos(current => current.filter(item => item.id !== video.id))} className="shrink-0 rounded p-1 hover:bg-black/10" aria-label={"Remover " + video.title}><X size={12}/></button>
                </span>)}
              </div>}
              <textarea ref={textareaRef} value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} rows={1} placeholder="Pergunte ao TubeX AI..." aria-label="Mensagem para o TubeX AI" enterKeyHint="send" />
              <div className="tx-ai-composer-tools">
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => void openVideoPicker()} className="tx-ai-tool-btn" title="Adicionar vídeo como contexto"><Plus size={15}/><span>Vídeo</span></button>
                  <button type="button" onClick={() => setThumbnailMode(v => !v)} className={`tx-ai-tool-btn ${thumbnailMode ? "active" : ""}`}><ImagePlus size={15}/><span>Thumbnail</span></button>
                  <div className="relative">
                    <button type="button" onClick={() => setModeOpen(v => !v)} className="tx-ai-tool-btn" aria-expanded={modeOpen}>{mode === "fast" ? <Sparkles size={14}/> : <WandSparkles size={14}/>}<span>{mode === "fast" ? "Rápido" : "Profundo"}</span><ChevronDown size={12}/></button>
                    {modeOpen && <div className="tx-ai-mode-menu"><button type="button" onClick={() => {setMode("fast");setModeOpen(false)}}><Sparkles size={14}/><span><b>Rápido</b><small>Respostas diretas e objetivas</small></span>{mode === "fast" && <Check size={13}/>}</button><button type="button" onClick={() => {setMode("deep");setModeOpen(false)}}><WandSparkles size={14}/><span><b>Análise profunda</b><small>Mais contexto e recomendações</small></span>{mode === "deep" && <Check size={13}/>}</button></div>}
                  </div>
                </div>
                {busy || typing
                  ? <button type="button" onClick={stop} className="tx-ai-send is-stop" aria-label="Parar resposta" title="Parar"><Square size={13} fill="currentColor"/></button>
                  : <button type="submit" disabled={!prompt.trim()} className="tx-ai-send" aria-label="Enviar"><ArrowUp size={18}/></button>}
              </div>
            </form>
            <p className="tx-ai-disclaimer">O TubeX AI pode cometer erros. Confira métricas antes de tomar decisões. <span className="tx-ai-hide-mobile">Enter envia · Shift+Enter quebra linha</span></p>
          </div>
        </div>
      </section>

      {showContext && <aside className="tx-ai-context">
        <div className="flex items-center justify-between"><p className="tx-ai-section-label">Contexto do canal</p><button onClick={() => setShowContext(false)} className="tx-ai-icon-btn" aria-label="Fechar painel"><X size={14}/></button></div>
        {channelContext?.channelName ? <>
          <div className="tx-ai-channel-card">
            <div className="tx-ai-channel-avatar">{channelContext?.channelThumbnail ? <img src={channelContext.channelThumbnail} alt="Logo do canal"/> : <Video size={20}/>}</div>
            <div className="min-w-0"><p className="truncate text-[13px] font-bold">{channelContext.channelName}</p><p className="mt-1 text-[11px] text-emerald-400">Conectado ao TubeX</p></div>
          </div>
          <div className="tx-ai-metrics">{metrics.map(({label,value,icon: Icon}) => <div key={label}><span><Icon size={13}/>{label}</span><b>{value}</b></div>)}</div>
          <div className="tx-ai-context-note"><Sparkles size={14}/><p>A IA usa estes dados como contexto. Métricas privadas, como CTR e retenção, dependem da autorização do YouTube Analytics.</p></div>
        </> : <div className="tx-ai-connect-card"><div className="tx-ai-connect-icon"><Video size={20}/></div><b>Conecte seu canal</b><p>Carregue os dados do canal no Feed para personalizar as análises do TubeX AI.</p><button onClick={() => window.dispatchEvent(new CustomEvent("tubex-navigate-tab", { detail: "feed" }))}>Abrir Feed <ArrowUp size={13}/></button></div>}
        <div className="mt-6"><p className="tx-ai-section-label">O que posso fazer</p><div className="mt-2 space-y-1">{["Diagnóstico do canal","Análise de vídeos","Estratégia de conteúdo","Criação de thumbnails"].map((v)=><div key={v} className="tx-ai-capability"><Check size={13}/>{v}</div>)}</div></div>
      </aside>}
    {videoPickerOpen && typeof document !== "undefined" && createPortal(<div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Selecionar vídeos do canal">
      <button type="button" className="absolute inset-0 bg-black/65 backdrop-blur-sm" aria-label="Fechar seletor de vídeos" onClick={() => setVideoPickerOpen(false)}/>
      <section className="relative z-10 flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--tx-border)] bg-[var(--tx-surface)] shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--tx-border)] p-4 sm:p-5">
          <div><p className="tx-ai-section-label">CONTEXTO DA ANÁLISE</p><h2 className="mt-1 text-lg font-black">Adicionar vídeos</h2><p className="mt-1 text-xs text-[var(--tx-muted)]">{videoLibraryLoadedFor ? fmt(videoLibrary.length) + " vídeos encontrados" : "Pesquise e selecione até 5 vídeos"} · {selectedVideos.length}/5 selecionados</p></div>
          <button type="button" onClick={() => setVideoPickerOpen(false)} className="tx-ai-icon-btn" aria-label="Fechar"><X size={16}/></button>
        </header>
        <div className="border-b border-[var(--tx-border)] p-3 sm:p-4">
          <label className="flex items-center gap-2 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-3"><Search size={15} className="shrink-0 text-[var(--tx-muted)]"/><input autoFocus value={videoQuery} onChange={e => { setVideoQuery(e.target.value); setVisibleVideoCount(40); }} placeholder="Pesquisar pelo título do vídeo..." className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"/></label>
        </div>
        {videoLoadError && <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-500"><span>{videoLoadError}</span><button type="button" className="shrink-0 underline" onClick={() => { setVideoPickerOpen(false); window.dispatchEvent(new CustomEvent("tubex-navigate-tab", { detail: "feed" })); }}>Abrir Feed</button></div>}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {videoLoading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-[var(--tx-muted)]"><LoaderCircle size={18} className="animate-spin"/> Carregando todos os vídeos do canal…</div>
            : !filteredChannelVideos.length ? <div className="py-12 text-center text-sm text-[var(--tx-muted)]">{videoLibrary.length ? "Nenhum vídeo corresponde a essa busca." : "Nenhum vídeo disponível para este canal."}</div>
            : <div className="grid gap-2 sm:grid-cols-2">{filteredChannelVideos.slice(0, visibleVideoCount).map(video => {
              const isSelected = selectedVideos.some(item => item.id === video.id);
              return <button type="button" key={video.id} onClick={() => toggleSelectedVideo(video)} className={`flex min-w-0 items-center gap-3 rounded-xl border p-2.5 text-left transition ${isSelected ? "border-[var(--tx-accent)] bg-[var(--tx-accent-soft)]" : "border-[var(--tx-border)] hover:bg-[var(--tx-surface-2)]"}`}>
                <span className="relative h-[58px] w-[96px] shrink-0 overflow-hidden rounded-lg bg-[var(--tx-surface-2)]">{video.thumbnail ? <img src={video.thumbnail} alt="" className="h-full w-full object-cover"/> : <Video size={18} className="m-auto mt-5 text-[var(--tx-muted)]"/>}</span>
                <span className="min-w-0 flex-1"><b className="line-clamp-2 text-xs leading-4">{video.title}</b><small className="mt-1 block text-[10px] text-[var(--tx-muted)]"><Eye size={11} className="mr-1 inline"/> {fmt(video.views)} visualizações{video.publishedAt ? " · " + new Date(video.publishedAt).toLocaleDateString("pt-BR") : ""}</small></span>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${isSelected ? "border-[var(--tx-accent)] bg-[var(--tx-accent)] text-white" : "border-[var(--tx-border)]"}`}>{isSelected && <Check size={12}/>}</span>
              </button>;
            })}</div>}
          {!videoLoading && filteredChannelVideos.length > visibleVideoCount && <button type="button" onClick={() => setVisibleVideoCount(value => value + 40)} className="tx-btn tx-btn-secondary mx-auto mt-4">Carregar mais vídeos</button>}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-[var(--tx-border)] p-3 sm:p-4"><span className="text-[10px] text-[var(--tx-muted)]">Os vídeos escolhidos serão enviados como contexto junto da sua pergunta.</span><button type="button" onClick={() => setVideoPickerOpen(false)} className="tx-btn tx-btn-primary shrink-0">Concluir seleção</button></footer>
      </section>
    </div>, document.body)}
    {storeOpen && typeof document !== "undefined" && createPortal(<div className="tx-credit-modal" role="dialog" aria-modal="true" aria-label="Créditos do TubeX AI">
        <button type="button" className="tx-credit-modal-scrim" aria-label="Fechar" onClick={() => setStoreOpen(false)}/>
        <div className="tx-credit-modal-card">
          <div className="tx-credit-modal-head"><div><p className="tx-credit-eyebrow">TubeX AI</p><h3>Créditos <span className="tx-gold">extras</span></h3></div><button onClick={() => setStoreOpen(false)} className="tx-ai-icon-btn" aria-label="Fechar"><X size={16}/></button></div>
          <CreditStore quota={quota} packs={packs} upgrade={upgrade} buying={buying} onBuy={buyPack}/>
        </div>
      </div>, document.body)}
    </main>
  );
}
