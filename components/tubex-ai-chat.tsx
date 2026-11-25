"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  ArrowUp, Plus, Sparkles, ImagePlus, LoaderCircle, Download,
  Eye, Users, Video, ChevronDown, PanelRightClose, PanelRightOpen,
  MessageSquare, MoreHorizontal, Paperclip, Search, ChartNoAxesCombined,
  Lightbulb, WandSparkles, Clock3, Check, X, RefreshCw
} from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };
type ChatSession = { id: string; title: string; updatedAt: number; messages: Message[] };
type Mode = "fast" | "deep";
type AIQuota = { plan: string; planLabel: string; used: number; limit: number; remaining?: number };

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
  const [channelContext, setChannelContext] = useState<any>(null);
  const [mode, setMode] = useState<Mode>("fast");
  const [modeOpen, setModeOpen] = useState(false);
  const [showContext, setShowContext] = useState(true);
  const [quota, setQuota] = useState<AIQuota | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (sessions.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 30)));
  }, [sessions]);

  const active = sessions.find(s => s.id === activeId) || sessions[0];
  const messages = active?.messages || [welcome];
  const isFresh = messages.length <= 1;
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy, thumbnail]);

  function updateMessages(next: Message[]) {
    setSessions(current => current.map(s => s.id === activeId ? {
      ...s, messages: next, updatedAt: Date.now(),
      title: s.title === "Nova conversa" && next.find(m => m.role === "user") ? next.find(m => m.role === "user")!.content.slice(0, 42) : s.title
    } : s).sort((a,b) => b.updatedAt-a.updatedAt));
  }

  function newChat() {
    const session = { id: makeId(), title: "Nova conversa", updatedAt: Date.now(), messages: [welcome] };
    setSessions(current => [session, ...current]); setActiveId(session.id); setThumbnail(""); setError(""); setPrompt("");
  }

  async function send(text = prompt) {
    const value = text.trim(); if (!value || busy || !active) return;
    const next: Message[] = [...messages, { role: "user", content: value }];
    updateMessages(next); setPrompt(""); setBusy(true); setError(""); setThumbnail("");
    try {
      const { data } = await supabase.auth.getSession(); const token = data.session?.access_token;
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ messages: next.slice(-12), channelContext, mode }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível responder.");
      updateMessages([...next, { role: "assistant", content: payload.answer }]);
      if (payload.quota) setQuota(payload.quota);
    } catch (e: any) { setError(e?.message || "Falha ao conversar com a IA."); }
    finally { setBusy(false); }
  }

  async function generateThumbnail() {
    if (thumbnailPrompt.trim().length < 5 || imageBusy) return;
    setImageBusy(true); setError(""); setThumbnail("");
    try {
      const { data } = await supabase.auth.getSession(); const token = data.session?.access_token;
      const response = await fetch("/api/ai/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ prompt: thumbnailPrompt, channelContext }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível gerar a imagem.");
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

  return (
    <main className="tx-ai-workspace">
      <aside className="tx-ai-history">
        <div className="flex items-center justify-between px-3 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 text-white shadow-lg shadow-violet-500/20"><Sparkles size={16}/></span>
            <div><p className="text-[13px] font-extrabold tracking-tight">TubeX <span className="text-violet-400">AI</span></p><p className="text-[9px] text-[var(--tx-muted)]">Creator intelligence</p></div>
          </div>
          <button onClick={newChat} title="Nova conversa" className="tx-ai-icon-btn"><Plus size={16}/></button>
        </div>
        <button onClick={newChat} className="tx-ai-new-chat"><Plus size={15}/> Nova conversa</button>
        <div className="mt-6 px-3"><p className="tx-ai-section-label">Recentes</p></div>
        <div className="mt-2 flex-1 space-y-1 overflow-y-auto px-2">
          {sessions.map(s => (
            <button key={s.id} onClick={() => { setActiveId(s.id); setError(""); setThumbnail(""); }} className={`tx-ai-history-item ${s.id === activeId ? "is-active" : ""}`}>
              <MessageSquare size={14}/><span>{s.title}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 border-t border-[var(--tx-border)] px-3 pt-4">
          <div className="flex items-center gap-2 rounded-xl bg-[var(--tx-surface-2)] p-3">
            <span className={`h-2 w-2 rounded-full ${channelContext?.channelName ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.7)]" : "bg-amber-400"}`}/>
            <div className="min-w-0"><p className="text-[10px] font-bold">{channelContext?.channelName || "Canal não conectado"}</p><p className="text-[9px] text-[var(--tx-muted)]">{channelContext?.channelName ? "Contexto disponível" : "Conecte pelo Feed"}</p></div>
          </div>
        </div>
      </aside>

      <section className="tx-ai-main">
        <header className="tx-ai-topbar">
          <div className="min-w-0">
            <p className="text-[12px] font-bold">{active?.title || "Nova conversa"}</p>
            <p className="mt-0.5 text-[10px] text-[var(--tx-muted)]">Seu copiloto para crescer no YouTube</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-[var(--tx-border)] px-3 py-1.5 text-[9px] text-[var(--tx-muted)] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> Groq AI</span>
            {quota && <span title={`Plano ${quota.planLabel}: ${quota.used} de ${quota.limit} mensagens usadas neste mês`} className="hidden rounded-full border border-[var(--tx-border)] px-3 py-1.5 text-[9px] text-[var(--tx-muted)] md:inline-flex">{quota.planLabel} · {quota.used}/{quota.limit} créditos</span>}
            <button onClick={() => setShowContext(v => !v)} className="tx-ai-icon-btn" title="Painel do canal">{showContext ? <PanelRightClose size={16}/> : <PanelRightOpen size={16}/>}</button>
          </div>
        </header>

        <div className="tx-ai-content">
          <div className="tx-ai-thread" ref={scrollRef}>
            {isFresh && (
              <div className="tx-ai-welcome">
                <div className="tx-ai-orb"><span><Sparkles size={25}/></span></div>
                <div className="tx-ai-eyebrow"><span/> TUBEX CREATOR INTELLIGENCE</div>
                <h1>Vamos fazer seu canal <em>crescer.</em></h1>
                <p>Analise dados, descubra oportunidades e transforme ideias em conteúdo melhor — tudo em uma conversa.</p>
                <div className="tx-ai-starters">
                  {starters.map(({icon: Icon,title,text}) => (
                    <button key={title} onClick={() => title === "Crie uma thumbnail" ? setThumbnailMode(true) : send(text)} className="tx-ai-starter">
                      <span className="tx-ai-starter-icon"><Icon size={17}/></span><span><b>{title}</b><small>{title === "Crie uma thumbnail" ? "Desenvolva uma capa para seu vídeo" : text.length > 57 ? `${text.slice(0,57)}…` : text}</small></span>
                      <span className="tx-ai-starter-arrow">↗</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isFresh && <div className="mx-auto mb-8 max-w-3xl text-center"><span className="tx-ai-date-pill"><Clock3 size={11}/> Conversa em andamento</span></div>}
            {messages.slice(isFresh ? 1 : 0).map((m,i) => (
              <div key={`${activeId}-${i}`} className={`tx-ai-message-row ${m.role === "user" ? "user" : "assistant"}`}>
                {m.role === "assistant" && <span className="tx-ai-avatar"><Sparkles size={14}/></span>}
                <div className={`tx-ai-message ${m.role === "user" ? "user" : "assistant"}`}>{m.content}</div>
              </div>
            ))}
            {busy && <div className="tx-ai-message-row assistant"><span className="tx-ai-avatar"><Sparkles size={14}/></span><div className="tx-ai-thinking"><span/><span/><span/> <small>Organizando a análise</small></div></div>}
            {thumbnail && <div className="tx-ai-generated"><img src={thumbnail} alt="Thumbnail gerada pelo TubeX AI"/><a href={thumbnail} download="tubex-thumbnail.png"><Download size={14}/> Salvar imagem</a></div>}
            {error && <div className="tx-ai-error"><span>{error}</span><button onClick={() => setError("")}><X size={14}/></button></div>}
          </div>

          <div className="tx-ai-composer-wrap">
            {thumbnailMode && <div className="tx-ai-tool-panel">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[11px] font-bold"><ImagePlus size={15} className="text-violet-400"/> Criar thumbnail</div><button onClick={() => setThumbnailMode(false)} className="tx-ai-icon-btn"><X size={14}/></button></div>
              <textarea value={thumbnailPrompt} onChange={e => setThumbnailPrompt(e.target.value)} placeholder="Descreva o vídeo, o conceito visual, texto da capa e elementos que deseja incluir..." rows={3}/>
              <div className="flex justify-end"><button onClick={generateThumbnail} disabled={imageBusy || thumbnailPrompt.trim().length < 5} className="tx-ai-generate-btn">{imageBusy ? <LoaderCircle size={14} className="animate-spin"/> : <WandSparkles size={14}/>} Gerar thumbnail</button></div>
            </div>}
            <form onSubmit={e => { e.preventDefault(); void send(); }} className="tx-ai-composer">
              <textarea ref={textareaRef} value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={1} placeholder="Pergunte ao TubeX AI..." />
              <div className="tx-ai-composer-tools">
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setThumbnailMode(v => !v)} className={`tx-ai-tool-btn ${thumbnailMode ? "active" : ""}`}><ImagePlus size={15}/><span>Thumbnail</span></button>
                  <div className="relative">
                    <button type="button" onClick={() => setModeOpen(v => !v)} className="tx-ai-tool-btn">{mode === "fast" ? <Sparkles size={14}/> : <WandSparkles size={14}/>}<span>{mode === "fast" ? "Rápido" : "Profundo"}</span><ChevronDown size={12}/></button>
                    {modeOpen && <div className="tx-ai-mode-menu"><button type="button" onClick={() => {setMode("fast");setModeOpen(false)}}><Sparkles size={14}/><span><b>Rápido</b><small>Respostas diretas e objetivas</small></span>{mode === "fast" && <Check size={13}/>}</button><button type="button" onClick={() => {setMode("deep");setModeOpen(false)}}><WandSparkles size={14}/><span><b>Análise profunda</b><small>Mais contexto e recomendações</small></span>{mode === "deep" && <Check size={13}/>}</button></div>}
                  </div>
                </div>
                <button type="submit" disabled={!prompt.trim() || busy} className="tx-ai-send" aria-label="Enviar"><ArrowUp size={17}/></button>
              </div>
            </form>
            <p className="tx-ai-disclaimer">{quota ? `${quota.remaining ?? Math.max(0, quota.limit - quota.used)} mensagens disponíveis neste mês · ` : ""}O TubeX AI pode cometer erros. Confira métricas e recomendações antes de tomar decisões.</p>
          </div>
        </div>
      </section>

      {showContext && <aside className="tx-ai-context">
        <div className="flex items-center justify-between"><p className="tx-ai-section-label">CONTEXTO DO CANAL</p><button onClick={() => setShowContext(false)} className="tx-ai-icon-btn lg:hidden"><X size={14}/></button></div>
        {channelContext?.channelName ? <>
          <div className="tx-ai-channel-card">
            <div className="tx-ai-channel-avatar"><Video size={20}/></div>
            <div className="min-w-0"><p className="truncate text-[12px] font-bold">{channelContext.channelName}</p><p className="mt-1 text-[9px] text-emerald-400">Conectado ao TubeX</p></div>
          </div>
          <div className="tx-ai-metrics">{metrics.map(({label,value,icon: Icon}) => <div key={label}><span><Icon size={13}/>{label}</span><b>{value}</b></div>)}</div>
          <div className="tx-ai-context-note"><Sparkles size={14}/><p>A IA utiliza estes dados como contexto nas respostas. Métricas privadas, como CTR e retenção, dependem da autorização do YouTube Analytics.</p></div>
        </> : <div className="tx-ai-connect-card"><div className="tx-ai-connect-icon"><Video size={20}/></div><b>Conecte seu canal</b><p>Carregue os dados do canal no Feed para personalizar as análises do TubeX AI.</p><button onClick={() => window.dispatchEvent(new CustomEvent("tubex-navigate-tab", { detail: "feed" }))}>Abrir Feed <ArrowUp size={13}/></button></div>}
        <div className="mt-7"><p className="tx-ai-section-label">O QUE POSSO FAZER</p><div className="mt-3 space-y-2">{["Diagnóstico do canal","Análise de vídeos","Estratégia de conteúdo","Criação de thumbnails"].map((v,i)=><div key={v} className="tx-ai-capability"><span>{["01","02","03","04"][i]}</span>{v}</div>)}</div></div>
      </aside>}
    </main>
  );
}
