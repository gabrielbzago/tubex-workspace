"use client";
import { useEffect, useState } from "react";

/** Boas-vindas animada exibida uma vez por sessão, logo após o login. */
export default function WelcomeSplash({ name, userId }: { name: string; userId: string }) {
  const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");
  useEffect(() => {
    const key = `tubex-welcome:${userId}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { return; }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setPhase("in");
    const t1 = setTimeout(() => setPhase("out"), reduce ? 900 : 1900);
    const t2 = setTimeout(() => setPhase("hidden"), reduce ? 1100 : 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [userId]);
  if (phase === "hidden") return null;
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(new Date()));
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return (
    <div className={`tx-welcome ${phase === "out" ? "is-out" : ""}`} onClick={() => setPhase("out")} role="status" aria-live="polite">
      <div className="tx-welcome-inner">
        <img src="/icon.png" alt="" className="tx-welcome-logo" />
        <p className="tx-welcome-kicker">TubeX Creator Studio</p>
        <h1>{greet}, <span className="tx-gold">{name.split(" ")[0]}</span></h1>
        <p className="tx-welcome-sub">Preparando seu painel…</p>
        <div className="tx-welcome-bar"><span /></div>
      </div>
    </div>
  );
}
