"use client";
import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
import {Activity,Users,Search,ShoppingCart,RefreshCw,AlertTriangle} from "lucide-react";

type Payload={days:number;totals:Record<string,number>;funnel:{name:string;value:number}[];modules:{name:string;value:number}[];events:{name:string;value:number}[];daily:{date:string;installs:number;searches:number;signups:number}[];recent:{user_id:string|null;install_id:string;event_name:string;module:string|null;created_at:string}[]};
const number=(v:number|undefined)=>new Intl.NumberFormat("pt-BR").format(v||0);
export default function AdminAnalytics(){
 const [data,setData]=useState<Payload|null>(null),[days,setDays]=useState(30),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){
  setLoading(true);setError("");
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session?.access_token) throw new Error("Sessão expirada. Entre novamente.");
   const res=await fetch(`/api/admin/analytics?days=${days}`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
   const json=await res.json();
   if(!res.ok) throw new Error(json.error==="forbidden"?"Acesso restrito ao proprietário.":json.error||"Falha ao carregar analytics.");
   setData(json);
  }catch(e:any){setError(e.message||"Não foi possível carregar os dados.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{load();},[days]);
 const maxModule=Math.max(1,...(data?.modules||[]).map(x=>x.value));
 return <div className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="tx-kicker">OWNER · INTELIGÊNCIA DO PRODUTO</p><h1 className="mt-2 text-3xl font-black">TubeX Analytics</h1><p className="mt-1 text-sm text-[var(--tx-muted)]">Aquisição, ativação, utilização e conversão da extensão.</p></div>
   <div className="flex gap-2"><select value={days} onChange={e=>setDays(Number(e.target.value))} className="rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] px-3 py-2 text-sm"><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={60}>60 dias</option><option value={90}>90 dias</option></select><button onClick={load} className="tx-btn tx-btn-secondary"><RefreshCw size={14}/> Atualizar</button></div>
  </div>
  {error&&<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"><AlertTriangle className="mr-2 inline" size={16}/>{error}</div>}
  {loading?<div className="tx-surface rounded-2xl p-8 text-center text-sm">Carregando eventos...</div>:data&&<>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {[
     ["Instalações",data.totals.installs,Activity],["Logins",data.totals.logins,Users],["Pesquisas/análises",data.totals.searches,Search],["Assinaturas confirmadas",data.totals.subscriptions,ShoppingCart]
    ].map(([label,value,Icon]:any)=><div key={label} className="tx-surface rounded-2xl p-5"><div className="flex justify-between text-[var(--tx-muted)]"><span className="text-xs font-bold">{label}</span><Icon size={17}/></div><p className="mt-3 text-3xl font-black">{number(value)}</p></div>)}
   </div>
   <section className="tx-surface rounded-2xl p-5">
    <h2 className="text-lg font-black">Atividade diária</h2>
    <p className="mb-5 mt-1 text-xs text-[var(--tx-muted)]">Instalações, pesquisas/análises e logins registrados por dia.</p>
    {data.daily.length ? <div className="flex h-44 items-end gap-1 overflow-x-auto pb-6">{data.daily.map((d)=>{
      const max=Math.max(1,...data.daily.map(x=>Math.max(x.installs,x.searches,x.signups)));
      return <div key={d.date} title={`${d.date} · Instalações ${d.installs} · Pesquisas ${d.searches} · Logins ${d.signups}`} className="flex h-full min-w-[18px] flex-1 flex-col justify-end gap-0.5">
       <div className="w-full rounded-t bg-amber-400" style={{height:`${Math.max(d.installs?3:0,d.installs/max*100)}%`}} />
       <div className="w-full bg-sky-500" style={{height:`${Math.max(d.searches?3:0,d.searches/max*100)}%`}} />
       <div className="w-full rounded-b bg-emerald-500" style={{height:`${Math.max(d.signups?3:0,d.signups/max*100)}%`}} />
       <span className="mt-1 -rotate-45 whitespace-nowrap text-[9px] text-[var(--tx-muted)]">{d.date.slice(5)}</span>
      </div>;
    })}</div> : <p className="text-sm text-[var(--tx-muted)]">Ainda não há atividade registrada no período.</p>}
    <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--tx-muted)]"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400"/>Instalações</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-500"/>Pesquisas/análises</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500"/>Logins</span></div>
   </section>
   <div className="grid gap-4 xl:grid-cols-2">
    <section className="tx-surface rounded-2xl p-5"><h2 className="text-lg font-black">Funil de ativação e conversão</h2><p className="mb-5 mt-1 text-xs text-[var(--tx-muted)]">Usuários únicos por etapa, quando identificados.</p><div className="space-y-4">{data.funnel.map((x,i)=>{const max=Math.max(1,data.funnel[0]?.value||0);return <div key={x.name}><div className="mb-1 flex justify-between text-xs"><span>{x.name}</span><b>{number(x.value)} {i>0&&max?`· ${Math.round(x.value/max*100)}%`:''}</b></div><div className="h-2 overflow-hidden rounded-full bg-[var(--tx-surface-2)]"><div className="h-full rounded-full bg-[var(--tx-accent)]" style={{width:`${Math.min(100,x.value/max*100)}%`}}/></div></div>})}</div></section>
    <section className="tx-surface rounded-2xl p-5"><h2 className="text-lg font-black">Módulos mais utilizados</h2><p className="mb-5 mt-1 text-xs text-[var(--tx-muted)]">Ações registradas pela extensão.</p>{data.modules.length? <div className="space-y-3">{data.modules.slice(0,12).map(x=><div key={x.name}><div className="mb-1 flex justify-between text-xs"><span>{x.name}</span><b>{number(x.value)}</b></div><div className="h-2 overflow-hidden rounded-full bg-[var(--tx-surface-2)]"><div className="h-full rounded-full bg-sky-500" style={{width:`${x.value/maxModule*100}%`}}/></div></div>)}</div>:<p className="text-sm text-[var(--tx-muted)]">Ainda não há eventos de módulos.</p>}</section>
   </div>
   <div className="grid gap-4 xl:grid-cols-2">
    <section className="tx-surface rounded-2xl p-5"><h2 className="text-lg font-black">Eventos recentes</h2><div className="mt-4 max-h-[420px] overflow-auto"><table className="w-full text-left text-xs"><thead><tr className="text-[var(--tx-muted)]"><th className="py-2">Evento</th><th>Módulo</th><th>Data</th></tr></thead><tbody>{data.recent.slice(0,60).map((e,i)=><tr key={i} className="border-t border-[var(--tx-border)]"><td className="py-2 font-semibold">{e.event_name}</td><td>{e.module||"—"}</td><td>{new Date(e.created_at).toLocaleString("pt-BR")}</td></tr>)}</tbody></table></div></section>
    <section className="tx-surface rounded-2xl p-5"><h2 className="text-lg font-black">Eventos por tipo</h2><div className="mt-4 max-h-[420px] overflow-auto"><table className="w-full text-left text-xs"><thead><tr className="text-[var(--tx-muted)]"><th className="py-2">Evento</th><th className="text-right">Quantidade</th></tr></thead><tbody>{data.events.map(x=><tr key={x.name} className="border-t border-[var(--tx-border)]"><td className="py-2">{x.name}</td><td className="text-right font-bold">{number(x.value)}</td></tr>)}</tbody></table></div></section>
   </div>
  </>}
 </div>;
}
