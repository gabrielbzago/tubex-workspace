"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  DollarSign,
  Users,
  MousePointerClick,
  TrendingUp,
  Gift,
  Check,
  Wallet,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Lang = "pt-br" | "pt-pt" | "es" | "en";
const copy = {
  "pt-br": {
    kicker:"TUBEX / AFILIADOS", title:"Programa de Afiliados", desc:"Compartilhe o TubeX e acompanhe suas vendas e comissões recorrentes.",
    copy:"Copiar link",copied:"Copiado",earned:"Ganhos acumulados",open:"Em aberto para pagamento",sales:"Vendas",clicks:"Cliques",conversion:"Conversão",
    pix:"Dados PIX",pixDesc:"Use estes dados para receber suas comissões.",cpf:"CPF",pixType:"Tipo PIX",pixKey:"Chave PIX",save:"Salvar dados",saved:"Dados salvos.",
    history:"Histórico",historyTitle:"Vendas indicadas",date:"Data",commission:"Comissão",status:"Status",empty:"Nenhuma venda registrada ainda.",
    activate:"Ative seu programa de afiliados",activateDesc:"Gere seu código único para começar a indicar o TubeX e receber comissões recorrentes.",generate:"Gerar meu código",generating:"Gerando...",codeCreated:"Código criado e vinculado permanentemente à sua conta. Para solicitar alteração, entre em contato com o suporte.",locked:"Seu código é único e não pode ser alterado pelo painel. Se precisar de uma correção, fale com o suporte.",clickNote:"O rastreamento de cliques ainda não está habilitado.",loadError:"Não foi possível carregar seus dados de afiliado."
  },
  "pt-pt": {
    kicker:"TUBEX / AFILIADOS", title:"Programa de Afiliados", desc:"Partilhe o TubeX e acompanhe vendas e comissões recorrentes.",
    copy:"Copiar link",copied:"Copiado",earned:"Ganhos acumulados",open:"Em aberto para pagamento",sales:"Vendas",clicks:"Cliques",conversion:"Conversão",
    pix:"Dados PIX",pixDesc:"Use estes dados para receber as suas comissões.",cpf:"NIF/CPF",pixType:"Tipo PIX",pixKey:"Chave PIX",save:"Guardar dados",saved:"Dados guardados.",
    history:"Histórico",historyTitle:"Vendas indicadas",date:"Data",commission:"Comissão",status:"Estado",empty:"Nenhuma venda registada.",
    activate:"Ative o seu programa de afiliados",activateDesc:"Gere o seu código único para começar a indicar o TubeX e receber comissões recorrentes.",generate:"Gerar o meu código",generating:"A gerar...",codeCreated:"Código criado e associado permanentemente à sua conta. Para solicitar alteração, contacte o suporte.",locked:"O seu código é único e não pode ser alterado no painel. Contacte o suporte se precisar de uma correção.",clickNote:"O rastreamento de cliques ainda não está habilitado.",loadError:"Não foi possível carregar os seus dados de afiliado."
  },
  es: {
    kicker:"TUBEX / AFILIADOS", title:"Programa de Afiliados", desc:"Comparte TubeX y controla tus ventas y comisiones recurrentes.",
    copy:"Copiar enlace",copied:"Copiado",earned:"Ganancias acumuladas",open:"Pendiente de pago",sales:"Ventas",clicks:"Clics",conversion:"Conversión",
    pix:"Datos PIX",pixDesc:"Usa estos datos para recibir tus comisiones.",cpf:"CPF",pixType:"Tipo PIX",pixKey:"Clave PIX",save:"Guardar datos",saved:"Datos guardados.",
    history:"Historial",historyTitle:"Ventas referidas",date:"Fecha",commission:"Comisión",status:"Estado",empty:"Aún no hay ventas registradas.",
    activate:"Activa tu programa de afiliados",activateDesc:"Genera tu código único para empezar a recomendar TubeX y recibir comisiones recurrentes.",generate:"Generar mi código",generating:"Generando...",codeCreated:"Código creado y vinculado permanentemente a tu cuenta. Contacta con soporte para solicitar un cambio.",locked:"Tu código es único y no se puede cambiar desde el panel. Contacta con soporte si necesitas una corrección.",clickNote:"El seguimiento de clics aún no está habilitado.",loadError:"No se pudieron cargar tus datos de afiliado."
  },
  en: {
    kicker:"TUBEX / AFFILIATES", title:"Affiliate Program", desc:"Share TubeX and track your sales and recurring commissions.",
    copy:"Copy link",copied:"Copied",earned:"Total earnings",open:"Open for payment",sales:"Sales",clicks:"Clicks",conversion:"Conversion",
    pix:"PIX details",pixDesc:"Use these details to receive your commissions.",cpf:"CPF",pixType:"PIX type",pixKey:"PIX key",save:"Save details",saved:"Details saved.",
    history:"History",historyTitle:"Referred sales",date:"Date",commission:"Commission",status:"Status",empty:"No sales registered yet.",
    activate:"Activate your affiliate program",activateDesc:"Generate your unique code to start referring TubeX and earning recurring commissions.",generate:"Generate my code",generating:"Generating...",codeCreated:"Your code has been created and permanently linked to your account. Contact support to request a change.",locked:"Your code is unique and cannot be changed from the dashboard. Contact support if a correction is needed.",clickNote:"Click tracking is not enabled yet.",loadError:"Could not load your affiliate data."
  }
} as const;

export default function AffiliatePage({ userData }: { userData: any }) {
  const [lang, setLang] = useState<Lang>("pt-br");
  const [sales, setSales] = useState<any[]>([]);
  const [state, setState] = useState<any>(userData || {});
  const [paid, setPaid] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [open, setOpen] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const t = copy[lang];
  const code = String(state?.affiliate_code || userData?.affiliate_code || "").trim().toUpperCase();
  const link = code ? `https://www.tubexai.com.br/r/${encodeURIComponent(code)}` : "";

  useEffect(() => {
    const saved = localStorage.getItem("tubex-language") as Lang | null;
    if (saved && copy[saved]) setLang(saved);
    const onLang = (event: Event) => {
      const next = (event as CustomEvent).detail as Lang;
      if (copy[next]) setLang(next);
    };
    window.addEventListener("tubex-language-change", onLang);
    return () => window.removeEventListener("tubex-language-change", onLang);
  }, []);

  useEffect(() => {
    setState(userData || {});
    if (userData?.id) load();
  }, [userData?.id, code]);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");
      const response = await fetch("/api/affiliate", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t.loadError);
      setSales(payload.sales || []);
      setOpen(Number(payload.user?.affiliate_balance || 0));
      setPaid(Number(payload.user?.affiliate_paid || 0));
      setClicks(Number(payload.clicks || 0));
      setState((prev: any) => ({ ...prev, ...(payload.user || {}) }));
    } catch (error) {
      console.error("Affiliate load error:", error);
      setMessage(t.loadError);
    } finally {
      setLoading(false);
    }
  }

  const earned = useMemo(() => paid + open, [paid, open]);

  async function generateCode() {
    if (!userData?.id || userData?.affiliate_code || loading) return;
    setLoading(true);
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");
      const response = await fetch("/api/affiliate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t.loadError);
      setState((prev: any) => ({ ...prev, affiliate_code: payload.affiliate_code }));
      setMessage(t.codeCreated);
    } catch (error) {
      console.error("Affiliate code error:", error);
      setMessage(t.loadError);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function save() {
    if (!userData?.id) return;
    setMessage("");
    const { error } = await supabase
      .from("users")
      .update({
        cpf: state.cpf || null,
        pix_type: state.pix_type || null,
        pix_key: state.pix_key || null,
      })
      .eq("id", userData.id);

    setMessage(error ? t.loadError : t.saved);
  }

  return (
    <div className="space-y-5">
      <section className="tx-surface overflow-hidden rounded-[22px] p-7 md:p-8">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="tx-kicker">{t.kicker}</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">{t.title}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--tx-muted)]">{t.desc}</p>
          </div>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--tx-accent-soft)] text-[var(--tx-accent)]">
            <Gift size={21} />
          </div>
        </div>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <div className="flex min-h-11 flex-1 items-center rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-4 text-xs text-[var(--tx-muted)] break-all">
            {link || "Gere seu código de afiliado para começar."}
          </div>
          <button onClick={copyLink} disabled={!link} className="tx-btn tx-btn-primary disabled:opacity-40">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t.copied : t.copy}
          </button>
        </div>
      </section>

      {!code ? (
        <section className="tx-surface rounded-[20px] p-6">
          <p className="tx-kicker">ATIVAÇÃO</p>
          <h2 className="mt-1 text-xl font-black">{t.activate}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--tx-muted)]">{t.activateDesc}</p>
          <button onClick={generateCode} disabled={loading} className="tx-btn tx-btn-primary mt-5">
            {loading ? t.generating : t.generate}
          </button>
          <p className="mt-3 text-[11px] leading-5 text-[var(--tx-muted)]">Atenção: o código é gerado uma única vez e fica vinculado à sua conta. Para qualquer alteração posterior, será necessário solicitar ao suporte.</p>
        </section>
      ) : (
        <div className="rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-4 py-3 text-xs leading-5 text-[var(--tx-muted)]">
          <strong className="text-[var(--tx-text)]">Código permanente.</strong> {t.locked}
        </div>
      )}

      {message && <div className="tx-surface rounded-xl px-4 py-3 text-xs font-semibold text-[var(--tx-muted)]">{message}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label={t.earned} value={`R$ ${earned.toFixed(2).replace(".", ",")}`} icon={<DollarSign size={16} />} />
        <Metric label={t.open} value={`R$ ${open.toFixed(2).replace(".", ",")}`} icon={<Wallet size={16} />} />
        <Metric label={t.sales} value={sales.filter((s) => String(s.status).toLowerCase() !== "failed").length} icon={<Users size={16} />} />
        <Metric label={t.clicks} value={clicks} icon={<MousePointerClick size={16} />} />
        <Metric label={t.conversion} value={`${sales.length && clicks ? ((sales.length / clicks) * 100).toFixed(1).replace(".", ",") : "0,0"}%`} icon={<TrendingUp size={16} />} />
      </div>
      <p className="text-[10px] text-[var(--tx-muted)]">Cliques únicos registrados por visitante/dia. A conversão considera assinaturas registradas divididas pelos cliques.</p>

      <section className="tx-surface rounded-[22px] p-7">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--tx-accent-soft)] text-[var(--tx-accent)]"><Wallet size={17} /></div>
          <div><p className="tx-kicker">RECEBIMENTO</p><h2 className="mt-1 text-xl font-black">{t.pix}</h2><p className="mt-1 text-xs text-[var(--tx-muted)]">{t.pixDesc}</p></div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label={t.cpf} value={state.cpf || ""} onChange={(v) => setState({ ...state, cpf: v })} />
          <label className="grid gap-2"><span className="text-[10px] font-bold text-[var(--tx-muted)]">{t.pixType}</span><select value={state.pix_type || "cpf"} onChange={(e) => setState({ ...state, pix_type: e.target.value })} className="h-11 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-3 text-xs outline-none"><option value="cpf">CPF</option><option value="email">E-mail</option><option value="phone">Telefone</option><option value="random">Aleatória</option></select></label>
          <div className="md:col-span-2"><Field label={t.pixKey} value={state.pix_key || ""} onChange={(v) => setState({ ...state, pix_key: v })} /></div>
        </div>
        <button onClick={save} className="tx-btn tx-btn-primary mt-5">{t.save}</button>
      </section>

      <section className="tx-surface overflow-hidden rounded-[22px]">
        <div className="flex items-center justify-between border-b border-[var(--tx-border)] p-6">
          <div><p className="tx-kicker">{t.history}</p><h2 className="mt-1 text-xl font-black">{t.historyTitle}</h2></div>
          <button onClick={load} disabled={loading} className="tx-btn tx-btn-secondary"><RefreshCw size={13} className={loading ? "animate-spin" : ""}/></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--tx-surface-2)] text-[var(--tx-muted)]"><tr><th className="px-6 py-3">{t.date}</th><th className="px-6 py-3">{t.commission}</th><th className="px-6 py-3">{t.status}</th></tr></thead>
            <tbody>{sales.length ? sales.map((s, i) => (
              <tr key={s.id || i} className="border-t border-[var(--tx-border)]">
                <td className="px-6 py-4">{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</td>
                <td className="px-6 py-4 font-bold">R$ {Number(s.commission_amount || s.commission || 0).toFixed(2).replace(".", ",")}</td>
                <td className="px-6 py-4 font-semibold">{s.status || "pending"}</td>
              </tr>
            )) : <tr><td colSpan={3} className="px-6 py-12 text-center text-[var(--tx-muted)]">{t.empty}</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return <div className="tx-surface rounded-[18px] p-5"><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[.12em] text-[var(--tx-muted)]">{label}</span><span className="text-[var(--tx-accent)]">{icon}</span></div><p className="mt-4 text-2xl font-black">{value}</p></div>;
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="grid gap-2"><span className="text-[10px] font-bold text-[var(--tx-muted)]">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-3 text-xs outline-none focus:border-[var(--tx-accent)]" /></label>;
}
