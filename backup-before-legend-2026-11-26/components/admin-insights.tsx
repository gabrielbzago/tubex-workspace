"use client";
import { ArrowDownRight, ArrowUpRight, Minus, Lightbulb, AlertTriangle, TrendingUp, Info, UserX } from "lucide-react";

export type Insights = {
  previous: Record<string, number>;
  current: Record<string, number>;
  change: Record<string, number | null>;
  conversion: { installToLogin: number | null; loginToActive: number | null; convertedInstalls: number; periodInstalls: number };
  engagement: { avgDau: number; wau: number; periodActive: number; stickiness: number | null; actionsPerAccount: number; powerUsers: number; oneDayUsers: number };
  retention: { previousActive: number; retained: number; newActive: number; churned: number; rate: number | null };
  moduleTrends: { name: string; label: string; users: number; actions: number; previous: number; change: number | null }[];
  hours: { hour: number; actions: number }[];
  weekdays: { day: number; actions: number }[];
  atRisk: { accountKey: string; account: string; email: string | null; plan: string | null; lastActivityAt: string | null }[];
  notes: { tone: "good" | "warn" | "bad" | "info"; title: string; text: string }[];
  eventsLoaded: number;
  truncated: boolean;
};

const nf = (v: number | undefined | null) => new Intl.NumberFormat("pt-BR").format(v || 0);
const pctText = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`);

function Delta({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="tx-delta is-new">novo</span>;
  if (value === 0) return <span className="tx-delta is-flat"><Minus size={12} />0%</span>;
  const up = value > 0;
  return <span className={`tx-delta ${up ? "is-up" : "is-down"}`}>{up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{up ? "+" : ""}{value.toLocaleString("pt-BR")}%</span>;
}

const toneIcon = { good: TrendingUp, warn: AlertTriangle, bad: AlertTriangle, info: Info } as const;
const weekdayShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function AdminInsights({ insights, days }: { insights: Insights; days: number }) {
  const kpis: [string, string, string][] = [
    ["Contas ativas", "activeAccounts", "Usaram algum recurso"],
    ["Novas instalações", "installs", "Primeira vez vistas"],
    ["Contas com login", "logins", "Login único no período"],
    ["Pesquisas e análises", "searches", "Eventos de SEO/análise"],
  ];
  const maxHour = Math.max(1, ...insights.hours.map((h) => h.actions));
  const maxWeekday = Math.max(1, ...insights.weekdays.map((w) => w.actions));
  const funnel = [
    { label: "Instalações novas", value: insights.conversion.periodInstalls },
    { label: "Viraram conta (login)", value: insights.conversion.convertedInstalls },
    { label: "Contas com login", value: insights.current.logins },
    { label: "Usaram recursos", value: insights.current.activeAccounts },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([label, key, hint]) => (
          <div key={key} className="tx-kpi">
            <div className="tx-kpi-top"><span>{label}</span><Delta value={insights.change[key]} /></div>
            <p className="tx-kpi-value">{nf(insights.current[key])}</p>
            <p className="tx-kpi-hint">{hint} · antes {nf(insights.previous[key])}</p>
          </div>
        ))}
      </div>

      {insights.notes.length > 0 && (
        <section className="tx-surface rounded-2xl p-5">
          <div className="mb-4 flex items-center gap-2"><Lightbulb size={18} className="text-[var(--tx-accent)]" /><h2 className="text-lg font-black">O que está acontecendo</h2></div>
          <div className="grid gap-3 md:grid-cols-2">
            {insights.notes.map((n, i) => {
              const Icon = toneIcon[n.tone];
              return <div key={i} className={`tx-insight is-${n.tone}`}><span className="tx-insight-icon"><Icon size={16} /></span><div><b>{n.title}</b><p>{n.text}</p></div></div>;
            })}
          </div>
          <p className="mt-3 text-xs text-[var(--tx-muted)]">Comparação: últimos {days} dias contra os {days} dias anteriores. {nf(insights.eventsLoaded)} eventos analisados.</p>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="tx-surface rounded-2xl p-5">
          <h2 className="text-lg font-black">Funil de ativação</h2>
          <p className="mt-1 mb-4 text-xs text-[var(--tx-muted)]">Da instalação até o uso real dos recursos.</p>
          <div className="space-y-3">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="mb-1 flex justify-between text-sm"><span>{f.label}</span><b className="tabular-nums">{nf(f.value)}</b></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--tx-surface-2)]"><div className="h-full rounded-full bg-[var(--tx-blue)]" style={{ width: `${(f.value / funnelMax) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="mt-4 tx-grid-2 grid gap-2 text-center">
            <div className="tx-mini-stat"><b>{pctText(insights.conversion.installToLogin)}</b><span>instalação → conta</span></div>
            <div className="tx-mini-stat"><b>{pctText(insights.conversion.loginToActive)}</b><span>login → uso</span></div>
          </div>
        </section>

        <section className="tx-surface rounded-2xl p-5">
          <h2 className="text-lg font-black">Engajamento e retenção</h2>
          <p className="mt-1 mb-4 text-xs text-[var(--tx-muted)]">Quantas pessoas voltam e com que frequência.</p>
          <div className="tx-grid-2 grid gap-2">
            <div className="tx-mini-stat"><b>{insights.engagement.avgDau.toLocaleString("pt-BR")}</b><span>contas por dia (média)</span></div>
            <div className="tx-mini-stat"><b>{nf(insights.engagement.wau)}</b><span>ativas nos últimos 7 dias</span></div>
            <div className="tx-mini-stat"><b>{pctText(insights.retention.rate)}</b><span>retenção vs. período anterior</span></div>
            <div className="tx-mini-stat"><b>{pctText(insights.engagement.stickiness)}</b><span>stickiness (DAU/ativas)</span></div>
            <div className="tx-mini-stat"><b>{nf(insights.retention.newActive)}</b><span>contas novas ativas</span></div>
            <div className="tx-mini-stat"><b>{nf(insights.engagement.powerUsers)}</b><span>usuários frequentes</span></div>
          </div>
          <p className="mt-3 text-xs text-[var(--tx-muted)]">{nf(insights.engagement.actionsPerAccount)} eventos por conta ativa · {nf(insights.engagement.oneDayUsers)} contas usaram só 1 dia.</p>
        </section>

        <section className="tx-surface rounded-2xl p-5">
          <h2 className="text-lg font-black">Quando usam o TubeX</h2>
          <p className="mt-1 mb-4 text-xs text-[var(--tx-muted)]">Eventos de uso por hora e dia da semana (Brasília).</p>
          <div className="flex h-24 items-end gap-[3px]" aria-label="Uso por hora">
            {insights.hours.map((h) => <div key={h.hour} title={`${String(h.hour).padStart(2, "0")}h: ${nf(h.actions)} eventos`} className="flex-1 rounded-t bg-[var(--tx-blue)]" style={{ height: `${Math.max(3, (h.actions / maxHour) * 100)}%`, opacity: h.actions ? 0.35 + 0.65 * (h.actions / maxHour) : 0.15 }} />)}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-[var(--tx-muted)]"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
          <div className="mt-4 tx-grid-7 grid gap-1.5">
            {insights.weekdays.map((w) => <div key={w.day} className="text-center"><div className="mx-auto h-9 rounded-lg bg-[var(--tx-blue)]" style={{ opacity: w.actions ? 0.2 + 0.8 * (w.actions / maxWeekday) : 0.08 }} title={`${nf(w.actions)} eventos`} /><span className="mt-1 block text-[11px] text-[var(--tx-muted)]">{weekdayShort[w.day]}</span></div>)}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="tx-surface rounded-2xl p-5">
          <h2 className="text-lg font-black">Tendência por módulo</h2>
          <p className="mt-1 mb-4 text-xs text-[var(--tx-muted)]">Eventos de uso agora vs. período anterior.</p>
          {insights.moduleTrends.length ? <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm">
            <thead><tr><th className="px-3 py-2">Módulo</th><th className="px-3 py-2 text-right">Contas</th><th className="px-3 py-2 text-right">Eventos</th><th className="px-3 py-2 text-right">Variação</th></tr></thead>
            <tbody>{insights.moduleTrends.map((m) => <tr key={m.name} className="border-t border-[var(--tx-border)]"><td className="px-3 py-2.5 font-semibold">{m.label}</td><td className="px-3 text-right tabular-nums">{nf(m.users)}</td><td className="px-3 text-right tabular-nums">{nf(m.actions)}</td><td className="px-3 text-right"><Delta value={m.change} /></td></tr>)}</tbody>
          </table></div> : <p className="text-sm text-[var(--tx-muted)]">Sem uso de módulos neste período.</p>}
        </section>

        <section className="tx-surface rounded-2xl p-5">
          <div className="flex items-center gap-2"><UserX size={18} className="text-[var(--tx-red,#f43f5e)]" /><h2 className="text-lg font-black">Contas em risco</h2></div>
          <p className="mt-1 mb-4 text-xs text-[var(--tx-muted)]">Usaram no período anterior e não voltaram nos últimos {days} dias. Assinantes aparecem primeiro.</p>
          {insights.atRisk.length ? <div className="space-y-2">{insights.atRisk.map((a) => <div key={a.accountKey} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--tx-border)] px-3 py-2.5">
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{a.account}</p>{a.email && a.email !== a.account && <p className="truncate text-xs text-[var(--tx-muted)]">{a.email}</p>}</div>
            <div className="shrink-0 text-right"><span className="rounded-full bg-[var(--tx-surface-2)] px-2 py-0.5 text-[11px] font-bold">{a.plan || "sem plano"}</span>{a.lastActivityAt && <p className="mt-1 text-[11px] text-[var(--tx-muted)]">último uso {new Date(a.lastActivityAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>}</div>
          </div>)}</div> : <p className="text-sm text-[var(--tx-muted)]">Nenhuma conta parou de usar. Ótimo sinal.</p>}
        </section>
      </div>
    </div>
  );
}
