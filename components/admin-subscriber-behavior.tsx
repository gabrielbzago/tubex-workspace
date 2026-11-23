"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Activity, AlertTriangle, CheckCircle2, Clock3, CreditCard, Flame, Gauge, Info, Moon, RefreshCw, Search, Sparkles, TrendingUp, UserRoundX, Users, XCircle } from "lucide-react";

type ModuleUsage = { key: string; name: string; count: number; lastUsedAt: string };
type UsageSession = { id: string; startedAt: string; lastActivityAt: string; actions: number; modules: { name: string; count: number }[] };
type PaymentEvent = { eventName: string; label: string; at: string; plan: string | null; source: string | null };
type Status = "active" | "at_risk" | "inactive" | "canceled";
type Tier = "hot" | "warm" | "cold";
type Account = {
  id: string; name: string; email: string; plan: string; billingStatus: string; status: Status; statusReasons: string[];
  isSubscriber: boolean; currentSubscriber: boolean; formerSubscriber: boolean; linkedEmails: number;
  createdAt: string | null; subscribedAt: string | null; canceledAt: string | null; cancelReason: string | null;
  cancelCode: string | null; cancelLabel: string | null; cancelComment: string | null;
  quotaHits: number; quotaHits30: number; lastQuotaAt: string | null; quotaFeatures: { name: string; count: number }[];
  upgradeClicks: number; checkoutStarts: number; paymentFailures: number;
  propensity: number; propensityTier: Tier | null; propensityFactors: { label: string; points: number }[];
  subscribeDrivers: { quotaHitsBefore: number; topModules: { name: string; count: number }[] };
  daysSinceActivity: number | null;
  firstLoginAt: string | null; lastLoginAt: string | null; lastActivityAt: string | null; lastResource: string | null;
  loginCount: number; returned: boolean; returnCount: number; activeDays: number; activeDays30: number; searchCount: number;
  totalActions: number; actions30: number; highUse: boolean; modules: ModuleUsage[]; sessions: UsageSession[]; paymentJourney: PaymentEvent[];
};

const fmt = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Sem registro";
const fmtDay = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value)) : "—";
const n = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
const pct = (part: number, total: number) => total ? `${Math.round((part / total) * 100)}%` : "0%";
const DAY = 86400000;

// Cada status com o significado e os parâmetros exatos que o calculam (mesmas regras da API).
const STATUS: Record<Status, { label: string; color: string; Icon: any; meaning: string; rule: string; tone: string }> = {
  active: { label: "Ativo", color: "var(--viz-good)", Icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    meaning: "Usa o TubeX com frequência. É a base saudável.", rule: "Usou recursos em 2 ou mais dias diferentes nos últimos 30 dias e o último uso foi há no máximo 14 dias. Para assinantes, sem pagamento pendente." },
  at_risk: { label: "Em risco", color: "var(--viz-warning)", Icon: AlertTriangle, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    meaning: "Ainda usou no último mês, mas o uso está caindo ou o pagamento travou.", rule: "Teve uso nos últimos 30 dias, porém sem uso há mais de 14 dias, ou só 1 dia com uso no período, ou pagamento pendente (past_due)." },
  inactive: { label: "Inativo", color: "var(--viz-serious)", Icon: Moon, tone: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    meaning: "Parou de usar. Para assinante, é o risco mais alto de cancelar.", rule: "Nenhum uso de recurso nos últimos 30 dias (ou nunca usou)." },
  canceled: { label: "Cancelado", color: "var(--viz-critical)", Icon: UserRoundX, tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    meaning: "Já foi assinante e não tem assinatura válida hoje.", rule: "Evento de cancelamento do Stripe, ou status canceled/inactive em uma conta que já teve assinatura." },
};
const TIER: Record<Tier, { label: string; color: string; Icon: any; rule: string }> = {
  hot: { label: "Quente", color: "var(--viz-seq-3)", Icon: Flame, rule: "Pontuação 60 a 100. Chame agora: oferta, cupom ou contato direto." },
  warm: { label: "Morno", color: "var(--viz-seq-2)", Icon: TrendingUp, rule: "Pontuação 30 a 59. Mostra interesse; vale nutrir com avisos de upgrade." },
  cold: { label: "Frio", color: "var(--viz-seq-1)", Icon: Moon, rule: "Pontuação abaixo de 30. Pouco sinal de compra por enquanto." },
};
const SCORE_RULES: [string, string][] = [
  ["Bateu o limite do plano nos últimos 30 dias", "+25 (1 ou 2 vezes) · +35 (3 ou mais)"],
  ["Abriu o checkout e não concluiu (30 dias)", "+25 (ou +10 se foi há mais tempo)"],
  ["Clicou em assinar ou no aviso de upgrade (30 dias)", "+15"],
  ["Viu a página de planos ou o aviso de upgrade (30 dias)", "+5"],
  ["Dias ativos nos últimos 30", "+15 (5 ou mais) · +8 (2 a 4)"],
  ["30 ou mais ações nos últimos 30 dias", "+10"],
  ["Usou nos últimos 7 dias", "+5"],
  ["Já foi assinante", "+5"],
  ["Sem uso há mais de 30 dias", "−20"],
];
const CATEGORICAL = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-5)", "var(--viz-6)"];

type Slice = { key: string; label: string; value: number; color: string; Icon?: any };

function Donut({ title, subtitle, slices, centerLabel, onSelect, selected }: { title: string; subtitle: string; slices: Slice[]; centerLabel: string; onSelect?: (key: string) => void; selected?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const size = 168, stroke = 22, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const gap = total > 0 && slices.filter((s) => s.value > 0).length > 1 ? 3 : 0; // espaço de superfície entre fatias
  let offset = 0;
  const active = slices.find((slice) => slice.key === hover);
  return <section className="tx-surface flex flex-col rounded-2xl p-5">
    <h3 className="text-sm font-black">{title}</h3>
    <p className="mt-1 text-[11px] leading-5 text-[var(--tx-muted)]">{subtitle}</p>
    <div className="mt-4 flex flex-1 flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${title}: ${slices.map((s) => `${s.label} ${s.value}`).join(", ")}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--tx-surface-2)" strokeWidth={stroke}/>
          {total > 0 && slices.map((slice) => {
            if (!slice.value) return null;
            const length = (slice.value / total) * c;
            const dash = Math.max(0, length - gap);
            const element = <circle key={slice.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={slice.color} strokeWidth={hover === slice.key || selected === slice.key ? stroke + 4 : stroke}
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className="cursor-pointer transition-[stroke-width]" onMouseEnter={() => setHover(slice.key)} onMouseLeave={() => setHover(null)} onClick={() => onSelect?.(slice.key)}>
              <title>{`${slice.label}: ${n(slice.value)} (${pct(slice.value, total)})`}</title>
            </circle>;
            offset += length;
            return element;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-black tabular-nums">{n(active ? active.value : total)}</span>
          <span className="max-w-[96px] text-[10px] font-bold leading-4 text-[var(--tx-muted)]">{active ? `${active.label} · ${pct(active.value, total)}` : centerLabel}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5">
        {slices.map((slice) => <li key={slice.key}>
          <button type="button" onClick={() => onSelect?.(slice.key)} onMouseEnter={() => setHover(slice.key)} onMouseLeave={() => setHover(null)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-[var(--tx-surface-2)] ${selected === slice.key ? "bg-[var(--tx-surface-2)] ring-1 ring-[var(--tx-accent)]" : ""}`}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }}/>
            {slice.Icon && <slice.Icon size={13} className="shrink-0 text-[var(--tx-muted)]"/>}
            <span className="min-w-0 flex-1 truncate font-semibold">{slice.label}</span>
            <span className="font-black tabular-nums">{n(slice.value)}</span>
            <span className="w-9 text-right tabular-nums text-[var(--tx-muted)]">{pct(slice.value, total)}</span>
          </button>
        </li>)}
      </ul>
    </div>
  </section>;
}

function Kpi({ title, value, hint, Icon }: { title: string; value: string; hint: string; Icon: any }) {
  return <div className="tx-surface rounded-2xl p-4">
    <div className="flex items-center justify-between text-[var(--tx-muted)]"><span className="text-[10px] font-black uppercase tracking-[.12em]">{title}</span><Icon size={16}/></div>
    <p className="mt-3 text-2xl font-black tabular-nums">{value}</p>
    <p className="mt-1 text-[11px] leading-4 text-[var(--tx-muted)]">{hint}</p>
  </div>;
}

function Meter({ label, value, total, color, note }: { label: string; value: number; total: number; color: string; note?: string }) {
  const ratio = total ? Math.min(1, value / total) : 0;
  return <div>
    <div className="flex items-baseline justify-between gap-2 text-xs"><span className="font-semibold">{label}</span><span className="tabular-nums"><b>{n(value)}</b> <span className="text-[var(--tx-muted)]">de {n(total)} · {pct(value, total)}</span></span></div>
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--tx-surface-2)]"><div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: color }}/></div>
    {note && <p className="mt-1 text-[10px] text-[var(--tx-muted)]">{note}</p>}
  </div>;
}

function StatusPill({ status }: { status: Status }) {
  const s = STATUS[status];
  return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 font-bold text-[var(--tx-text)]" style={{ background: `color-mix(in srgb, ${s.color} 16%, transparent)` }}><s.Icon size={12} style={{ color: s.color }}/>{s.label}</span>;
}
function TierPill({ tier, score }: { tier: Tier | null; score: number }) {
  if (!tier) return <span className="text-[var(--tx-muted)]">—</span>;
  const t = TIER[tier];
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className="h-2 w-2 rounded-full" style={{ background: t.color }}/><b>{t.label}</b><span className="tabular-nums text-[var(--tx-muted)]">{score}/100</span></span>;
}

export default function AdminSubscriberBehavior({ segment = "subscribers" }: { segment?: "subscribers" | "free" }) {
  const isFree = segment === "free";
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Entre novamente.");
      const response = await fetch(`/api/admin/behavior?segment=${segment}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error === "forbidden" ? "Acesso restrito ao proprietário." : "Não foi possível carregar os dados de comportamento.");
      setAccounts(payload.accounts || []);
    } catch (reason: any) { setError(reason.message || "Falha ao carregar os dados."); }
    finally { setLoading(false); }
  }
  useEffect(() => { setFilter("all"); setSelectedId(null); void load(); }, [segment]);

  const now = Date.now();
  const stats = useMemo(() => {
    const by = (status: Status) => accounts.filter((row) => row.status === status).length;
    const current = accounts.filter((row) => row.currentSubscriber);
    const planCounts = new Map<string, number>();
    for (const row of current) planCounts.set(row.plan.toUpperCase(), (planCounts.get(row.plan.toUpperCase()) || 0) + 1);
    const canceled = accounts.filter((row) => row.status === "canceled");
    const reasonCounts = new Map<string, number>();
    for (const row of canceled) { const key = row.cancelLabel || "Motivo não informado"; reasonCounts.set(key, (reasonCounts.get(key) || 0) + 1); }
    const reasons = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]);
    const reasonSlices = [...reasons.slice(0, 5), ...(reasons.length > 5 ? [["Outros", reasons.slice(5).reduce((sum, [, v]) => sum + v, 0)] as [string, number]] : [])];
    const quota30 = accounts.filter((row) => row.quotaHits30 > 0);
    const quotaEver = accounts.filter((row) => row.quotaHits > 0);
    const tiers = { hot: 0, warm: 0, cold: 0 } as Record<Tier, number>;
    for (const row of accounts) if (row.propensityTier) tiers[row.propensityTier]++;
    const newSubs30 = accounts.filter((row) => row.subscribedAt && now - Date.parse(row.subscribedAt) <= 30 * DAY).length;
    const canceled30 = accounts.filter((row) => row.canceledAt && now - Date.parse(row.canceledAt) <= 30 * DAY).length;
    const checkoutAbandon = accounts.filter((row) => !row.currentSubscriber && row.checkoutStarts > 0).length;
    const subsWithQuotaBefore = accounts.filter((row) => row.isSubscriber && row.subscribeDrivers.quotaHitsBefore > 0).length;
    return { active: by("active"), at_risk: by("at_risk"), inactive: by("inactive"), canceled: by("canceled"), current, planCounts, reasonSlices, quota30, quotaEver, tiers, newSubs30, canceled30, checkoutAbandon, subsWithQuotaBefore };
  }, [accounts, now]);

  const statusSlices: Slice[] = (isFree ? (["active", "at_risk", "inactive", "canceled"] as Status[]) : (["active", "at_risk", "inactive", "canceled"] as Status[]))
    .map((key) => ({ key, label: key === "canceled" && isFree ? "Ex-assinante" : STATUS[key].label, value: stats[key], color: STATUS[key].color, Icon: STATUS[key].Icon }));
  const tierSlices: Slice[] = (["hot", "warm", "cold"] as Tier[]).map((key) => ({ key: `tier:${key}`, label: TIER[key].label, value: stats.tiers[key], color: TIER[key].color, Icon: TIER[key].Icon }));
  const planSlices: Slice[] = [...stats.planCounts.entries()].sort((a, b) => b[1] - a[1]).map(([plan, value], index) => ({ key: `plan:${plan}`, label: plan, value, color: CATEGORICAL[index % CATEGORICAL.length] }));
  const reasonSlices: Slice[] = stats.reasonSlices.map(([label, value], index) => ({ key: `reason:${label}`, label, value, color: label === "Outros" ? "var(--viz-neutral)" : CATEGORICAL[index] }));

  const toggle = (key: string) => setFilter((current) => current === key ? "all" : key);
  const visible = useMemo(() => {
    const list = accounts.filter((row) => {
      let ok = true;
      if (filter.startsWith("tier:")) ok = row.propensityTier === filter.slice(5);
      else if (filter.startsWith("plan:")) ok = row.currentSubscriber && row.plan.toUpperCase() === filter.slice(5);
      else if (filter.startsWith("reason:")) ok = row.status === "canceled" && ((row.cancelLabel || "Motivo não informado") === filter.slice(7) || (filter.slice(7) === "Outros" && !stats.reasonSlices.slice(0, 5).some(([label]) => label === (row.cancelLabel || "Motivo não informado"))));
      else if (filter === "quota") ok = row.quotaHits30 > 0;
      else if (filter !== "all") ok = row.status === filter;
      const text = `${row.name} ${row.email} ${row.plan}`.toLowerCase();
      return ok && (!query || text.includes(query.toLowerCase()));
    });
    return isFree ? list.sort((a, b) => b.propensity - a.propensity || (a.daysSinceActivity ?? 9999) - (b.daysSinceActivity ?? 9999)) : list;
  }, [accounts, filter, query, isFree, stats.reasonSlices]);
  const selected = accounts.find((row) => row.id === selectedId) || null;

  const likely = accounts.filter((row) => row.propensityTier === "hot" || row.propensityTier === "warm").sort((a, b) => b.propensity - a.propensity).slice(0, 6);
  const limitHitters = [...stats.quota30].sort((a, b) => b.quotaHits30 - a.quotaHits30).slice(0, 6);
  const recentSubs = accounts.filter((row) => row.currentSubscriber).sort((a, b) => (Date.parse(b.subscribedAt || "") || 0) - (Date.parse(a.subscribedAt || "") || 0)).slice(0, 6);
  const recentCancels = accounts.filter((row) => row.status === "canceled").sort((a, b) => (Date.parse(b.canceledAt || "") || 0) - (Date.parse(a.canceledAt || "") || 0)).slice(0, 6);
  const filterLabel = filter === "all" ? null : filter.startsWith("tier:") ? `Probabilidade: ${TIER[filter.slice(5) as Tier]?.label}` : filter.startsWith("plan:") ? `Plano ${filter.slice(5)}` : filter.startsWith("reason:") ? `Motivo: ${filter.slice(7)}` : filter === "quota" ? "Bateram o limite (30 dias)" : STATUS[filter as Status]?.label;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="tx-kicker">OWNER · {isFree ? "CONVERSÃO" : "RETENÇÃO"}</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-.03em]">{isFree ? "Comportamento de Uso" : "Comportamento do Assinante"}</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--tx-muted)]">{isFree ? "Contas sem assinatura válida hoje: quem usa, quem bateu o limite e quem tem mais chance de assinar." : "Quem assina, como está usando, quem está em risco e por que as pessoas cancelaram."}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setShowGuide((v) => !v)} className="tx-btn tx-btn-secondary"><Info size={14}/> Como medimos</button>
        <button onClick={() => void load()} className="tx-btn tx-btn-secondary"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Atualizar</button>
      </div>
    </header>

    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">{error}</div>}

    {showGuide && <section className="tx-surface rounded-2xl p-5">
      <h2 className="text-lg font-black">Como cada indicador é calculado</h2>
      <p className="mt-1 text-xs text-[var(--tx-muted)]">Uso = eventos de recursos (pesquisas, análises, IA, módulos). Login, pagamentos e telas de assinatura não contam como uso. O plano segue a mesma regra do site e da extensão: todos os e-mails da conta são consultados e o melhor plano com status válido (active, trialing, past_due) vence.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {(Object.keys(STATUS) as Status[]).map((key) => { const s = STATUS[key]; return <div key={key} className="rounded-xl border border-[var(--tx-border)] p-4">
          <div className="flex items-center gap-2"><StatusPill status={key}/></div>
          <p className="mt-2 text-xs font-semibold">{s.meaning}</p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--tx-muted)]"><b>Parâmetros:</b> {s.rule}</p>
        </div>; })}
      </div>
      {isFree && <div className="mt-4 rounded-xl border border-[var(--tx-border)] p-4">
        <h3 className="flex items-center gap-2 text-sm font-black"><Gauge size={15}/> Probabilidade de assinar (0 a 100)</h3>
        <div className="mt-3 grid gap-x-6 gap-y-1.5 text-[11px] md:grid-cols-2">{SCORE_RULES.map(([rule, points]) => <div key={rule} className="flex justify-between gap-3 border-b border-[var(--tx-border)] py-1 last:border-0"><span className="text-[var(--tx-muted)]">{rule}</span><b className="whitespace-nowrap tabular-nums">{points}</b></div>)}</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">{(Object.keys(TIER) as Tier[]).map((key) => <div key={key} className="flex items-start gap-2 text-[11px]"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TIER[key].color }}/><span><b>{TIER[key].label}:</b> <span className="text-[var(--tx-muted)]">{TIER[key].rule}</span></span></div>)}</div>
      </div>}
    </section>}

    {loading && !accounts.length ? <div className="tx-surface rounded-2xl p-10 text-center text-sm text-[var(--tx-muted)]">Carregando histórico de uso…</div> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isFree ? <>
          <Kpi title="Contas sem assinatura" value={n(accounts.length)} hint={`${n(stats.active)} ativas nos últimos 30 dias`} Icon={Users}/>
          <Kpi title="Prováveis assinantes" value={n(stats.tiers.hot + stats.tiers.warm)} hint={`${n(stats.tiers.hot)} quentes · ${n(stats.tiers.warm)} mornos`} Icon={Sparkles}/>
          <Kpi title="Bateram o limite" value={n(stats.quota30.length)} hint={`nos últimos 30 dias · ${n(stats.quotaEver.length)} desde o início`} Icon={Gauge}/>
          <Kpi title="Checkout abandonado" value={n(stats.checkoutAbandon)} hint="abriram o pagamento e não assinaram" Icon={CreditCard}/>
        </> : <>
          <Kpi title="Assinantes ativos" value={n(stats.current.length)} hint={`${n(stats.newSubs30)} novos nos últimos 30 dias`} Icon={Users}/>
          <Kpi title="Saudáveis" value={pct(accounts.filter((r) => r.currentSubscriber && r.status === "active").length, stats.current.length)} hint="dos assinantes com uso regular" Icon={CheckCircle2}/>
          <Kpi title="Em risco ou inativos" value={n(accounts.filter((r) => r.currentSubscriber && (r.status === "at_risk" || r.status === "inactive")).length)} hint="assinantes pagando com pouco ou nenhum uso" Icon={AlertTriangle}/>
          <Kpi title="Cancelamentos" value={n(stats.canceled)} hint={`${n(stats.canceled30)} nos últimos 30 dias`} Icon={XCircle}/>
        </>}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {isFree ? <>
          <Donut title="Probabilidade de assinar" subtitle="Pontuação por sinais de compra: limite, checkout, cliques em assinar e frequência." slices={tierSlices} centerLabel="contas" onSelect={toggle} selected={filter}/>
          <Donut title="Engajamento das contas free" subtitle="Status calculado pela frequência e pela data do último uso." slices={statusSlices} centerLabel="contas" onSelect={toggle} selected={filter}/>
          <section className="tx-surface rounded-2xl p-5">
            <h3 className="text-sm font-black">Limites e intenção de compra</h3>
            <p className="mt-1 text-[11px] leading-5 text-[var(--tx-muted)]">Quanto da base free já esbarrou no plano. Clique para filtrar a lista.</p>
            <div className="mt-5 space-y-4">
              <button type="button" onClick={() => toggle("quota")} className={`block w-full rounded-lg p-1 text-left ${filter === "quota" ? "ring-1 ring-[var(--tx-accent)]" : ""}`}><Meter label="Bateram o limite (30 dias)" value={stats.quota30.length} total={accounts.length} color="var(--viz-1)"/></button>
              <Meter label="Bateram o limite alguma vez" value={stats.quotaEver.length} total={accounts.length} color="var(--viz-1)"/>
              <Meter label="Abriram o checkout" value={stats.checkoutAbandon} total={accounts.length} color="var(--viz-1)"/>
              <Meter label="Clicaram em assinar" value={accounts.filter((r) => r.upgradeClicks > 0).length} total={accounts.length} color="var(--viz-1)"/>
            </div>
          </section>
        </> : <>
          <Donut title="Saúde da base" subtitle="Todos que já assinaram, pelo status de uso e de assinatura." slices={statusSlices} centerLabel="contas" onSelect={toggle} selected={filter}/>
          <Donut title="Assinantes por plano" subtitle="Somente assinaturas válidas hoje (active, trialing ou past_due)." slices={planSlices} centerLabel="assinantes" onSelect={toggle} selected={filter}/>
          <Donut title="Por que cancelaram" subtitle="Motivo informado no Stripe ao cancelar. Clique para ver quem." slices={reasonSlices.length ? reasonSlices : [{ key: "none", label: "Sem cancelamentos", value: 0, color: "var(--viz-neutral)" }]} centerLabel="cancelamentos" onSelect={toggle} selected={filter}/>
        </>}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {isFree ? <>
          <section className="tx-surface rounded-2xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-black"><Sparkles size={15}/> Mais prováveis de assinar</h3>
            <p className="mt-1 text-[11px] text-[var(--tx-muted)]">Ordenado pela pontuação. Os sinais mostram por que a conta pontuou.</p>
            <div className="mt-3 space-y-2">{likely.length ? likely.map((row) => <button key={row.id} onClick={() => setSelectedId(row.id)} className="block w-full rounded-xl border border-[var(--tx-border)] p-3 text-left hover:bg-[var(--tx-surface-2)]">
              <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-xs font-bold">{row.name}</span><TierPill tier={row.propensityTier} score={row.propensity}/></div>
              <div className="mt-2 flex flex-wrap gap-1.5">{row.propensityFactors.filter((f) => f.points > 0).map((f) => <span key={f.label} className="rounded-full bg-[var(--tx-surface-2)] px-2 py-0.5 text-[10px]">{f.label} <b>+{f.points}</b></span>)}</div>
            </button>) : <p className="rounded-xl bg-[var(--tx-surface-2)] p-4 text-xs text-[var(--tx-muted)]">Nenhuma conta com sinal forte de compra ainda.</p>}</div>
          </section>
          <section className="tx-surface rounded-2xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-black"><Gauge size={15}/> Quem bateu o limite (30 dias)</h3>
            <p className="mt-1 text-[11px] text-[var(--tx-muted)]">Evento de limite diário atingido na extensão ou no site, com o recurso que travou.</p>
            <div className="mt-3 space-y-2">{limitHitters.length ? limitHitters.map((row) => <button key={row.id} onClick={() => setSelectedId(row.id)} className="block w-full rounded-xl border border-[var(--tx-border)] p-3 text-left hover:bg-[var(--tx-surface-2)]">
              <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-xs font-bold">{row.name}</span><span className="text-xs tabular-nums"><b>{n(row.quotaHits30)}x</b> <span className="text-[var(--tx-muted)]">· último {fmtDay(row.lastQuotaAt)}</span></span></div>
              <p className="mt-1 truncate text-[10px] text-[var(--tx-muted)]">{row.quotaFeatures.map((f) => `${f.name} (${f.count})`).join(" · ") || "Recurso não informado"}</p>
            </button>) : <p className="rounded-xl bg-[var(--tx-surface-2)] p-4 text-xs text-[var(--tx-muted)]">Ninguém bateu o limite nos últimos 30 dias.</p>}</div>
          </section>
        </> : <>
          <section className="tx-surface rounded-2xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-black"><TrendingUp size={15}/> Quem assinou e o que levou à assinatura</h3>
            <p className="mt-1 text-[11px] text-[var(--tx-muted)]">{n(stats.subsWithQuotaBefore)} de {n(accounts.filter((r) => r.isSubscriber).length)} assinantes bateram o limite antes de assinar. Abaixo, o que cada um mais usou antes da compra.</p>
            <div className="mt-3 space-y-2">{recentSubs.length ? recentSubs.map((row) => <button key={row.id} onClick={() => setSelectedId(row.id)} className="block w-full rounded-xl border border-[var(--tx-border)] p-3 text-left hover:bg-[var(--tx-surface-2)]">
              <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-xs font-bold">{row.name} <span className="font-normal text-[var(--tx-muted)]">· {row.plan.toUpperCase()}</span></span><span className="text-[10px] text-[var(--tx-muted)]">{row.subscribedAt ? `assinou ${fmtDay(row.subscribedAt)}` : "data não registrada"}</span></div>
              <p className="mt-1 text-[10px] text-[var(--tx-muted)]">{row.subscribeDrivers.quotaHitsBefore > 0 ? `Bateu o limite ${row.subscribeDrivers.quotaHitsBefore}x antes · ` : ""}{row.subscribeDrivers.topModules.length ? `Mais usado antes: ${row.subscribeDrivers.topModules.map((m) => m.name).join(", ")}` : "Sem uso registrado antes da assinatura"}</p>
            </button>) : <p className="rounded-xl bg-[var(--tx-surface-2)] p-4 text-xs text-[var(--tx-muted)]">Nenhum assinante ativo identificado.</p>}</div>
          </section>
          <section className="tx-surface rounded-2xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-black"><UserRoundX size={15}/> Cancelamentos recentes</h3>
            <p className="mt-1 text-[11px] text-[var(--tx-muted)]">Motivo e comentário enviados pelo Stripe, e como estava o uso antes de sair.</p>
            <div className="mt-3 space-y-2">{recentCancels.length ? recentCancels.map((row) => <button key={row.id} onClick={() => setSelectedId(row.id)} className="block w-full rounded-xl border border-[var(--tx-border)] p-3 text-left hover:bg-[var(--tx-surface-2)]">
              <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-xs font-bold">{row.name}</span><span className="text-[10px] text-[var(--tx-muted)]">{fmtDay(row.canceledAt)}</span></div>
              <p className="mt-1 text-[11px]"><b>{row.cancelLabel || "Motivo não informado"}</b>{row.cancelComment ? <span className="text-[var(--tx-muted)]"> · “{row.cancelComment}”</span> : null}</p>
              <p className="mt-1 text-[10px] text-[var(--tx-muted)]">{n(row.activeDays)} dias ativos no total · {row.lastActivityAt ? `último uso ${fmtDay(row.lastActivityAt)}` : "nunca usou recursos"}</p>
            </button>) : <p className="rounded-xl bg-[var(--tx-surface-2)] p-4 text-xs text-[var(--tx-muted)]">Nenhum cancelamento registrado.</p>}</div>
          </section>
        </>}
      </div>

      <section className="tx-surface rounded-2xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">{isFree ? "Contas sem assinatura" : "Contas assinantes"}</h2>
            <p className="mt-1 text-xs text-[var(--tx-muted)]">{n(visible.length)} contas{filterLabel ? <> · filtro: <b>{filterLabel}</b> <button onClick={() => setFilter("all")} className="ml-1 underline">limpar</button></> : null}. Clique em uma linha para ver o detalhe.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={filter.includes(":") || filter === "quota" ? "all" : filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] px-3 py-2 text-xs">
              <option value="all">Todos os status</option>{(Object.keys(STATUS) as Status[]).map((key) => <option key={key} value={key}>{key === "canceled" && isFree ? "Ex-assinante" : STATUS[key].label}</option>)}
            </select>
            <label className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx-muted)]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome ou e-mail" className="w-full rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] py-2 pl-9 pr-3 text-xs sm:w-60"/></label>
          </div>
        </div>
        {visible.length ? <div className="overflow-auto rounded-xl border border-[var(--tx-border)]"><table className="w-full min-w-[1080px] text-left text-xs">
          <thead className="bg-[var(--tx-surface-2)] text-[var(--tx-muted)]"><tr>{[isFree ? "Usuário" : "Assinante", "Status e motivo", isFree ? "Chance de assinar" : "Plano", "Limite (30d)", "Último uso", "Uso em 30 dias", isFree ? "Intenção" : "Assinatura"].map((label) => <th key={label} className="px-3 py-3 font-bold">{label}</th>)}</tr></thead>
          <tbody>{visible.map((row) => <tr key={row.id} onClick={() => setSelectedId(selectedId === row.id ? null : row.id)} className={`cursor-pointer border-t border-[var(--tx-border)] align-top hover:bg-[var(--tx-surface-2)] ${selectedId === row.id ? "bg-[var(--tx-surface-2)]" : ""}`}>
            <td className="px-3 py-3"><div className="font-bold">{row.name}</div><div className="mt-1 text-[var(--tx-muted)]">{row.email}{row.linkedEmails > 1 ? ` · ${row.linkedEmails} e-mails ligados` : ""}</div></td>
            <td className="px-3 py-3"><StatusPill status={row.status}/><div className="mt-1.5 max-w-[220px] text-[10px] leading-4 text-[var(--tx-muted)]">{row.statusReasons.join(" · ")}</div></td>
            <td className="px-3 py-3">{isFree ? <TierPill tier={row.propensityTier} score={row.propensity}/> : <><b>{row.plan.toUpperCase()}</b><div className="mt-1 text-[10px] text-[var(--tx-muted)]">{row.billingStatus}</div></>}</td>
            <td className="px-3 py-3 tabular-nums">{row.quotaHits30 ? <b>{n(row.quotaHits30)}x</b> : <span className="text-[var(--tx-muted)]">—</span>}{row.quotaHits > row.quotaHits30 ? <div className="mt-1 text-[10px] text-[var(--tx-muted)]">{n(row.quotaHits)}x no total</div> : null}</td>
            <td className="whitespace-nowrap px-3 py-3">{row.daysSinceActivity === null ? <span className="text-[var(--tx-muted)]">Nunca</span> : `há ${row.daysSinceActivity} dia(s)`}<div className="mt-1 text-[10px] text-[var(--tx-muted)]">{row.lastResource || "—"}</div></td>
            <td className="px-3 py-3"><b className="tabular-nums">{n(row.activeDays30)} dias</b><div className="mt-1 text-[10px] text-[var(--tx-muted)]">{n(row.actions30)} ações · {n(row.searchCount)} pesquisas no total</div></td>
            <td className="px-3 py-3 text-[10px]">{isFree ? <span className="text-[var(--tx-muted)]">{n(row.upgradeClicks)} cliques em assinar · {n(row.checkoutStarts)} checkouts</span> : row.status === "canceled" ? <span><b>{row.cancelLabel || "Motivo não informado"}</b><div className="text-[var(--tx-muted)]">cancelou {fmtDay(row.canceledAt)}</div></span> : <span className="text-[var(--tx-muted)]">{row.subscribedAt ? `desde ${fmtDay(row.subscribedAt)}` : "data não registrada"}{row.paymentFailures ? ` · ${row.paymentFailures} falha(s) de pagamento` : ""}</span>}</td>
          </tr>)}</tbody>
        </table></div> : <p className="rounded-xl bg-[var(--tx-surface-2)] p-5 text-sm text-[var(--tx-muted)]">{accounts.length ? "Nenhuma conta corresponde aos filtros." : isFree ? "Ainda não há contas sem assinatura identificadas." : "Ainda não há contas assinantes identificadas."}</p>}
      </section>
    </>}

    {selected && <section className="tx-surface rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="tx-kicker">DETALHE DA CONTA</p><h2 className="mt-2 text-xl font-black">{selected.name}</h2><p className="text-sm text-[var(--tx-muted)]">{selected.email} · {selected.plan.toUpperCase()} · cobrança {selected.billingStatus}</p></div>
        <div className="flex flex-wrap gap-2 text-xs"><StatusPill status={selected.status}/><span className="rounded-full bg-[var(--tx-surface-2)] px-3 py-1"><Users className="mr-1 inline" size={13}/>{n(selected.loginCount)} logins</span><span className="rounded-full bg-[var(--tx-surface-2)] px-3 py-1"><Activity className="mr-1 inline" size={13}/>{n(selected.activeDays)} dias ativos</span><button onClick={() => setSelectedId(null)} className="rounded-full border border-[var(--tx-border)] px-3 py-1">Fechar</button></div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--tx-border)] p-4"><p className="text-xs font-black">Por que está “{STATUS[selected.status].label}”</p><ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-[var(--tx-muted)]">{selected.statusReasons.map((r) => <li key={r}>{r}</li>)}</ul><p className="mt-2 text-[10px] text-[var(--tx-muted)]">Regra: {STATUS[selected.status].rule}</p></div>
        {!selected.currentSubscriber ? <div className="rounded-xl border border-[var(--tx-border)] p-4"><p className="flex items-center justify-between text-xs font-black"><span>Probabilidade de assinar</span><TierPill tier={selected.propensityTier} score={selected.propensity}/></p><ul className="mt-2 space-y-1 text-[11px]">{selected.propensityFactors.length ? selected.propensityFactors.map((f) => <li key={f.label} className="flex justify-between gap-2"><span className="text-[var(--tx-muted)]">{f.label}</span><b className="tabular-nums">{f.points > 0 ? `+${f.points}` : f.points}</b></li>) : <li className="text-[var(--tx-muted)]">Nenhum sinal de compra registrado.</li>}</ul></div>
          : <div className="rounded-xl border border-[var(--tx-border)] p-4"><p className="text-xs font-black">O que levou à assinatura</p><p className="mt-2 text-[11px] text-[var(--tx-muted)]">{selected.subscribeDrivers.quotaHitsBefore > 0 ? `Bateu o limite ${selected.subscribeDrivers.quotaHitsBefore}x antes de assinar. ` : "Não bateu limite antes de assinar. "}{selected.subscribeDrivers.topModules.length ? `Recursos mais usados antes: ${selected.subscribeDrivers.topModules.map((m) => `${m.name} (${m.count})`).join(", ")}.` : "Sem uso registrado antes da compra."}</p></div>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["Cadastro", selected.createdAt], ["Contratação", selected.subscribedAt], ["Primeiro login", selected.firstLoginAt], ["Último login", selected.lastLoginAt], ["Última atividade", selected.lastActivityAt]].map(([title, value]) => <div key={title} className="rounded-xl bg-[var(--tx-surface-2)] p-3"><p className="text-[10px] font-bold text-[var(--tx-muted)]">{title}</p><p className="mt-1 text-xs font-semibold">{fmt(value as string | null)}</p></div>)}</div>
      {selected.canceledAt && <p className="mt-3 rounded-xl bg-rose-500/10 p-3 text-xs"><b>Cancelamento:</b> {fmt(selected.canceledAt)} · {selected.cancelLabel || "Motivo não informado"}{selected.cancelComment ? ` · “${selected.cancelComment}”` : ""}</p>}
      {selected.quotaFeatures.length > 0 && <p className="mt-3 rounded-xl bg-[var(--tx-surface-2)] p-3 text-xs"><b>Limites atingidos:</b> {selected.quotaFeatures.map((f) => `${f.name} (${f.count}x)`).join(" · ")} · último em {fmt(selected.lastQuotaAt)}</p>}
      <h3 className="mb-3 mt-6 text-sm font-black">Jornada de assinatura e pagamentos</h3>
      <div className="mb-3 grid gap-2 sm:grid-cols-4">{[["Limites atingidos", selected.quotaHits], ["Cliques para assinar", selected.upgradeClicks], ["Checkouts iniciados", selected.checkoutStarts], ["Falhas de pagamento", selected.paymentFailures]].map(([title, value]) => <div key={title} className="rounded-xl bg-[var(--tx-surface-2)] p-3"><p className="text-[10px] font-bold text-[var(--tx-muted)]">{title}</p><p className="mt-1 text-xl font-black tabular-nums">{n(value as number)}</p></div>)}</div>
      {selected.paymentJourney.length ? <div className="max-h-[320px] space-y-2 overflow-auto">{selected.paymentJourney.map((event, index) => <div key={`${event.eventName}:${event.at}:${index}`} className="rounded-xl border border-[var(--tx-border)] p-3"><p className="text-xs font-bold">{event.label}{event.plan ? ` · ${event.plan}` : ""}</p><p className="mt-1 text-[10px] text-[var(--tx-muted)]">{fmt(event.at)}{event.source ? ` · ${event.source}` : ""}</p></div>)}</div> : <p className="text-xs text-[var(--tx-muted)]">Nenhum evento de plano, limite ou checkout registrado para esta conta.</p>}
      <h3 className="mb-3 mt-5 text-sm font-black">Recursos usados</h3>{selected.modules.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{selected.modules.map((module) => <div key={module.key} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--tx-border)] p-3"><span className="text-xs font-semibold">{module.name}<span className="mt-1 block text-[10px] font-normal text-[var(--tx-muted)]"><Clock3 className="mr-1 inline" size={11}/>Último uso {fmt(module.lastUsedAt)}</span></span><span className="rounded-full bg-[var(--tx-surface-2)] px-2.5 py-1 text-xs font-black tabular-nums">{n(module.count)}x</span></div>)}</div> : <p className="text-xs text-[var(--tx-muted)]">Nenhum recurso foi associado a esta conta.</p>}
      <h3 className="mb-3 mt-6 text-sm font-black">Atividade por dia</h3>{selected.sessions.length ? <div className="max-h-[360px] space-y-2 overflow-auto">{selected.sessions.map((session) => <div key={session.id} className="rounded-xl border border-[var(--tx-border)] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-xs font-bold">{session.id}<span className="ml-2 font-normal text-[var(--tx-muted)]">{fmt(session.startedAt)} até {fmt(session.lastActivityAt)}</span></div><span className="rounded-full bg-[var(--tx-surface-2)] px-2.5 py-1 text-[10px] font-bold">{n(session.actions)} ações</span></div><div className="mt-2 flex flex-wrap gap-1.5">{session.modules.map((module) => <span key={module.name} className="rounded-full bg-[var(--tx-surface-2)] px-2.5 py-1 text-[10px]">{module.name} · {n(module.count)}x</span>)}</div></div>)}</div> : <p className="text-xs text-[var(--tx-muted)]">Sem dias com uso registrado.</p>}
    </section>}
  </div>;
}
