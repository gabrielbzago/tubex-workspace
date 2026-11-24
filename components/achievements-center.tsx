"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, Bell, CheckCircle2, Circle, Crown, Flame, Loader2, Mail, RefreshCw, ShieldCheck, Sparkles, Star, Target, Trophy, Video } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Achievement = {
  code: string; title: string; description: string; category: string; metric: string;
  threshold: number; tier: string; points: number; importance: string;
  unlocked: boolean; unlocked_at: string | null; progress: number; current_value: number;
};
type Payload = {
  profile: any;
  cohort: {
    band: string;
    sample_size: number;
    percentile: number | null;
    disclaimer: string;
  } | null;
  achievements: Achievement[];
  history: any[];
  goals: any[];
  preferences: { email_enabled: boolean; weekly_digest_enabled: boolean; important_email_enabled: boolean };
  points: number;
};

const fmt = (value: number) => new Intl.NumberFormat("pt-BR", { notation: value > 99999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value || 0);
const categoryLabels: Record<string, string> = { subscribers: "Inscritos", views: "Visualizações", publishing: "Publicações", performance: "Desempenho", growth: "Crescimento" };
const tierLabels: Record<string, string> = { bronze: "Bronze", silver: "Prata", gold: "Ouro", platinum: "Platina" };
const tierColors: Record<string, string> = { bronze: "text-orange-500", silver: "text-slate-400", gold: "text-amber-500", platinum: "text-cyan-500" };

export default function AchievementsCenter({ user }: { user: any }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalMetric, setGoalMetric] = useState("subscriber_count");
  const [goalTarget, setGoalTarget] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const authHeaders = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Sua sessão do TubeX expirou. Entre novamente.");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/achievements", { headers, cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "Não foi possível carregar suas conquistas.");
      setData(result);
    } catch (err: any) { setError(err?.message || "Falha ao carregar conquistas."); }
    finally { setLoading(false); }
  }, [authHeaders]);

  const sync = useCallback(async () => {
    setSyncing(true); setError(""); setNotice("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session as any;
      const accessToken = String(session?.provider_token || "");
      if (!accessToken) {
        const options = {
          redirectTo: `${window.location.origin}/dashboard`,
          scopes: "openid email profile https://www.googleapis.com/auth/youtube.readonly",
          queryParams: { access_type: "offline", prompt: "consent" },
        };
        const currentUser = session?.user;
        const hasGoogleIdentity = (currentUser?.identities || []).some((identity: any) => identity.provider === "google");
        const result = currentUser && !hasGoogleIdentity
          ? await supabase.auth.linkIdentity({ provider: "google", options })
          : await supabase.auth.signInWithOAuth({ provider: "google", options });
        if (result.error) throw result.error;
        return;
      }
      const headers = await authHeaders();
      const response = await fetch("/api/achievements", {
        method: "POST", headers,
        body: JSON.stringify({ action: "sync_channel", accessToken }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "Não foi possível sincronizar o canal.");
      setNotice(result.newlyUnlocked?.length
        ? `Parabéns! ${result.newlyUnlocked.length} nova(s) conquista(s) desbloqueada(s).`
        : "Métricas do canal atualizadas.");
      await load();
    } catch (err: any) { setError(err?.message || "Falha na sincronização."); }
    finally { setSyncing(false); }
  }, [authHeaders, load]);

  useEffect(() => {
    void load();
    let active = true;
    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (active && sessionData.session?.provider_token) void sync();
    });
    return () => { active = false; };
  }, [load, sync]);

  const filtered = useMemo(() => (data?.achievements || []).filter(item => filter === "all" || (filter === "unlocked" ? item.unlocked : filter === "locked" ? !item.unlocked : item.category === filter)), [data, filter]);
  const unlockedCount = data?.achievements.filter(item => item.unlocked).length || 0;
  const next = data?.achievements.filter(item => !item.unlocked).sort((a, b) => b.progress - a.progress)[0];
  const featuredAchievement = data?.achievements.filter(item => item.unlocked).sort((a, b) => new Date(b.unlocked_at || 0).getTime() - new Date(a.unlocked_at || 0).getTime())[0];

  async function sendTestAchievementEmail() {
    setSendingTestEmail(true); setError(""); setNotice("");
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/achievements/test-email", { method: "POST", headers });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "Não foi possível enviar o e-mail de teste.");
      setNotice(`E-mail de demonstração enviado para ${result.to}. Confira sua caixa de entrada.`);
    } catch (err: any) { setError(err?.message || "Falha ao enviar o e-mail de demonstração."); }
    finally { setSendingTestEmail(false); }
  }

  function downloadAchievementCard() {
    if (!featuredAchievement || !data?.profile) return;
    const xml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char] || char));
    const title = xml(featuredAchievement.title);
    const channel = xml(data.profile.channel_title || "Meu canal");
    const value = xml(fmt(featuredAchievement.current_value));
    const tier = String(featuredAchievement.tier || "gold").toLowerCase();
    const tierName = ({ bronze: "BRONZE", silver: "PRATA", gold: "OURO", platinum: "PLATINA" } as Record<string,string>)[tier] || "CONQUISTA";
    const date = featuredAchievement.unlocked_at
      ? new Date(featuredAchievement.unlocked_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const avatar = String(data.profile.channel_thumbnail || "");
    const avatarMarkup = /^https:\/\/[^"'<> ]+$/i.test(avatar)
      ? `<image href="${xml(avatar)}" x="510" y="300" width="180" height="180" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
      : `<circle cx="600" cy="390" r="90" fill="#353b4c"/><text x="600" y="418" fill="#f7c94b" font-family="Arial,sans-serif" font-size="78" font-weight="800" text-anchor="middle">${xml(channel.slice(0,1).toUpperCase())}</text>`;
    const palette = tier === "platinum"
      ? { a: "#d9f5ff", b: "#6bc7e8", c: "#174a68" }
      : tier === "silver"
      ? { a: "#f4f7fb", b: "#9daabd", c: "#39465a" }
      : tier === "bronze"
      ? { a: "#f6c69a", b: "#b96d38", c: "#60351f" }
      : { a: "#ffe69a", b: "#e5a92e", c: "#6b430d" };
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="1350" viewBox="0 0 1200 1350">
<defs>
 <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#101522"/><stop offset=".55" stop-color="#1c2434"/><stop offset="1" stop-color="#101522"/></linearGradient>
 <radialGradient id="glow"><stop stop-color="${palette.b}" stop-opacity=".32"/><stop offset="1" stop-color="${palette.b}" stop-opacity="0"/></radialGradient>
 <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette.a}"/><stop offset=".5" stop-color="${palette.b}"/><stop offset="1" stop-color="${palette.c}"/></linearGradient>
 <linearGradient id="goldText"><stop stop-color="#fff0b6"/><stop offset="1" stop-color="${palette.b}"/></linearGradient>
 <clipPath id="avatarClip"><circle cx="600" cy="390" r="90"/></clipPath>
 <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
</defs>
<rect width="1200" height="1350" rx="58" fill="url(#bg)"/>
<circle cx="600" cy="360" r="430" fill="url(#glow)"/>
<path d="M58 170H1142" stroke="#ffffff" stroke-opacity=".12"/>
<rect x="72" y="58" width="1056" height="78" rx="22" fill="#ffffff" fill-opacity=".055" stroke="#ffffff" stroke-opacity=".1"/>
<rect x="96" y="78" width="38" height="38" rx="11" fill="#f4c542"/><text x="115" y="105" fill="#151923" font-family="Arial,sans-serif" font-size="19" font-weight="900" text-anchor="middle">TX</text>
<text x="152" y="107" fill="#ffffff" font-family="Arial,sans-serif" font-size="32" font-weight="900">Tube<tspan fill="#f4c542">X</tspan></text>
<text x="1100" y="105" fill="#b9c1d2" font-family="Arial,sans-serif" font-size="17" font-weight="700" text-anchor="end">CREATOR ACHIEVEMENTS</text>
<text x="600" y="235" fill="#cbd2df" font-family="Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="6" text-anchor="middle">CONQUISTA DESBLOQUEADA</text>
<circle cx="600" cy="420" r="210" fill="${palette.b}" opacity=".13" filter="url(#shadow)"/>
<circle cx="600" cy="390" r="190" fill="#141b29" stroke="url(#metal)" stroke-width="13"/>
<circle cx="600" cy="390" r="168" fill="none" stroke="${palette.a}" stroke-opacity=".55" stroke-width="2"/>
<path d="M600 258l39 79 87 13-63 61 15 87-78-41-78 41 15-87-63-61 87-13z" fill="url(#metal)" stroke="${palette.a}" stroke-width="4" stroke-linejoin="round"/>
<circle cx="600" cy="390" r="90" fill="#1b2231" stroke="#fff" stroke-opacity=".85" stroke-width="8"/>
${avatarMarkup}
<circle cx="600" cy="390" r="101" fill="none" stroke="url(#metal)" stroke-width="10"/>
<rect x="460" y="595" width="280" height="54" rx="27" fill="url(#metal)"/>
<text x="600" y="631" fill="${palette.c}" font-family="Arial,sans-serif" font-size="22" font-weight="900" letter-spacing="3" text-anchor="middle">${tierName}</text>
<text x="600" y="730" fill="#ffffff" font-family="Arial,sans-serif" font-size="54" font-weight="900" text-anchor="middle">${title}</text>
<text x="600" y="835" fill="url(#goldText)" font-family="Arial,sans-serif" font-size="100" font-weight="900" text-anchor="middle">${value}</text>
<text x="600" y="900" fill="#e6eaf2" font-family="Arial,sans-serif" font-size="35" font-weight="700" text-anchor="middle">${channel}</text>
<rect x="250" y="965" width="700" height="2" fill="#ffffff" fill-opacity=".15"/>
<text x="600" y="1030" fill="#9faabd" font-family="Arial,sans-serif" font-size="20" font-weight="700" letter-spacing="3" text-anchor="middle">CONQUISTA ALCANÇADA EM</text>
<text x="600" y="1080" fill="#ffffff" font-family="Arial,sans-serif" font-size="32" font-weight="800" text-anchor="middle">${xml(date)}</text>
<rect x="230" y="1150" width="740" height="82" rx="18" fill="#ffffff" fill-opacity=".055" stroke="#ffffff" stroke-opacity=".12"/>
<text x="600" y="1199" fill="#f4c542" font-family="Arial,sans-serif" font-size="23" font-weight="800" text-anchor="middle">SUA EVOLUÇÃO MERECE SER RECONHECIDA</text>
<text x="600" y="1290" fill="#8e99ad" font-family="Arial,sans-serif" font-size="19" letter-spacing="2" text-anchor="middle">TUBEXAI.COM.BR</text>
</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "tubex-conquista-premium.svg"; link.click(); URL.revokeObjectURL(url);
  }

  async function shareAchievementCard() {
    if (!featuredAchievement || !data?.profile) return;
    const message = `Conquista desbloqueada no TubeX! ${data.profile.channel_title}: ${featuredAchievement.title}. Minha evolução merece ser reconhecida!`;
    try {
      if (navigator.share) await navigator.share({ title: "Minha conquista TubeX", text: message, url: "https://tubexai.com.br" });
      else { await navigator.clipboard.writeText(message); setNotice("Texto da conquista copiado para compartilhar!"); }
    } catch (err: any) { if (err?.name !== "AbortError") setError("Não foi possível abrir o compartilhamento neste navegador."); }
  }

  async function saveGoal(event: React.FormEvent) {
    event.preventDefault(); setSavingGoal(true); setError(""); setNotice("");
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/achievements", {
        method: "POST", headers,
        body: JSON.stringify({ action: "create_goal", title: goalTitle, metric: goalMetric, target_value: Number(goalTarget) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "Não foi possível criar a meta.");
      setGoalTitle(""); setGoalTarget(""); setNotice("Meta criada! Ela será atualizada nas próximas sincronizações.");
      await load();
    } catch (err: any) { setError(err?.message || "Falha ao criar meta."); }
    finally { setSavingGoal(false); }
  }

  async function savePreferences(key: "email_enabled" | "weekly_digest_enabled" | "important_email_enabled", value: boolean) {
    if (!data) return;
    const preferences = { ...data.preferences, [key]: value };
    setData({ ...data, preferences });
    try {
      const headers = await authHeaders();
      await fetch("/api/achievements", { method: "POST", headers, body: JSON.stringify({ action: "save_preferences", ...preferences }) });
    } catch { setError("Não foi possível salvar as preferências de e-mail."); }
  }

  if (loading) return <div className="tx-surface flex items-center gap-3 rounded-2xl p-8"><Loader2 className="animate-spin" size={20}/> Carregando suas conquistas...</div>;

  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[24px] border border-[var(--tx-accent)]/40 bg-[linear-gradient(115deg,var(--tx-surface),color-mix(in_srgb,var(--tx-accent)_13%,var(--tx-surface)))] p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--tx-accent)] opacity-[.12] blur-3xl"/>
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="tx-kicker flex items-center gap-2"><Trophy size={14}/> TubeX Creator Achievements</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Sua evolução merece ser reconhecida.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--tx-muted)]">Conquiste medalhas, acompanhe suas metas e transforme cada marco do canal em uma vitória.</p></div>
        <button onClick={sync} disabled={syncing} className="tx-btn tx-btn-primary shrink-0"><RefreshCw size={15} className={syncing ? "animate-spin" : ""}/>{syncing ? "Sincronizando..." : "Atualizar meu canal"}</button>
      </div>
      {data?.profile && <div className="relative mt-5 flex items-center gap-3 rounded-2xl border border-[var(--tx-border)] bg-[var(--tx-surface)]/80 p-3">
        {data.profile.channel_thumbnail ? <img src={data.profile.channel_thumbnail} alt="" className="h-12 w-12 rounded-full object-cover"/> : <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--tx-accent-soft)]"><Video/></div>}
        <div className="min-w-0 flex-1"><p className="truncate font-black">{data.profile.channel_title}</p><p className="text-xs text-[var(--tx-muted)]">Última atualização: {data.profile.last_synced_at ? new Date(data.profile.last_synced_at).toLocaleString("pt-BR") : "—"}</p></div>
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">Conectado</span>
      </div>}
    </section>

    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">{notice}</div>}

    {featuredAchievement && data?.profile && <section className="tx-surface overflow-hidden rounded-3xl border border-[var(--tx-accent)]/40">
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-center lg:p-7">
        <div>
          <p className="tx-kicker flex items-center gap-2"><Sparkles size={14}/> Conquista em destaque</p>
          <h2 className="mt-2 text-2xl font-black">Sua vitória merece ser compartilhada.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--tx-muted)]">Criamos um card oficial TubeX com sua conquista, seu canal e a marca que você alcançou. Baixe, compartilhe ou envie para seu e-mail para conferir como ele chega.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={downloadAchievementCard} className="tx-btn tx-btn-primary"><Award size={15}/> Baixar card SVG</button>
            <button onClick={shareAchievementCard} className="tx-btn"><RefreshCw size={15}/> Compartilhar</button>
            <button onClick={sendTestAchievementEmail} disabled={sendingTestEmail} className="tx-btn disabled:opacity-50"><Mail size={15} className={sendingTestEmail ? "animate-pulse" : ""}/>{sendingTestEmail ? "Enviando..." : "Enviar conquista por e-mail"}</button>
          </div>
          <p className="mt-3 text-xs text-[var(--tx-muted)]">O e-mail de demonstração será enviado para o endereço cadastrado na sua conta TubeX.</p>
        </div>
        <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[28px] border border-amber-300/30 bg-[radial-gradient(circle_at_50%_26%,#39445a_0%,#1b2231_42%,#101522_100%)] p-6 text-center text-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-2 text-lg font-black"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f4c542] text-sm text-[#171923]">TX</span> Tube<span className="text-[#f4c542]">X</span></div><span className="text-[9px] font-bold tracking-widest text-slate-400">CREATOR ACHIEVEMENTS</span></div>
          <p className="mt-6 text-[10px] font-extrabold tracking-[.22em] text-[#f4c542]">CONQUISTA DESBLOQUEADA</p>
          <div className="relative mx-auto mt-5 grid h-40 w-40 place-items-center rounded-full border-[8px] border-amber-300 bg-[radial-gradient(circle,#ffe69a,#d99727)] shadow-[0_0_55px_rgba(244,197,66,.25)]"><Award size={76} className="text-[#68400d]"/>{data.profile.channel_thumbnail && <img src={data.profile.channel_thumbnail} alt="" className="absolute -bottom-1 -right-1 h-12 w-12 rounded-full border-4 border-[#e7b64c] object-cover"/>}</div>
          <span className="mt-5 inline-flex rounded-full bg-gradient-to-r from-amber-200 to-amber-500 px-5 py-1.5 text-[10px] font-black tracking-[.18em] text-amber-950">{tierLabels[featuredAchievement.tier] || "CONQUISTA"}</span>
          <h3 className="mt-4 text-2xl font-black leading-tight">{featuredAchievement.title}</h3>
          <p className="mt-2 text-4xl font-black text-[#f4c542]">{fmt(featuredAchievement.current_value)}</p>
          <p className="mt-2 text-sm font-bold text-slate-200">{data.profile.channel_title}</p>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Conquistada em {featuredAchievement.unlocked_at ? new Date(featuredAchievement.unlocked_at).toLocaleDateString("pt-BR") : "hoje"}</p>
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-bold tracking-wider text-slate-200">SUA EVOLUÇÃO MERECE SER RECONHECIDA</div>
          <p className="mt-4 text-[10px] tracking-widest text-slate-400">TUBEXAI.COM.BR</p>
        </div>
      </div>
    </section>}
    {!data?.profile && <section className="tx-surface rounded-2xl p-6"><div className="flex items-start gap-3"><Video className="mt-1 text-red-500"/><div><h2 className="text-lg font-black">Conecte seu canal do YouTube</h2><p className="mt-1 text-sm text-[var(--tx-muted)]">Para reconhecer suas conquistas automaticamente, autorize a leitura das estatísticas públicas do canal que você administra.</p><button onClick={sync} className="tx-btn tx-btn-primary mt-4">Conectar YouTube</button></div></div></section>}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={<Trophy/>} label="Conquistas desbloqueadas" value={`${unlockedCount}/${data?.achievements.length || 0}`}/>
      <Metric icon={<Star/>} label="Pontos conquistados" value={fmt(data?.points || 0)}/>
      <Metric icon={<Target/>} label="Metas ativas" value={String(data?.goals.filter(g => g.status === "active").length || 0)}/>
      <Metric icon={<Flame/>} label="Próxima conquista" value={next ? `${Math.max(0, next.threshold - next.current_value).toLocaleString("pt-BR")} restantes` : "Todas concluídas"}/>
    </section>

    {data?.history && data.history.length >= 2 && <section className="tx-surface rounded-2xl p-5"><p className="tx-kicker">Evolução do seu canal</p><h2 className="mt-1 text-xl font-black">Você contra seu próprio histórico</h2><p className="mt-1 text-xs text-[var(--tx-muted)]">Comparação entre o registro mais recente e o primeiro registro disponível nesta série.</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{[["Inscritos", "subscriber_count"], ["Visualizações", "total_views"], ["Vídeos", "video_count"]].map(([label,key])=>{const latest=Number(data.history[0]?.[key]||0);const earliest=Number(data.history[data.history.length-1]?.[key]||0);const delta=Math.max(0,latest-earliest);return <div key={key} className="rounded-xl bg-[var(--tx-surface-2)] p-3"><p className="text-xs text-[var(--tx-muted)]">{label}</p><p className="mt-1 text-xl font-black">{fmt(latest)}</p><p className="mt-1 text-xs font-bold text-emerald-600">+{fmt(delta)} no histórico registrado</p></div>})}</div></section>}

    {data?.cohort && <section className="tx-surface rounded-2xl p-5"><div className="flex items-start justify-between gap-3"><div><p className="tx-kicker">Comparação por faixa</p><h2 className="mt-1 text-xl font-black">Canais {data.cohort.band}</h2><p className="mt-1 text-xs text-[var(--tx-muted)]">Comparação com uma amostra de canais públicos acompanhados pelo TubeX.</p></div><Crown className="text-[var(--tx-accent)]" size={28}/></div>{data.cohort.percentile !== null ? <div className="mt-4 flex items-end gap-3"><strong className="text-4xl font-black">{data.cohort.percentile}º</strong><div className="pb-1 text-sm text-[var(--tx-muted)]">percentil na amostra de {data.cohort.sample_size} canais</div></div> : <p className="mt-4 text-sm text-[var(--tx-muted)]">Ainda precisamos de pelo menos 10 canais da mesma faixa para apresentar uma comparação confiável. Amostra atual: {data.cohort.sample_size}.</p>}<p className="mt-3 text-[10px] leading-4 text-[var(--tx-muted)]">{data.cohort.disclaimer}</p></section>}

    {next && <section className="tx-surface rounded-2xl p-5"><div className="flex items-center justify-between gap-3"><div><p className="tx-kicker">Sua próxima conquista</p><h2 className="mt-1 text-xl font-black">{next.title}</h2><p className="mt-1 text-xs text-[var(--tx-muted)]">{next.description}</p></div><Award className={`shrink-0 ${tierColors[next.tier] || "text-amber-500"}`} size={34}/></div><Progress value={next.progress}/><div className="mt-2 flex justify-between text-xs text-[var(--tx-muted)]"><span>{fmt(next.current_value)} alcançados</span><span>Meta: {fmt(next.threshold)}</span></div></section>}

    <section className="tx-surface rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="tx-kicker">Biblioteca</p><h2 className="text-xl font-black">Todas as conquistas</h2></div><div className="flex flex-wrap gap-2">{[["all","Todas"],["unlocked","Desbloqueadas"],["locked","Bloqueadas"],["subscribers","Inscritos"],["views","Visualizações"],["publishing","Publicações"]].map(([value,label])=><button key={value} onClick={()=>setFilter(value)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${filter===value?"border-[var(--tx-accent)] bg-[var(--tx-accent-soft)]":"border-[var(--tx-border)] text-[var(--tx-muted)]"}`}>{label}</button>)}</div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map(item=><article key={item.code} className={`rounded-2xl border p-4 ${item.unlocked?"border-[var(--tx-accent)]/50 bg-[var(--tx-accent-soft)]/30":"border-[var(--tx-border)] bg-[var(--tx-surface-2)] opacity-85"}`}>
          <div className="flex items-start justify-between gap-2"><div className={`grid h-11 w-11 place-items-center rounded-xl ${item.unlocked?"bg-[var(--tx-accent-soft)]":"bg-[var(--tx-surface)]"}`}><Award className={tierColors[item.tier] || "text-[var(--tx-muted)]"} size={23}/></div><span className={`text-[10px] font-black uppercase ${tierColors[item.tier] || "text-[var(--tx-muted)]"}`}>{tierLabels[item.tier] || item.tier}</span></div>
          <h3 className="mt-3 font-black">{item.title}</h3><p className="mt-1 min-h-10 text-xs leading-5 text-[var(--tx-muted)]">{item.description}</p>
          {item.unlocked ? <p className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 size={14}/> Conquistada {item.unlocked_at ? new Date(item.unlocked_at).toLocaleDateString("pt-BR") : ""}</p> : <><Progress value={item.progress}/><p className="mt-2 text-[10px] text-[var(--tx-muted)]">{fmt(item.current_value)} / {fmt(item.threshold)} · {item.points} pontos</p></>}
        </article>)}
      </div>
      {!filtered.length && <p className="py-8 text-center text-sm text-[var(--tx-muted)]">Nenhuma conquista nesta categoria.</p>}
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <div className="tx-surface rounded-2xl p-5"><p className="tx-kicker flex items-center gap-2"><Target size={14}/> Metas pessoais</p><h2 className="mt-1 text-xl font-black">Escolha seu próximo marco</h2>
        <form onSubmit={saveGoal} className="mt-4 grid gap-3">
          <input value={goalTitle} onChange={e=>setGoalTitle(e.target.value)} required maxLength={100} placeholder="Ex.: Chegar a 2.000 inscritos" className="w-full rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-3 py-3 text-sm"/>
          <select value={goalMetric} onChange={e=>setGoalMetric(e.target.value)} className="w-full rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-3 py-3 text-sm"><option value="subscriber_count">Inscritos</option><option value="total_views">Visualizações acumuladas</option><option value="video_count">Vídeos publicados</option></select>
          <input value={goalTarget} onChange={e=>setGoalTarget(e.target.value)} required type="number" min="1" step="1" placeholder="Valor da meta" className="w-full rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-3 py-3 text-sm"/>
          <button disabled={savingGoal || !data?.profile} className="tx-btn tx-btn-primary justify-center disabled:opacity-50">{savingGoal ? "Salvando..." : "Criar meta"}</button>
        </form>
        <div className="mt-5 space-y-3">{(data?.goals || []).map(goal=><div key={goal.id} className="rounded-xl border border-[var(--tx-border)] p-3"><div className="flex justify-between gap-3"><strong className="text-sm">{goal.title}</strong><span className="text-xs text-[var(--tx-muted)]">{goal.status==="completed"?"Concluída":"Em andamento"}</span></div><Progress value={Math.min(100,goal.current_value/Math.max(1,goal.target_value)*100)}/><p className="mt-1 text-xs text-[var(--tx-muted)]">{fmt(goal.current_value)} / {fmt(goal.target_value)}</p></div>)}</div>
      </div>
      <div className="tx-surface rounded-2xl p-5"><p className="tx-kicker flex items-center gap-2"><Mail size={14}/> Notificações</p><h2 className="mt-1 text-xl font-black">Seu resumo TubeX</h2><p className="mt-2 text-sm text-[var(--tx-muted)]">Receba um resumo semanal com novas conquistas e evolução do canal. Não enviaremos mensagens quando não houver novidades.</p>
        <div className="mt-4 space-y-3">
          <Preference label="Receber e-mails do TubeX Conquistas" checked={data?.preferences.email_enabled !== false} onChange={(v: boolean)=>savePreferences("email_enabled",v)}/>
          <Preference label="Resumo semanal" checked={data?.preferences.weekly_digest_enabled !== false} onChange={(v: boolean)=>savePreferences("weekly_digest_enabled",v)}/>
          <Preference label="Avisos de conquistas importantes" checked={data?.preferences.important_email_enabled !== false} onChange={(v: boolean)=>savePreferences("important_email_enabled",v)}/>
        </div>
        <div className="mt-5 rounded-xl bg-[var(--tx-surface-2)] p-3 text-xs text-[var(--tx-muted)]"><ShieldCheck size={14} className="mb-1"/> As métricas públicas são obtidas do YouTube Data API. Métricas privadas, como CTR, retenção e receita, serão adicionadas apenas com autorização do YouTube Analytics.</div>
      </div>
    </section>
  </div>;
}

function Metric({ icon, label, value }: any) {
  return <div className="tx-surface rounded-2xl p-4"><div className="flex items-center justify-between text-[var(--tx-muted)]"><span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>{icon}</div><p className="mt-3 text-2xl font-black">{value}</p></div>;
}
function Progress({ value }: { value: number }) {
  return <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--tx-surface-2)]"><div className="h-full rounded-full bg-[var(--tx-accent)] transition-all" style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }}/></div>;
}
function Preference({ label, checked, onChange }: any) {
  return <label className="flex cursor-pointer items-center justify-between gap-3 text-sm"><span>{label}</span><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} className="h-4 w-4 accent-amber-500"/></label>;
}
