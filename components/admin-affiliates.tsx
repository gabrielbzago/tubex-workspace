"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  DollarSign,
  RefreshCw,
  Users,
  Wallet,
  CheckCircle2,
  Clock3,
  XCircle,
  CreditCard,
  UserMinus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Lang = "pt-br" | "pt-pt" | "es" | "en";
const c = {
  "pt-br": {
    kicker:"TUBEX / ADMIN", title:"Controle de Afiliados", desc:"Controle afiliados, vendas, renovações, comissões, pagamentos e desistências.",
    refresh:"Atualizar", affiliates:"Afiliados",sales:"Vendas / renovações",pending:"Comissões pendentes",paid:"Total pago",revenue:"Receita gerada",generated:"Comissão gerada",active:"Indicações ativas",canceled:"Desistências",
    accounts:"Contas e saldos",affiliate:"Afiliado",code:"Código",pix:"PIX",open:"Pendente",paidCol:"Pago",action:"Ação",pay:"Dar baixa",paying:"Registrando...",none:"Nenhum afiliado encontrado.",
    monthly:"Resumo mensal",month:"Mês",commissions:"Comissões",failed:"Falhas",chargebacks:"Chargebacks",cancellations:"Desistências",
    salesTitle:"Vendas e renovações",date:"Data",customer:"Cliente",plan:"Plano",amount:"Valor",commission:"Comissão",status:"Status",invoice:"Invoice",
    referrals:"Indicações",refStatus:"Estado",history:"Histórico de pagamentos",paymentDate:"Data",value:"Valor",
    noSales:"Nenhuma venda registrada ainda.",noReferrals:"Nenhuma indicação registrada.",noPayouts:"Nenhum pagamento registrado.",
    confirm:"Confirmar pagamento de", success:"Pagamento registrado e vendas pendentes marcadas como pagas.", error:"Não foi possível concluir a operação."
  },
  "pt-pt": {
    kicker:"TUBEX / ADMIN", title:"Controlo de Afiliados", desc:"Controle afiliados, vendas, renovações, comissões, pagamentos e desistências.",
    refresh:"Atualizar", affiliates:"Afiliados",sales:"Vendas / renovações",pending:"Comissões pendentes",paid:"Total pago",revenue:"Receita gerada",generated:"Comissão gerada",active:"Indicações ativas",canceled:"Cancelamentos",
    accounts:"Contas e saldos",affiliate:"Afiliado",code:"Código",pix:"PIX",open:"Pendente",paidCol:"Pago",action:"Ação",pay:"Dar baixa",paying:"A registar...",none:"Nenhum afiliado encontrado.",
    monthly:"Resumo mensal",month:"Mês",commissions:"Comissões",failed:"Falhas",chargebacks:"Chargebacks",cancellations:"Cancelamentos",
    salesTitle:"Vendas e renovações",date:"Data",customer:"Cliente",plan:"Plano",amount:"Valor",commission:"Comissão",status:"Estado",invoice:"Invoice",
    referrals:"Indicações",refStatus:"Estado",history:"Histórico de pagamentos",paymentDate:"Data",value:"Valor",
    noSales:"Nenhuma venda registada.",noReferrals:"Nenhuma indicação registada.",noPayouts:"Nenhum pagamento registado.",
    confirm:"Confirmar pagamento de", success:"Pagamento registado e vendas pendentes marcadas como pagas.", error:"Não foi possível concluir a operação."
  },
  es: {
    kicker:"TUBEX / ADMIN", title:"Control de Afiliados", desc:"Controla afiliados, ventas, renovaciones, comisiones, pagos y cancelaciones.",
    refresh:"Actualizar", affiliates:"Afiliados",sales:"Ventas / renovaciones",pending:"Comisiones pendientes",paid:"Total pagado",revenue:"Ingresos generados",generated:"Comisión generada",active:"Referidos activos",canceled:"Cancelaciones",
    accounts:"Cuentas y saldos",affiliate:"Afiliado",code:"Código",pix:"PIX",open:"Pendiente",paidCol:"Pagado",action:"Acción",pay:"Marcar pagado",paying:"Registrando...",none:"No hay afiliados.",
    monthly:"Resumen mensual",month:"Mes",commissions:"Comisiones",failed:"Fallos",chargebacks:"Chargebacks",cancellations:"Cancelaciones",
    salesTitle:"Ventas y renovaciones",date:"Fecha",customer:"Cliente",plan:"Plan",amount:"Importe",commission:"Comisión",status:"Estado",invoice:"Invoice",
    referrals:"Referidos",refStatus:"Estado",history:"Historial de pagos",paymentDate:"Fecha",value:"Importe",
    noSales:"No hay ventas registradas.",noReferrals:"No hay referidos registrados.",noPayouts:"No hay pagos registrados.",
    confirm:"Confirmar pago de", success:"Pago registrado y ventas pendientes marcadas como pagadas.", error:"No se pudo completar la operación."
  },
  en: {
    kicker:"TUBEX / ADMIN", title:"Affiliate Control", desc:"Control affiliates, sales, renewals, commissions, payouts and cancellations.",
    refresh:"Refresh", affiliates:"Affiliates",sales:"Sales / renewals",pending:"Pending commissions",paid:"Total paid",revenue:"Revenue generated",generated:"Commission generated",active:"Active referrals",canceled:"Cancellations",
    accounts:"Accounts & balances",affiliate:"Affiliate",code:"Code",pix:"PIX",open:"Pending",paidCol:"Paid",action:"Action",pay:"Mark paid",paying:"Registering...",none:"No affiliates found.",
    monthly:"Monthly summary",month:"Month",commissions:"Commissions",failed:"Failures",chargebacks:"Chargebacks",cancellations:"Cancellations",
    salesTitle:"Sales & renewals",date:"Date",customer:"Customer",plan:"Plan",amount:"Amount",commission:"Commission",status:"Status",invoice:"Invoice",
    referrals:"Referrals",refStatus:"Status",history:"Payout history",paymentDate:"Date",value:"Amount",
    noSales:"No sales registered.",noReferrals:"No referrals registered.",noPayouts:"No payouts registered.",
    confirm:"Confirm payment of", success:"Payment registered and pending sales marked as paid.", error:"The operation could not be completed."
  }
} as const;

type Data = {
  summary: any;
  affiliates: any[];
  sales: any[];
  referrals: any[];
  payouts: any[];
  monthly: any[];
};

export default function AdminAffiliates() {
  const [lang, setLang] = useState<Lang>("pt-br");
  const [data, setData] = useState<Data>({ summary:{}, affiliates:[], sales:[], referrals:[], payouts:[], monthly:[] });
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const t = c[lang];

  useEffect(() => {
    const saved = localStorage.getItem("tubex-language") as Lang | null;
    if (saved && c[saved]) setLang(saved);
    const onLang = (event: Event) => {
      const next = (event as CustomEvent).detail as Lang;
      if (c[next]) setLang(next);
    };
    window.addEventListener("tubex-language-change", onLang);
    fetchData();
    return () => window.removeEventListener("tubex-language-change", onLang);
  }, []);

  async function fetchData() {
    setLoading(true);
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");

      const response = await fetch("/api/admin/affiliates", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao carregar painel.");

      setData({
        summary: payload.summary || {},
        affiliates: payload.affiliates || [],
        sales: payload.sales || [],
        referrals: payload.referrals || [],
        payouts: payload.payouts || [],
        monthly: payload.monthly || [],
      });
    } catch (error) {
      console.error("Admin affiliate load error:", error);
      setMessage(t.error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsPaid(affiliate: any) {
    const amount = Number(affiliate.affiliate_balance || 0);
    if (amount <= 0) return;
    if (!window.confirm(`${t.confirm} R$ ${amount.toFixed(2).replace(".", ",")} para ${affiliate.name || affiliate.email || "este afiliado"}?`)) return;

    setPayingId(affiliate.id);
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");

      const response = await fetch("/api/admin/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "mark_paid", affiliate_id: affiliate.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro no pagamento.");

      setMessage(t.success);
      await fetchData();
    } catch (error) {
      console.error("Admin payout error:", error);
      setMessage(t.error);
    } finally {
      setPayingId(null);
    }
  }

  const s = data.summary || {};
  const money = (v: any) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;

  return (
    <div className="space-y-6">
      <section className="tx-surface rounded-[22px] p-7 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2"><span className="tx-kicker">{t.kicker}</span><span className="rounded-md bg-[var(--tx-accent)] px-2 py-1 text-[8px] font-black text-[#11151a]">OWNER</span></div>
            <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">{t.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--tx-muted)]">{t.desc}</p>
          </div>
          <button onClick={fetchData} disabled={loading} className="tx-btn tx-btn-secondary"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/>{t.refresh}</button>
        </div>
        {message && <div className="mt-5 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-4 py-3 text-xs font-semibold text-[var(--tx-muted)]">{message}</div>}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat label={t.affiliates} value={String(s.affiliates || 0)} icon={<Users size={17}/>}/>
        <AdminStat label={t.sales} value={String(s.sales || 0)} icon={<BadgeCheck size={17}/>}/>
        <AdminStat label={t.pending} value={money(s.pendingCommission)} icon={<Clock3 size={17}/>}/>
        <AdminStat label={t.paid} value={money(s.paidCommission)} icon={<Wallet size={17}/>}/>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat label={t.revenue} value={money(s.revenue)} icon={<DollarSign size={17}/>}/>
        <AdminStat label={t.generated} value={money(s.commissionGenerated)} icon={<CreditCard size={17}/>}/>
        <AdminStat label={t.active} value={String(s.activeReferrals || 0)} icon={<Users size={17}/>}/>
        <AdminStat label={t.canceled} value={String(s.canceledReferrals || 0)} icon={<UserMinus size={17}/>}/>
      </div>

      <section className="tx-surface rounded-[20px] p-5 md:p-6">
        <SectionTitle kicker={t.accounts} title={t.accounts}/>
        {loading ? <Empty text="Carregando..." /> : data.affiliates.length === 0 ? <Empty text={t.none}/> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead><tr className="border-b border-[var(--tx-border)] text-[9px] font-black uppercase tracking-[.12em] text-[var(--tx-muted)]">
                <th className="px-3 py-3">{t.affiliate}</th><th className="px-3 py-3">{t.code}</th><th className="px-3 py-3">{t.pix}</th><th className="px-3 py-3">{t.open}</th><th className="px-3 py-3">{t.paidCol}</th><th className="px-3 py-3 text-right">{t.action}</th>
              </tr></thead>
              <tbody>{data.affiliates.map((a:any)=><tr key={a.id} className="border-b border-[var(--tx-border)] last:border-0">
                <td className="px-3 py-4"><p className="text-xs font-extrabold">{a.name || "—"}</p><p className="mt-1 text-[10px] text-[var(--tx-muted)]">{a.email || "—"}</p></td>
                <td className="px-3 py-4 text-xs font-bold">{a.affiliate_code || "—"}</td>
                <td className="px-3 py-4 text-xs text-[var(--tx-muted)]">{a.pix_key || "—"}</td>
                <td className="px-3 py-4 text-xs font-black text-[var(--tx-accent)]">{money(a.affiliate_balance)}</td>
                <td className="px-3 py-4 text-xs font-bold">{money(a.affiliate_paid)}</td>
                <td className="px-3 py-4 text-right"><button onClick={()=>markAsPaid(a)} disabled={payingId===a.id || Number(a.affiliate_balance||0)<=0} className="tx-btn tx-btn-primary disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 size={13}/>{payingId===a.id?t.paying:t.pay}</button></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tx-surface rounded-[20px] p-5 md:p-6">
        <SectionTitle kicker={t.monthly} title={t.monthly}/>
        {data.monthly.length===0 ? <Empty text={t.noSales}/> : <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left"><thead><tr className="border-b border-[var(--tx-border)] text-[9px] font-black uppercase tracking-[.12em] text-[var(--tx-muted)]"><th className="px-3 py-3">{t.month}</th><th className="px-3 py-3">{t.sales}</th><th className="px-3 py-3">{t.revenue}</th><th className="px-3 py-3">{t.commissions}</th><th className="px-3 py-3">{t.failed}</th><th className="px-3 py-3">{t.chargebacks}</th><th className="px-3 py-3">{t.cancellations}</th></tr></thead><tbody>{data.monthly.map((m:any)=><tr key={m.month} className="border-b border-[var(--tx-border)] last:border-0"><td className="px-3 py-4 text-xs font-bold">{m.month}</td><td className="px-3 py-4 text-xs">{m.sales}</td><td className="px-3 py-4 text-xs font-bold">{money(m.revenue)}</td><td className="px-3 py-4 text-xs font-black text-[var(--tx-accent)]">{money(m.commission)}</td><td className="px-3 py-4 text-xs">{m.failed}</td><td className="px-3 py-4 text-xs">{m.chargebacks}</td><td className="px-3 py-4 text-xs">{m.canceled}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="tx-surface rounded-[20px] p-5 md:p-6">
        <SectionTitle kicker={t.salesTitle} title={t.salesTitle}/>
        {data.sales.length===0 ? <Empty text={t.noSales}/> : <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left"><thead><tr className="border-b border-[var(--tx-border)] text-[9px] font-black uppercase tracking-[.12em] text-[var(--tx-muted)]"><th className="px-3 py-3">{t.date}</th><th className="px-3 py-3">{t.affiliate}</th><th className="px-3 py-3">{t.customer}</th><th className="px-3 py-3">{t.plan}</th><th className="px-3 py-3">{t.amount}</th><th className="px-3 py-3">{t.commission}</th><th className="px-3 py-3">{t.status}</th><th className="px-3 py-3">{t.invoice}</th></tr></thead><tbody>{data.sales.slice(0,200).map((x:any,i:number)=><tr key={x.id||i} className="border-b border-[var(--tx-border)] last:border-0"><td className="px-3 py-4 text-[10px] text-[var(--tx-muted)]">{x.last_payment_date?new Date(x.last_payment_date).toLocaleDateString():"—"}</td><td className="px-3 py-4 text-xs font-bold">{x.affiliate_code||"—"}</td><td className="px-3 py-4 text-xs">{x.customer_name||x.customer_email||"—"}</td><td className="px-3 py-4 text-xs">{String(x.plan||"—").toUpperCase()}</td><td className="px-3 py-4 text-xs font-bold">{money(x.amount)}</td><td className="px-3 py-4 text-xs font-black text-[var(--tx-accent)]">{money(x.commission_amount??x.commission)}</td><td className="px-3 py-4 text-xs font-semibold">{x.status||"—"}</td><td className="px-3 py-4 text-[10px] text-[var(--tx-muted)]">{x.stripe_invoice_id||"—"}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="tx-surface rounded-[20px] p-5 md:p-6">
        <SectionTitle kicker={t.referrals} title={t.referrals}/>
        {data.referrals.length===0 ? <Empty text={t.noReferrals}/> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead><tr className="border-b border-[var(--tx-border)] text-[9px] font-black uppercase tracking-[.12em] text-[var(--tx-muted)]"><th className="px-3 py-3">{t.affiliate}</th><th className="px-3 py-3">{t.customer}</th><th className="px-3 py-3">{t.plan}</th><th className="px-3 py-3">{t.refStatus}</th><th className="px-3 py-3">{t.date}</th></tr></thead><tbody>{data.referrals.slice(0,200).map((x:any,i:number)=><tr key={x.id||i} className="border-b border-[var(--tx-border)] last:border-0"><td className="px-3 py-4 text-xs font-bold">{x.affiliate_code||"—"}</td><td className="px-3 py-4 text-xs">{x.referred_name||x.referred_email||"—"}</td><td className="px-3 py-4 text-xs">{String(x.plan||"—").toUpperCase()}</td><td className="px-3 py-4 text-xs font-semibold">{x.status||"—"}</td><td className="px-3 py-4 text-[10px] text-[var(--tx-muted)]">{x.updated_at?new Date(x.updated_at).toLocaleDateString():"—"}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="tx-surface rounded-[20px] p-5 md:p-6">
        <SectionTitle kicker={t.history} title={t.history}/>
        {data.payouts.length===0 ? <Empty text={t.noPayouts}/> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead><tr className="border-b border-[var(--tx-border)] text-[9px] font-black uppercase tracking-[.12em] text-[var(--tx-muted)]"><th className="px-3 py-3">{t.paymentDate}</th><th className="px-3 py-3">{t.affiliate}</th><th className="px-3 py-3">{t.value}</th><th className="px-3 py-3">{t.status}</th></tr></thead><tbody>{data.payouts.slice(0,200).map((x:any,i:number)=><tr key={x.id||i} className="border-b border-[var(--tx-border)] last:border-0"><td className="px-3 py-4 text-[10px] text-[var(--tx-muted)]">{x.created_at?new Date(x.created_at).toLocaleDateString():"—"}</td><td className="px-3 py-4 text-xs font-bold">{x.affiliate_code || "—"}</td><td className="px-3 py-4 text-xs font-black">{money(x.amount)}</td><td className="px-3 py-4 text-xs">{x.status||"—"}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}

function SectionTitle({ kicker, title }: { kicker:string; title:string }) {
  return <div className="mb-5"><p className="tx-kicker">{kicker}</p><h2 className="mt-1 text-xl font-black">{title}</h2></div>;
}
function Empty({ text }: { text:string }) {
  return <div className="rounded-xl border border-dashed border-[var(--tx-border)] p-10 text-center text-sm text-[var(--tx-muted)]">{text}</div>;
}
function AdminStat({ label, value, icon }: { label:string; value:string; icon:React.ReactNode }) {
  return <div className="tx-surface rounded-[18px] p-5"><div className="flex items-center justify-between"><span className="text-[9px] font-black uppercase tracking-[.13em] text-[var(--tx-muted)]">{label}</span><span className="text-[var(--tx-accent)]">{icon}</span></div><p className="mt-4 text-xl font-black">{value}</p></div>;
}
