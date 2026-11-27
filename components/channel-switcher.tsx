"use client";
import "./tubex-channels.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Loader2, Plus, Trash2, Tv, X, AlertCircle, RefreshCw } from "lucide-react";
import {
  CHANNEL_EVENT, disconnectChannel, getActiveChannelId, listConnectedChannels, setActiveChannelId,
  startChannelConnect, switchChannel, type ConnectedChannel,
} from "@/lib/tubex-google-token-client";
import { connectYouTube } from "@/lib/tubex-youtube";

const ERRORS: Record<string, string> = {
  denied: "Você cancelou a autorização no Google. Nenhum canal foi alterado.",
  no_channel: "Essa conta Google não tem canal do YouTube. Escolha a conta de marca do canal na tela do Google.",
  state: "A conexão expirou. Tente adicionar o canal de novo.",
  google: "O Google não concluiu a conexão. Tente novamente em instantes.",
};

function Avatar({ c, size = 30 }: { c?: Pick<ConnectedChannel, "thumbnail" | "title"> | null; size?: number }) {
  if (c?.thumbnail) return <img src={c.thumbnail} alt="" width={size} height={size} className="tx-ch-avatar" referrerPolicy="no-referrer" />;
  return <span className="tx-ch-avatar is-empty" style={{ width: size, height: size }}>{c?.title ? c.title.slice(0, 1).toUpperCase() : <Tv size={Math.round(size * 0.5)} />}</span>;
}

/** Seletor de canais do YouTube (topo do dashboard). Trocar de canal não troca o login TubeX. */
export default function ChannelSwitcher() {
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<ConnectedChannel[]>([]);
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>("");
  const [confirmRemove, setConfirmRemove] = useState("");
  const [toast, setToast] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    const r = await listConnectedChannels();
    setChannels(r.channels);
    const local = getActiveChannelId();
    const valid = r.channels.some((c) => c.id === local);
    const next = valid ? local : r.activeId;
    if (next && next !== local) setActiveChannelId(next, Boolean(local));
    setActiveId(next || local);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Volta da tela do Google (/dashboard?yt_channel=… ou ?yt_error=…).
    try {
      const params = new URLSearchParams(window.location.search);
      const added = params.get("yt_channel"), err = params.get("yt_error");
      if (added && /^UC[\w-]{10,}$/.test(added)) { setActiveChannelId(added, true); setToast({ kind: "ok", text: "Canal conectado. Os dados agora são deste canal." }); }
      if (err) setToast({ kind: "error", text: ERRORS[err] || ERRORS.google });
      if (added || err) { params.delete("yt_channel"); params.delete("yt_error"); const q = params.toString(); window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`); }
    } catch {}
    void load();
    const onChange = (e: Event) => { setActiveId(String((e as CustomEvent).detail || getActiveChannelId())); void load(); };
    window.addEventListener(CHANNEL_EVENT, onChange);
    return () => window.removeEventListener(CHANNEL_EVENT, onChange);
  }, [load]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6500); return () => clearTimeout(t); }, [toast]);

  useEffect(() => {
    if (!open) return;
    // O topo usa backdrop-filter (prende position:fixed); o painel vai para o <body> via portal.
    const place = () => { const r = ref.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 10, right: Math.max(12, window.innerWidth - r.right) }); };
    place(); window.addEventListener("resize", place);
    const onDown = (e: MouseEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown); document.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("resize", place); document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const active = channels.find((c) => c.id === activeId) || null;

  async function pick(id: string) {
    if (id === activeId) { setOpen(false); return; }
    setBusy(id);
    try { await switchChannel(id); setActiveId(id); setOpen(false); setToast({ kind: "ok", text: `Agora você está vendo ${channels.find((c) => c.id === id)?.title || "o canal"}.` }); }
    finally { setBusy(""); }
  }
  async function add() {
    setBusy("add");
    try {
      if (await startChannelConnect()) return;
      await connectYouTube();
    } catch { setBusy(""); setToast({ kind: "error", text: ERRORS.google }); }
  }
  async function remove(id: string) {
    if (confirmRemove !== id) { setConfirmRemove(id); return; }
    setBusy(id); setConfirmRemove("");
    try { await disconnectChannel(id); await load(); } finally { setBusy(""); }
  }

  return <div className="tx-ch" ref={ref}>
    <button type="button" className={`tx-ch-trigger ${open ? "is-open" : ""}`} onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open} aria-label="Trocar canal do YouTube">
      {loading ? <span className="tx-ch-avatar is-empty is-loading" /> : <Avatar c={active} size={26} />}
      <span className="tx-ch-trigger-text"><small>Canal</small><b>{loading ? "Carregando…" : active?.title || (channels.length ? "Escolher canal" : "Conectar canal")}</b></span>
      <ChevronDown size={14} className="tx-ch-chevron" />
    </button>

    {open && mounted && createPortal(<div className="tx-ch tx-ch-layer">
      <button type="button" className="tx-ch-scrim" aria-label="Fechar" onClick={() => setOpen(false)} />
      <div ref={panelRef} className="tx-ch-panel" role="dialog" aria-label="Seus canais do YouTube" style={pos ? { top: pos.top, right: pos.right } : undefined}>
        <div className="tx-ch-head">
          <div><p className="tx-ch-kicker">SEUS CANAIS</p><h3>Escolha o <span className="tx-gold">canal</span> que o TubeX analisa</h3></div>
          <button type="button" className="tx-ch-close" onClick={() => setOpen(false)} aria-label="Fechar"><X size={16} /></button>
        </div>
        <ul className="tx-ch-list" role="listbox">
          {channels.map((c, i) => <li key={c.id} style={{ animationDelay: `${i * 40}ms` }}>
            <button type="button" role="option" aria-selected={c.id === activeId} className={`tx-ch-item ${c.id === activeId ? "is-active" : ""}`} onClick={() => void pick(c.id)} disabled={Boolean(busy)}>
              <Avatar c={c} size={36} />
              <span className="tx-ch-meta"><b>{c.title}</b><small>{c.customUrl || c.googleEmail || c.id}</small>{!c.hasRefresh && <em><AlertCircle size={11} />Reconecte para manter o acesso</em>}</span>
              {busy === c.id ? <Loader2 size={16} className="animate-spin" /> : c.id === activeId ? <span className="tx-ch-check"><Check size={13} /></span> : null}
            </button>
            {c.id !== activeId && <button type="button" className={`tx-ch-remove ${confirmRemove === c.id ? "is-confirm" : ""}`} onClick={() => void remove(c.id)} disabled={Boolean(busy)} aria-label={`Desconectar ${c.title}`}>{confirmRemove === c.id ? "Remover?" : <Trash2 size={14} />}</button>}
          </li>)}
          {!loading && !channels.length && <li className="tx-ch-empty"><Tv size={20} /><span>Nenhum canal salvo ainda. Conecte o canal que você quer analisar.</span></li>}
        </ul>
        <div className="tx-ch-foot">
          <button type="button" className="tx-btn-gold tx-ch-add" onClick={() => void add()} disabled={busy === "add"}>{busy === "add" ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}Adicionar outro canal</button>
          {active && !active.hasRefresh && <button type="button" className="tx-ch-ghost" onClick={() => void add()}><RefreshCw size={13} />Reconectar {active.title}</button>}
          <p>Na tela do Google, escolha seu e-mail e depois o <b>canal</b> (contas de marca aparecem na lista). Você continua logado na mesma conta TubeX.</p>
        </div>
      </div>
    </div>, document.body)}

    {toast && mounted && createPortal(<div className="tx-ch">{toast && <div className={`tx-ch-toast is-${toast.kind}`} role="status">{toast.kind === "ok" ? <Check size={15} /> : <AlertCircle size={15} />}<span>{toast.text}</span><button type="button" onClick={() => setToast(null)} aria-label="Fechar"><X size={13} /></button></div>}</div>, document.body)}
  </div>;
}
