"use client";
import "./tubex-session.css";
import { useEffect, useState } from "react";
import { LogIn, Loader2, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { reloginWithGoogle } from "@/lib/tubex-session";

/**
 * Aviso de "entre novamente". Aparece só quando a renovação automática é impossível
 * (refresh token do site ou do Google revogado). A tela de fundo (ex.: o chat) continua visível
 * e nada é apagado: os chats ficam salvos no navegador.
 */
export default function SessionRelogin({ email, reason, onEmailLogin }: { email: string; reason: "session" | "google"; onEmailLogin: () => void }) {
  const [busy, setBusy] = useState<"" | "google" | "email">("");
  const [error, setError] = useState("");
  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; }, []);

  async function google() {
    setBusy("google"); setError("");
    const { error } = await reloginWithGoogle(email);
    if (error) { setBusy(""); setError("Não foi possível abrir o login do Google. Tente de novo."); }
  }
  async function withEmail() {
    setBusy("email");
    try { sessionStorage.setItem("tubex-logging-out", "1"); await supabase.auth.signOut({ scope: "local" }); } catch {}
    onEmailLogin();
  }

  return <div className="tx-relogin" role="dialog" aria-modal="true" aria-labelledby="tx-relogin-title">
    <div className="tx-relogin-scrim" />
    <div className="tx-relogin-card">
      <span className="tx-relogin-icon"><ShieldCheck size={22} /></span>
      <p className="tx-relogin-kicker">SESSÃO DO TUBEX</p>
      <h2 id="tx-relogin-title">Entre <span className="tx-gold">novamente</span> para continuar</h2>
      <p className="tx-relogin-text">{reason === "google"
        ? "O Google encerrou o acesso do TubeX ao seu canal (por exemplo, a permissão foi removida na sua conta Google). Entre de novo e o acesso volta a ser renovado sozinho."
        : "Sua sessão no TubeX terminou neste navegador. Entre de novo para continuar de onde parou."}</p>
      <p className="tx-relogin-note">Seus chats, pesquisas e canais continuam salvos.</p>
      <div className="tx-relogin-actions">
        <button type="button" className="tx-btn-gold" onClick={() => void google()} disabled={Boolean(busy)}>{busy === "google" ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}Entrar com Google</button>
        <button type="button" className="tx-relogin-ghost" onClick={() => void withEmail()} disabled={Boolean(busy)}>{busy === "email" ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}Entrar com e-mail e senha</button>
      </div>
      {email && <p className="tx-relogin-email">Conta: <b>{email}</b></p>}
      {error && <p className="tx-relogin-error" role="alert">{error}</p>}
    </div>
  </div>;
}
