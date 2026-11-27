"use client";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Sparkles, X, ArrowRight } from "lucide-react";

/**
 * Destaque do TubeX AI exibido logo após o login (uma vez por sessão),
 * até a pessoa abrir o chat pela primeira vez. Aponta para o item "TubeX AI"
 * da barra lateral (desktop) ou da barra inferior (mobile).
 */
type Pos = { mode: "side" | "bottom"; top: number; left: number; arrow: number; ring: { top: number; left: number; width: number; height: number } };

const PROMPTS = [
 "Me dê 5 ideias de vídeo para o meu canal",
 "Crie 3 títulos chamativos para meu próximo vídeo",
 "Analise o desempenho dos meus últimos vídeos",
];

export default function AIChatSpotlight({ tab, userId, onOpen }: { tab: string; userId: string; onOpen: () => void }) {
 const doneKey = `tubex-ai-discovered:${userId || "anon"}`;
 const seenKey = `tubex-ai-spotlight:${userId || "anon"}`;
 const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");
 const [pos, setPos] = useState<Pos | null>(null);

 // Quem já abriu o chat não vê mais o destaque; enquanto não abriu, o item do menu ganha brilho dourado.
 useEffect(() => {
  let done = false;
  try { done = !!localStorage.getItem(doneKey); } catch {}
  if (tab === "ai") { try { localStorage.setItem(doneKey, "1"); } catch {} done = true; }
  document.documentElement.classList.toggle("tx-ai-undiscovered", !done);
  if (done && phase === "in") setPhase("out");
 }, [tab, doneKey]); // eslint-disable-line react-hooks/exhaustive-deps

 useEffect(() => {
  try { if (localStorage.getItem(doneKey) || sessionStorage.getItem(seenKey)) return; } catch { return; }
  // Espera a animação de boas-vindas terminar antes de aparecer.
  const timer = setTimeout(() => {
   try { if (localStorage.getItem(doneKey)) return; sessionStorage.setItem(seenKey, "1"); } catch {}
   setPhase("in");
  }, 2900);
  return () => clearTimeout(timer);
 }, [doneKey, seenKey]);

 const measure = useCallback(() => {
  const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-tx-ai-target]"));
  const el = targets.find(t => { const r = t.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight; });
  if (!el) { setPos(null); return; }
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const ring = { top: r.top - 4, left: r.left - 4, width: r.width + 8, height: r.height + 8 };
  const inBottomNav = !!el.closest(".tx-bottom-nav");
  if (inBottomNav) {
   const w = Math.min(360, vw - 32);
   const cx = r.left + r.width / 2;
   const left = Math.max(16, Math.min(vw - 16 - w, cx - w / 2));
   setPos({ mode: "bottom", top: vh - r.top + 14, left, arrow: Math.max(22, Math.min(w - 22, cx - left)), ring });
  } else {
   const top = Math.max(16, Math.min(vh - 300, r.top + r.height / 2 - 46));
   setPos({ mode: "side", top, left: r.right + 18, arrow: r.top + r.height / 2 - top, ring });
  }
 }, []);

 useLayoutEffect(() => {
  if (phase === "hidden") return;
  measure();
  window.addEventListener("resize", measure);
  window.addEventListener("scroll", measure, true);
  return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
 }, [phase, measure]);

 const close = useCallback(() => setPhase("out"), []);
 useEffect(() => {
  if (phase !== "in") return;
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
 }, [phase, close]);
 useEffect(() => { if (phase === "out") { const t = setTimeout(() => setPhase("hidden"), 320); return () => clearTimeout(t); } }, [phase]);

 const open = (prompt?: string) => {
  if (prompt) { try { sessionStorage.setItem("tubex-ai-prefill", prompt); } catch {} }
  close(); onOpen();
 };

 if (phase === "hidden" || !pos || tab === "ai") return null;
 const style = pos.mode === "side"
  ? { top: pos.top, left: pos.left, ["--tx-spot-arrow" as any]: `${pos.arrow}px` }
  : { bottom: pos.top, left: pos.left, width: Math.min(360, window.innerWidth - 32), ["--tx-spot-arrow" as any]: `${pos.arrow}px` };

 return <>
  <div className={`tx-ai-spot-ring ${phase === "out" ? "is-out" : ""}`} style={pos.ring} aria-hidden="true" />
  <div className={`tx-ai-spot is-${pos.mode} ${phase === "out" ? "is-out" : ""}`} style={style} role="dialog" aria-labelledby="tx-ai-spot-title" aria-describedby="tx-ai-spot-desc">
   <span className="tx-ai-spot-arrow" aria-hidden="true" />
   <button className="tx-ai-spot-close" onClick={close} aria-label="Fechar destaque"><X size={14} /></button>
   <p className="tx-ai-spot-kicker"><span className="tx-ai-spot-icon"><Sparkles size={13} /></span>Seu copiloto de IA</p>
   <h2 id="tx-ai-spot-title">Este é só o seu painel. A inteligência mora no <span className="tx-gold">TubeX AI</span>.</h2>
   <p id="tx-ai-spot-desc" className="tx-ai-spot-desc">Converse com a IA para criar títulos, roteiros, ideias e analisar o seu canal.</p>
   <div className="tx-ai-spot-prompts">{PROMPTS.map(p => <button key={p} onClick={() => open(p)}>{p}<ArrowRight size={12} /></button>)}</div>
   <div className="tx-ai-spot-actions">
    <button className="tx-ai-spot-cta" onClick={() => open()}><Sparkles size={15} />Abrir o TubeX AI</button>
    <button className="tx-ai-spot-later" onClick={close}>Agora não</button>
   </div>
  </div>
 </>;
}
