"use client";

import { Fragment, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  ArrowUp, Plus, Sparkles, ImagePlus, LoaderCircle, Download,
  Eye, Users, Video, ChevronDown, PanelRightClose, PanelRightOpen,
  MessageSquare, MoreHorizontal, Paperclip, Search, ChartNoAxesCombined,
  Lightbulb, WandSparkles, Clock3, Check, X, RefreshCw, Copy, Square,
  ArrowDown, Trash2, Menu
} from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };
type ChatSession = { id: string; title: string; updatedAt: number; messages: Message[] };
type Mode = "fast" | "deep";
type AIQuota = { plan: string; planLabel: string; used: number; limit: number; remaining?: number; cost?: number };

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
  const [mode, setMode] = useState<Mode>("fast");
  const [modeOpen, setModeOpen] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [quota, setQuota] = useState<AIQuota | null>(null);
  // Efeito de digitação: a resposta chega inteira e é revelada aos poucos, como num chat de IA real.
  const [typing, setTyping] = useState<{ sessionId: string; index: number; shown: number } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stickRef = useRef(true);

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
    if (window.matchMedia?.("(min-width: 1400px)").matches) setShowContext(true);
    const load = () => {
      try { const raw = localStorage.getItem("tubex-ai-channel-context"); setChannelContext(raw ? JSON.parse(raw) : null); }
      catch { setChannelContext(null); }
    };
    load();
    const loadQuota = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const response = await fetch("/api/ai/chat", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (response.ok) setQuota(await response.json());
      } catch {}
    };
    void loadQuota();
    window.addEventListener("tubex-channel-context", load); window.addEventListener("storage", load);
    return () => { window.removeEventListener("tubex-channel-context", load); window.removeEventListener("storage", load); };
  }, []);

  useEffect(() => {
    try { if (sessions.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 30))); } catch {}
  }, [sessions]);

  const active = sessions.find(s => s.id === activeId) || sessions[0];
  const messages = active?.messages || [welcome];
  const isFresh = messages.length <= 1;

  // Revela a resposta palavra por palavra.
  useEffect(() => {
    if (!typing) return;
    const target = sessions.find(s => s.id === typing.sessionId)?.messages[typing.index]?.content || "";
    if (typing.shown >= target.length) { setTyping(null); return; }
    const step = Math.max(3, Math.ceil(target.length / 140));
    const timer = window.setTimeout(() => {
      let next = Math.min(target.length, typing.shown + step);
      while (next < target.length && !/\s/.test(target[next])) next++;
      setTyping(t => t ? { ...t, shown: next } : t);
    }, 16);
    return () => window.clearTimeout(timer);
  }, [typing, sessions]);

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
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ messages: next.slice(-12), channelContext, mode }),
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

  const metrics = useMemo(() => channelContext ? [
    { label: "Inscritos", value: Number(channelContext.subscribers || 0).toLocaleString("pt-BR"), icon: Users },
    { label: "Visualizações", value: Number(channelContext.totalViews || 0).toLocaleString("pt-BR"), icon: Eye },
    { label: "Vídeos", value: Number(channelContext.videoCount || 0).toLocaleString("pt-BR"), icon: Video },
  ] : [], [channelContext]);

  const visible = messages.map((m, i) => ({ m, i })).slice(isFresh ? 1 : 0);
  const lastAssistantIndex = messages.length - 1 >= 0 && messages[messages.length - 1].role === "assistant" ? messages.length - 1 : -1;
  const canRetry = !busy && !!error && messages[messages.length - 1]?.role === "user";
  const remaining = quota ? quota.remaining ?? Math.max(0, quota.limit - quota.used) : null;

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
            {quota && <span title={`Plano ${quota.planLabel}: ${quota.used} de ${quota.limit} créditos utilizados neste mês`} className="tx-ai-quota">{quota.planLabel} · {remaining} créditos</span>}
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
              const content = isTyping ? m.content.slice(0, typing!.shown) : m.content;
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
            {upgradeRequired && <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-3"><div><p className="text-[13px] font-bold">Precisa de mais créditos?</p><p className="text-[12px] text-[var(--tx-muted)]">Faça upgrade para ampliar sua franquia mensal do TubeX AI.</p></div><a href="/plans" className="tx-ai-generate-btn">Ver planos</a></div>}
            </div>
          </div>

          <div className="tx-ai-composer-wrap">
            {!atBottom && !isFresh && <button type="button" className="tx-ai-jump" onClick={() => { stickRef.current = true; scrollToBottom(); }} aria-label="Ir para o fim da conversa"><ArrowDown size={16}/></button>}
            {thumbnailMode && <div className="tx-ai-tool-panel">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[13px] font-bold"><ImagePlus size={16} className="text-[var(--tx-blue)]"/> Criar thumbnail</div><button onClick={() => setThumbnailMode(false)} className="tx-ai-icon-btn" aria-label="Fechar"><X size={14}/></button></div>
              <textarea value={thumbnailPrompt} onChange={e => setThumbnailPrompt(e.target.value)} placeholder="Descreva o vídeo, o conceito visual, texto da capa e elementos que deseja incluir..." rows={3}/>
              <div className="flex justify-end"><button onClick={generateThumbnail} disabled={imageBusy || thumbnailPrompt.trim().length < 5} className="tx-ai-generate-btn">{imageBusy ? <LoaderCircle size={14} className="animate-spin"/> : <WandSparkles size={14}/>} Gerar thumbnail · 22 créditos</button></div>
            </div>}
            <form onSubmit={e => { e.preventDefault(); void send(); }} className="tx-ai-composer">
              <textarea ref={textareaRef} value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} rows={1} placeholder="Pergunte ao TubeX AI..." aria-label="Mensagem para o TubeX AI" enterKeyHint="send" />
              <div className="tx-ai-composer-tools">
                <div className="flex items-center gap-1">
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
    </main>
  );
}
