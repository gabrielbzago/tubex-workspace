"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2, MessageSquare, RefreshCw, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";

const REASONS = [
  "Não estou utilizando o TubeX",
  "O preço está alto",
  "Não estou conseguindo os resultados esperados",
  "Faltam funcionalidades que preciso",
  "Estou enfrentando problemas técnicos",
  "Encontrei outra ferramenta",
  "Estou deixando o YouTube",
  "Outro motivo",
];

function formatDate(value?: string | null) {
  if (!value) return "A confirmar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "A confirmar";
  return date.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export function CancellationForm({ user, userData }: { user: any; userData: any }) {
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [improvement, setImprovement] = useState("");
  const [wouldReturn, setWouldReturn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [request, setRequest] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  const paidPlan = !["", "free", "owner", "admin"].includes(String(userData?.plan || "").toLowerCase());
  const isScheduled = request && ["processing", "scheduled"].includes(String(request.status));

  async function loadHistory() {
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/cancellations", { headers, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Não foi possível consultar o cancelamento.");
      setRequest((payload.requests || [])[0] || null);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar o histórico.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { void loadHistory(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason || loading) return;
    setLoading(true);
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/cancellations", {
        method: "POST",
        headers,
        body: JSON.stringify({ reason, feedback, improvement, would_return: wouldReturn }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Não foi possível enviar a solicitação.");
      setRequest(payload.request);
    } catch (err: any) {
      setError(err.message || "Erro ao enviar a solicitação.");
    } finally {
      setLoading(false);
    }
  }

  if (!loaded) {
    return <section className="tx-surface mt-5 rounded-2xl p-5 text-sm text-[var(--tx-muted)]"><Loader2 className="mr-2 inline animate-spin" size={16}/> Consultando sua solicitação...</section>;
  }

  return (
    <section className="tx-surface mt-6 rounded-[20px] border border-[var(--tx-border)] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--tx-surface-2)] text-[var(--tx-muted)]"><MessageSquare size={19}/></div>
        <div>
          <p className="text-sm font-black">Solicitação de cancelamento</p>
          <p className="mt-1 text-xs leading-5 text-[var(--tx-muted)]">Queremos entender sua experiência. O motivo principal é obrigatório; as demais respostas são opcionais.</p>
        </div>
      </div>

      {isScheduled ? (
        <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 font-bold text-emerald-600"><CheckCircle2 size={18}/> Cancelamento solicitado e agendado</div>
          <p className="mt-2 text-sm leading-6 text-[var(--tx-text)]">A renovação automática foi desativada. Seu acesso ao plano <b>{String(request.plan || userData?.plan || "").toUpperCase()}</b> continuará até <b>{formatDate(request.period_end)}</b>.</p>
          <p className="mt-2 text-xs text-[var(--tx-muted)]">Solicitação registrada em {formatDate(request.created_at)}. Você receberá a confirmação por e-mail quando a assinatura for encerrada.</p>
        </div>
      ) : (
        <>
          {request?.status === "completed" && (
            <div className="mt-4 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-3 text-sm">
              Seu cancelamento anterior foi concluído em {formatDate(request.completed_at)}.
            </div>
          )}
          {!paidPlan ? (
            <p className="mt-4 rounded-xl bg-[var(--tx-surface-2)] p-4 text-sm text-[var(--tx-muted)]">Não identificamos uma assinatura paga ativa nesta conta. Se acredita que isso está incorreto, fale com o suporte.</p>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold">1. Qual é o principal motivo do cancelamento? <span className="text-red-500">*</span></label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {REASONS.map((item) => (
                    <label key={item} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-xs transition ${reason === item ? "border-[var(--tx-accent)] bg-[var(--tx-accent-soft)] text-[var(--tx-text)]" : "border-[var(--tx-border)] bg-[var(--tx-surface-2)] text-[var(--tx-muted)]"}`}>
                      <input type="radio" name="cancellation-reason" value={item} checked={reason === item} onChange={() => setReason(item)} className="mt-0.5 accent-[var(--tx-accent)]"/>
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold">2. Quer explicar melhor? <span className="font-normal text-[var(--tx-muted)]">(opcional)</span></label>
                <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={3000} rows={3} placeholder="Conte um pouco sobre sua experiência com o TubeX..." className="w-full rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-3 text-sm text-[var(--tx-text)] outline-none placeholder:text-[var(--tx-muted)] focus:border-[var(--tx-accent)]"/>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold">3. O que poderíamos melhorar? <span className="font-normal text-[var(--tx-muted)]">(opcional)</span></label>
                <textarea value={improvement} onChange={(e) => setImprovement(e.target.value)} maxLength={3000} rows={3} placeholder="Funcionalidades, preço, suporte, experiência..." className="w-full rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-3 text-sm text-[var(--tx-text)] outline-none placeholder:text-[var(--tx-muted)] focus:border-[var(--tx-accent)]"/>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold">4. Você considera voltar a utilizar o TubeX? <span className="font-normal text-[var(--tx-muted)]">(opcional)</span></label>
                <div className="flex flex-wrap gap-2">
                  {["Sim", "Talvez", "Não"].map((value) => (
                    <button key={value} type="button" onClick={() => setWouldReturn(value)} className={`rounded-full border px-4 py-2 text-xs font-bold ${wouldReturn === value ? "border-[var(--tx-accent)] bg-[var(--tx-accent-soft)] text-[var(--tx-text)]" : "border-[var(--tx-border)] text-[var(--tx-muted)]"}`}>{value}</button>
                  ))}
                </div>
              </div>
              {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-600"><AlertCircle className="mr-1 inline" size={14}/>{error}</p>}
              <div className="rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-3 text-xs leading-5 text-[var(--tx-muted)]">
                Ao enviar, a renovação automática será desativada no Stripe. Você continuará usando todos os recursos do plano até o fim do período já pago. Não haverá cancelamento imediato do acesso.
              </div>
              <button type="submit" disabled={!reason || loading} className="tx-btn tx-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? <><Loader2 className="animate-spin" size={15}/> Registrando solicitação...</> : <><Send size={15}/> Confirmar solicitação de cancelamento</>}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}

export default function CancellationAdmin() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/cancellations", { headers, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Falha ao carregar solicitações.");
      setRequests(payload.requests || []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar solicitações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => filter === "all" ? requests : requests.filter((item) => item.status === filter), [requests, filter]);
  const scheduled = requests.filter((item) => item.status === "scheduled").length;
  const completed = requests.filter((item) => item.status === "completed").length;
  const failed = requests.filter((item) => item.status === "failed").length;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="tx-kicker">GESTÃO DE ASSINATURAS</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Solicitações de cancelamento</h1><p className="mt-2 text-sm text-[var(--tx-muted)]">Histórico de motivos, respostas e datas. O Stripe encerra o acesso somente no fim do período pago.</p></div>
        <button onClick={() => void load()} className="tx-btn tx-btn-secondary"><RefreshCw size={14}/> Atualizar</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[["Total", requests.length], ["Agendados", scheduled], ["Concluídos", completed], ["Com falha", failed]].map(([label, value]) => <div key={String(label)} className="tx-surface rounded-2xl p-4"><p className="text-xs text-[var(--tx-muted)]">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}
      </div>
      <div className="flex flex-wrap gap-2">
        {[["all","Todos"],["scheduled","Agendados"],["completed","Concluídos"],["failed","Falhas"]].map(([value,label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-full border px-3 py-2 text-xs font-bold ${filter === value ? "border-[var(--tx-accent)] bg-[var(--tx-accent-soft)] text-[var(--tx-text)]" : "border-[var(--tx-border)] text-[var(--tx-muted)]"}`}>{label}</button>)}
      </div>
      {error && <p className="rounded-xl border border-red-500/30 p-3 text-sm text-red-600">{error}</p>}
      {loading ? <div className="tx-surface rounded-2xl p-8 text-center text-sm text-[var(--tx-muted)]"><Loader2 className="mr-2 inline animate-spin" size={16}/> Carregando histórico...</div> :
        filtered.length === 0 ? <div className="tx-surface rounded-2xl p-8 text-center text-sm text-[var(--tx-muted)]">Nenhuma solicitação encontrada.</div> :
        <div className="space-y-3">
          {filtered.map((item) => (
            <article key={item.id} className="tx-surface rounded-2xl border border-[var(--tx-border)] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-bold">{item.account_name || "Nome não informado"}</p><p className="text-xs text-[var(--tx-muted)]">{item.account_email}</p><p className="mt-1 text-xs text-[var(--tx-muted)]">{String(item.plan || "—").toUpperCase()} · {formatDate(item.created_at)}</p></div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black ${item.status === "scheduled" ? "bg-amber-500/10 text-amber-600" : item.status === "completed" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>{item.status === "scheduled" ? "Cancelamento agendado" : item.status === "completed" ? "Concluído" : item.status === "failed" ? "Falha" : item.status}</span>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-[var(--tx-surface-2)] p-3"><p className="text-[10px] font-bold uppercase text-[var(--tx-muted)]">Motivo principal</p><p className="mt-1 font-semibold">{item.reason}</p></div>
                <div className="rounded-xl bg-[var(--tx-surface-2)] p-3"><p className="text-[10px] font-bold uppercase text-[var(--tx-muted)]">Acesso até</p><p className="mt-1 font-semibold">{formatDate(item.period_end)}</p></div>
              </div>
              {item.feedback && <p className="mt-3 text-sm leading-6"><b>Comentário:</b> {item.feedback}</p>}
              {item.improvement && <p className="mt-2 text-sm leading-6"><b>Melhoria sugerida:</b> {item.improvement}</p>}
              {item.would_return && <p className="mt-2 text-xs text-[var(--tx-muted)]"><b>Voltaria:</b> {item.would_return}</p>}
              <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-[var(--tx-muted)]">
                <span>Stripe: {item.stripe_subscription_id || "—"}</span>
                <span>E-mail owner: {item.owner_email_sent ? "enviado" : "não confirmado"}</span>
                <span>E-mail usuário: {item.user_email_sent ? "enviado" : "não confirmado"}</span>
              </div>
            </article>
          ))}
        </div>
      }
    </section>
  );
}
