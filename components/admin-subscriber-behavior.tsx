"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Activity, AlertTriangle, CheckCircle2, Clock3, RefreshCw, Search, UserRoundX, Users } from "lucide-react";

type ModuleUsage = { key: string; name: string; count: number; lastUsedAt: string };
type UsageSession = { id: string; startedAt: string; lastActivityAt: string; actions: number; modules: { name: string; count: number }[] };
type PaymentEvent = { eventName: string; label: string; at: string; plan: string | null; source: string | null };
type Subscriber = {
  id: string; name: string; email: string; plan: string; status: "active" | "at_risk" | "canceled";
  createdAt: string | null; subscribedAt: string | null; canceledAt: string | null; cancelReason: string | null;
  firstLoginAt: string | null; lastLoginAt: string | null; lastActivityAt: string | null; lastResource: string | null;
  loginCount: number; returned: boolean; returnCount: number; activeDays: number; activeDays30: number; searchCount: number;
  totalActions: number; actions30: number; highUse: boolean; modules: ModuleUsage[]; sessions: UsageSession[]; paymentJourney: PaymentEvent[];
};
const fmt = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Sem registro";
const n = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
const statusCopy = { active: "Ativo", at_risk: "Em risco", canceled: "Cancelado" };

export default function AdminSubscriberBehavior() {
  const [accounts, setAccounts] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Entre novamente.");
      const response = await fetch("/api/admin/behavior", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error === "forbidden" ? "Acesso restrito ao proprietário." : "Não foi possível carregar o comportamento dos assinantes.");
      setAccounts(payload.accounts || []);
    } catch (reason: any) { setError(reason.message || "Falha ao carregar os dados."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => ({
    active: accounts.filter((row) => row.status === "active").length,
    at_risk: accounts.filter((row) => row.status === "at_risk").length,
    canceled: accounts.filter((row) => row.status === "canceled").length,
  }), [accounts]);
  const visible = useMemo(() => accounts.filter((row) => {
    const matchesFilter = filter === "all" || row.status === filter;
    const text = `${row.name} ${row.email} ${row.plan}`.toLowerCase();
    return matchesFilter && (!query || text.includes(query.toLowerCase()));
  }), [accounts, filter, query]);
  const selected = accounts.find((row) => row.id === selectedId) || null;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="tx-kicker">OWNER · RETENÇÃO E USO</p><h1 className="mt-2 text-3xl font-black">Comportamento do Assinante</h1><p className="mt-1 text-sm text-[var(--tx-muted)]">Logins, retorno, consultas SEO e recursos usados por conta.</p></div><button onClick={() => void load()} className="tx-btn tx-btn-secondary"><RefreshCw size={14}/> Atualizar</button></header>
    <div className="grid gap-3 sm:grid-cols-3">
      {([ ["active", "Ativo", CheckCircle2, "Uso regular nos últimos 30 dias"], ["at_risk", "Em risco", AlertTriangle, "Sem uso regular recente"], ["canceled", "Cancelado", UserRoundX, "Assinatura encerrada"] ] as const).map(([key, title, Icon, description]) => <button key={key} onClick={() => setFilter(filter === key ? "all" : key)} className={`tx-surface rounded-2xl p-5 text-left transition ${filter === key ? "ring-2 ring-[var(--tx-accent)]" : ""}`}><div className="flex items-center justify-between text-[var(--tx-muted)]"><span className="text-xs font-bold">{title}</span><Icon size={17}/></div><p className="mt-3 text-3xl font-black">{n(counts[key])}</p><p className="mt-1 text-xs text-[var(--tx-muted)]">{description}</p></button>)}
    </div>
    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    <section className="tx-surface rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Contas assinantes</h2><p className="mt-1 text-xs text-[var(--tx-muted)]">Logins são autenticações. Atividade e módulos são agrupados por dia e não significam um novo login.</p></div><label className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx-muted)]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome ou e-mail" className="w-full rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] py-2 pl-9 pr-3 text-xs sm:w-64"/></label></div>
      {loading ? <div className="p-8 text-center text-sm text-[var(--tx-muted)]">Carregando histórico de uso…</div> : visible.length ? <div className="overflow-auto rounded-xl border border-[var(--tx-border)]"><table className="w-full min-w-[1020px] text-left text-xs"><thead className="bg-[var(--tx-surface-2)] text-[var(--tx-muted)]"><tr>{["Assinante", "Indicador", "Primeiro login", "Último login", "Última atividade", "Consultas SEO", "Uso nos últimos 30 dias"].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{visible.map((row) => <tr key={row.id} onClick={() => setSelectedId(selectedId === row.id ? null : row.id)} className="cursor-pointer border-t border-[var(--tx-border)] hover:bg-[var(--tx-surface-2)]"><td className="px-3 py-3"><div className="font-bold">{row.name}</div><div className="mt-1 text-[var(--tx-muted)]">{row.email} · {row.plan}</div></td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 font-bold ${row.status === "active" ? "bg-emerald-500/10 text-emerald-600" : row.status === "at_risk" ? "bg-amber-500/10 text-amber-600" : "bg-rose-500/10 text-rose-600"}`}>{statusCopy[row.status]}</span></td><td className="whitespace-nowrap px-3 py-3">{fmt(row.firstLoginAt)}</td><td className="whitespace-nowrap px-3 py-3">{fmt(row.lastLoginAt)}</td><td className="whitespace-nowrap px-3 py-3">{fmt(row.lastActivityAt)}<div className="mt-1 text-[var(--tx-muted)]">{row.lastResource || "Recurso não identificado"}</div></td><td className="px-3 py-3 font-bold">{n(row.searchCount)}</td><td className="px-3 py-3"><span className="font-bold">{row.highUse ? "Alto" : "Regular"}</span><div className="mt-1 text-[var(--tx-muted)]">{n(row.actions30)} ações · {n(row.activeDays30)} dias · {row.returned ? "voltou" : "sem retorno registrado"}</div></td></tr>)}</tbody></table></div> : <p className="rounded-xl bg-[var(--tx-surface-2)] p-5 text-sm text-[var(--tx-muted)]">{accounts.length ? "Nenhuma conta corresponde aos filtros." : "Ainda não há contas assinantes identificadas."}</p>}
    </section>
    {selected && <section className="tx-surface rounded-2xl p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="tx-kicker">DETALHE DA CONTA</p><h2 className="mt-2 text-xl font-black">{selected.name}</h2><p className="text-sm text-[var(--tx-muted)]">{selected.email} · {selected.plan}</p></div><div className="flex gap-2 text-xs"><span className="rounded-full bg-[var(--tx-surface-2)] px-3 py-2"><Users className="mr-1 inline" size={13}/>{n(selected.loginCount)} logins</span><span className="rounded-full bg-[var(--tx-surface-2)] px-3 py-2"><Activity className="mr-1 inline" size={13}/>{n(selected.activeDays)} dias ativos</span></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["Cadastro", selected.createdAt], ["Contratação", selected.subscribedAt], ["Primeiro login", selected.firstLoginAt], ["Último login", selected.lastLoginAt], ["Última atividade", selected.lastActivityAt]].map(([title, value]) => <div key={title} className="rounded-xl bg-[var(--tx-surface-2)] p-3"><p className="text-[10px] font-bold text-[var(--tx-muted)]">{title}</p><p className="mt-1 text-xs font-semibold">{fmt(value as string | null)}</p></div>)}</div>
      {selected.canceledAt && <p className="mt-3 rounded-xl bg-rose-500/10 p-3 text-xs"><b>Cancelamento:</b> {fmt(selected.canceledAt)} · {selected.cancelReason || "Motivo não informado"}</p>}
      <h3 className="mb-3 mt-6 text-sm font-black">Jornada de assinatura e pagamentos</h3><div className="mb-3 grid gap-2 sm:grid-cols-3">{[["Cliques para assinar", selected.paymentJourney.filter((event) => event.eventName === "upgrade_clicked").length], ["Checkouts iniciados", selected.paymentJourney.filter((event) => event.eventName === "checkout_started").length], ["Assinaturas confirmadas", selected.paymentJourney.filter((event) => event.eventName === "subscription_activated").length]].map(([title, value]) => <div key={title} className="rounded-xl bg-[var(--tx-surface-2)] p-3"><p className="text-[10px] font-bold text-[var(--tx-muted)]">{title}</p><p className="mt-1 text-xl font-black">{n(value as number)}</p></div>)}</div>{selected.paymentJourney.length ? <div className="space-y-2">{selected.paymentJourney.map((event, index) => <div key={`${event.eventName}:${event.at}:${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--tx-border)] p-3"><div><p className="text-xs font-bold">{event.label}{event.plan ? ` · ${event.plan}` : ""}</p><p className="mt-1 text-[10px] text-[var(--tx-muted)]">{fmt(event.at)}{event.source ? ` · ${event.source}` : ""}</p></div></div>)}</div> : <p className="text-xs text-[var(--tx-muted)]">Nenhum clique de plano ou evento de checkout foi registrado para esta conta.</p>}
      <h3 className="mb-3 mt-5 text-sm font-black">Módulos usados</h3>{selected.modules.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{selected.modules.map((module) => <div key={module.key} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--tx-border)] p-3"><span className="text-xs font-semibold">{module.name}<span className="mt-1 block text-[10px] font-normal text-[var(--tx-muted)]"><Clock3 className="mr-1 inline" size={11}/>Último uso {fmt(module.lastUsedAt)}</span></span><span className="rounded-full bg-[var(--tx-surface-2)] px-2.5 py-1 text-xs font-black">{n(module.count)}x</span></div>)}</div> : <p className="text-xs text-[var(--tx-muted)]">Nenhum módulo foi associado a esta conta.</p>}
      <h3 className="mb-3 mt-6 text-sm font-black">Retornos e atividade por dia</h3>{selected.sessions.length ? <div className="space-y-2">{selected.sessions.map((session) => <div key={session.id} className="rounded-xl border border-[var(--tx-border)] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-xs font-bold">{session.id}<span className="ml-2 font-normal text-[var(--tx-muted)]">Primeira atividade {fmt(session.startedAt)} · última ação {fmt(session.lastActivityAt)}</span></div><span className="rounded-full bg-[var(--tx-surface-2)] px-2.5 py-1 text-[10px] font-bold">{n(session.actions)} eventos de produto</span></div><div className="mt-2 flex flex-wrap gap-1.5">{session.modules.length ? session.modules.map((module) => <span key={module.name} className="rounded-full bg-[var(--tx-surface-2)] px-2.5 py-1 text-[10px]">{module.name} · {n(module.count)}x</span>) : <span className="text-[10px] text-[var(--tx-muted)]">Sem módulo identificado</span>}</div></div>)}</div> : <p className="text-xs text-[var(--tx-muted)]">Sem dias com uso de módulos registrado.</p>}
      <p className="mt-4 text-[10px] text-[var(--tx-muted)]">Eventos de pagamentos e assinaturas não contam como uso. “Alto uso” considera 8 ou mais dias ativos ou 30 ou mais eventos de produto nos últimos 30 dias. “Ativo” considera uso em pelo menos 2 dias diferentes nos últimos 30 dias.</p>
    </section>}
  </div>;
}
