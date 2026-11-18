"use client";
import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import {Activity,Users,Search,ShoppingCart,RefreshCw,AlertTriangle} from "lucide-react";

type Daily={date:string;installs:number;searches:number;logins:number};
type ExtensionUser={install_id:string;email:string;name:string|null;picture:string|null;user_id:string|null;plan:string;account_status:string|null;extension_version:string|null;first_seen:string;last_seen:string};
type Payload={days:number;totals:Record<string,number>;funnel:{name:string;value:number}[];modules:{name:string;label:string;value:number;actions:number}[];events:{name:string;value:number}[];daily:Daily[];extensionUsers:ExtensionUser[];recent:{user_id:string|null;install_id:string;event_name:string;module:string|null;module_label:string|null;created_at:string}[]};
const number=(v:number|undefined)=>new Intl.NumberFormat("pt-BR").format(v||0);
const SERIES=[
 {key:"installs",label:"Instalações",color:"#f59e0b"},
 {key:"searches",label:"Pesquisas/análises",color:"#0ea5e9"},
 {key:"logins",label:"Logins",color:"#10b981"},
] as const;
type SeriesKey=typeof SERIES[number]["key"];
function DailyActivityChart({daily,days}:{daily:Daily[];days:number}){
 const [visible,setVisible]=useState<Record<SeriesKey,boolean>>({installs:true,searches:true,logins:true});
 const [hovered,setHovered]=useState<number|null>(null);
 const width=960,height=290,left=48,right=22,top=18,bottom=48;
 const plotW=width-left-right,plotH=height-top-bottom;
 const maxValue=Math.max(1,...daily.map(d=>Math.max(d.installs,d.searches,d.logins)));
 const yMax=Math.max(4,Math.ceil(maxValue/4)*4);
 const x=(i:number)=>left+(daily.length<=1?plotW/2:(i/(daily.length-1))*plotW);
 const y=(v:number)=>top+plotH-(v/yMax)*plotH;
 const labelDate=(date:string)=>new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
 const tickIndices=useMemo(()=>{
  if(daily.length<=7)return daily.map((_,i)=>i);
  const count=days<=7?7:days<=30?6:7;
  return Array.from(new Set(Array.from({length:count},(_,i)=>Math.round(i*(daily.length-1)/(count-1)))));
 },[daily,days]);
 const linePath=(key:SeriesKey)=>daily.map((d,i)=>`${i===0?"M":"L"} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(" ");
 const current=hovered===null?null:daily[hovered];
 return <div className="space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div className="flex flex-wrap gap-2" aria-label="Legenda do gráfico">
    {SERIES.map(series=><button key={series.key} type="button" onClick={()=>setVisible(v=>({...v,[series.key]:!v[series.key]}))} aria-pressed={visible[series.key]} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${visible[series.key]?"border-[var(--tx-border)] bg-[var(--tx-surface-2)] text-[var(--tx-text)]":"border-transparent text-[var(--tx-muted)] opacity-50"}`}><span className="h-2.5 w-2.5 rounded-full" style={{background:series.color}}/><span>{series.label}</span></button>)}
   </div>
   <span className="text-[11px] text-[var(--tx-muted)]">{daily.length} dias no histórico</span>
  </div>
  <div className="relative overflow-hidden rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] p-2 sm:p-3">
   {current&&<div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--tx-surface-2)] px-3 py-2 text-xs"><b>{new Date(`${current.date}T12:00:00`).toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"long",year:"numeric"})}</b><div className="flex flex-wrap gap-x-3 gap-y-1">{SERIES.map(s=><span key={s.key} style={{color:s.color}}>{s.label}: <b>{number(current[s.key])}</b></span>)}</div></div>}
   <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Atividade diária dos últimos ${days} dias: instalações, pesquisas e logins`} className="block h-auto w-full" onMouseLeave={()=>setHovered(null)}>
    {Array.from({length:5},(_,i)=>{const value=yMax-(yMax/4)*i;const yy=top+(plotH/4)*i;return <g key={i}><line x1={left} x2={width-right} y1={yy} y2={yy} stroke="currentColor" opacity=".10" strokeDasharray="4 5"/><text x={left-10} y={yy+4} textAnchor="end" fill="currentColor" opacity=".58" fontSize="11">{Math.round(value)}</text></g>})}
    {tickIndices.map(i=><text key={i} x={x(i)} y={height-15} textAnchor="middle" fill="currentColor" opacity=".62" fontSize="11">{labelDate(daily[i].date)}</text>)}
    {hovered!==null&&<line x1={x(hovered)} x2={x(hovered)} y1={top} y2={top+plotH} stroke="currentColor" opacity=".25" strokeDasharray="3 4"/>}
    {SERIES.map(series=>visible[series.key]&&<g key={series.key}><path d={linePath(series.key)} fill="none" stroke={series.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>{daily.map((d,i)=><circle key={`${series.key}-${d.date}`} cx={x(i)} cy={y(d[series.key])} r={hovered===i?5:2.7} fill={series.color} stroke="var(--tx-surface)" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/> )}</g>)}
    {daily.map((d,i)=><rect key={`hit-${d.date}`} x={x(i)-(plotW/Math.max(daily.length,1))/2} y={top} width={plotW/Math.max(daily.length,1)} height={plotH} fill="transparent" onMouseEnter={()=>setHovered(i)} onFocus={()=>setHovered(i)} tabIndex={0} role="button" aria-label={`${labelDate(d.date)}: ${d.installs} instalações, ${d.searches} pesquisas, ${d.logins} logins`}/>)}
   </svg>
  </div>
  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--tx-muted)]"><span>Quantidade de eventos por dia</span><span>Passe o mouse ou toque nos pontos para consultar o histórico</span></div>
 </div>;
}
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
    {[["Instalações",data.totals.installs,Activity],["Logins",data.totals.logins,Users],["Pesquisas/análises",data.totals.searches,Search],["Assinaturas confirmadas",data.totals.subscriptions,ShoppingCart]].map(([label,value,Icon]:any)=><div key={label} className="tx-surface rounded-2xl p-5"><div className="flex justify-between text-[var(--tx-muted)]"><span className="text-xs font-bold">{label}</span><Icon size={17}/></div><p className="mt-3 text-3xl font-black">{number(value)}</p></div>)}
   </div>
   <section className="tx-surface rounded-2xl p-5">
    <div className="mb-4"><h2 className="text-lg font-black">Atividade diária</h2><p className="mt-1 text-xs text-[var(--tx-muted)]">Evolução diária de instalações, pesquisas/análises e logins no período selecionado.</p></div>
    {data.daily.length?<DailyActivityChart daily={data.daily} days={days}/>:<p className="text-sm text-[var(--tx-muted)]">Ainda não há atividade registrada no período.</p>}
   </section>
   <div className="grid gap-4 xl:grid-cols-2">
    <section className="tx-surface rounded-2xl p-5"><h2 className="text-lg font-black">Funil de ativação e conversão</h2><p className="mb-5 mt-1 text-xs text-[var(--tx-muted)]">Etapas de atividade no período; assinaturas mostram o total ativo atual.</p><div className="space-y-4">{data.funnel.map((x,i)=>{const max=Math.max(1,data.funnel[0]?.value||0);const currentSubscriptions=x.name.startsWith("Assinaturas ativas");return <div key={x.name}><div className="mb-1 flex justify-between text-xs"><span>{x.name}</span><b>{number(x.value)} {i>0&&!currentSubscriptions&&max?`· ${Math.round(x.value/max*100)}%`:''}</b></div><div className="h-2 overflow-hidden rounded-full bg-[var(--tx-surface-2)]"><div className="h-full rounded-full bg-[var(--tx-accent)]" style={{width:`${Math.min(100,x.value/max*100)}%`}}/></div></div>})}</div></section>
    <section className="tx-surface rounded-2xl p-5"><h2 className="text-lg font-black">Usuários por módulo</h2><p className="mb-5 mt-1 text-xs text-[var(--tx-muted)]">Contas ou instalações únicas com atividade no período. Cliques repetidos não aumentam este total.</p>{data.modules.length?<div className="space-y-3">{data.modules.map(x=><div key={x.name}><div className="mb-1 flex justify-between text-xs"><span>{x.label||x.name}</span><b title={`${number(x.actions)} ações registradas`}>{number(x.value)} usuários · {number(x.actions)} ações</b></div><div className="h-2 overflow-hidden rounded-full bg-[var(--tx-surface-2)]"><div className="h-full rounded-full bg-sky-500" style={{width:`${x.value/maxModule*100}%`}}/></div></div>)}</div>:<p className="text-sm text-[var(--tx-muted)]">Ainda não há eventos de módulos.</p>}</section>
   </div>
   <section className="tx-surface rounded-2xl p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-black">Instalações identificadas</h2><p className="mt-1 text-xs text-[var(--tx-muted)]">Histórico de contas Google verificadas na extensão; o plano é associado pelo ID da conta ou pelo e-mail verificado. Este total não usa o filtro de período.</p></div><span className="rounded-full bg-[var(--tx-surface-2)] px-3 py-1 text-xs font-bold">{number(data.extensionUsers?.length||0)} identificadas</span></div>
    {data.extensionUsers?.length ? <div className="max-h-[440px] overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-[var(--tx-surface)] text-[var(--tx-muted)]"><tr><th className="py-2">Usuário</th><th>E-mail Google</th><th>Plano</th><th>Versão</th><th>Última atividade</th></tr></thead><tbody>{data.extensionUsers.map((u)=><tr key={u.install_id} className="border-t border-[var(--tx-border)]"><td className="py-2"><div className="flex items-center gap-2">{u.picture?<img src={u.picture} alt="" className="h-7 w-7 rounded-full"/>:<span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--tx-surface-2)] font-bold">{(u.name||u.email||"?").slice(0,1).toUpperCase()}</span>}<span className="font-semibold">{u.name||"Sem nome"}</span></div></td><td className="break-all">{u.email}</td><td><span className={`rounded-full px-2 py-1 ${u.plan && u.plan !== "não vinculado" ? "bg-amber-300 font-bold text-amber-950" : "bg-[var(--tx-surface-2)]"}`}>{u.plan}</span></td><td>{u.extension_version||"—"}</td><td>{u.last_seen?new Date(u.last_seen).toLocaleString("pt-BR"):"—"}</td></tr>)}</tbody></table></div>:<p className="text-sm text-[var(--tx-muted)]">Nenhuma conta Google verificada foi registrada ainda. O usuário precisa entrar na extensão e gerar uma sincronização de Analytics.</p>}
   </section>
   <div className="grid gap-4 xl:grid-cols-2">
    <section className="tx-surface rounded-2xl p-5"><h2 className="text-lg font-black">Eventos recentes</h2><div className="mt-4 max-h-[420px] overflow-auto"><table className="w-full text-left text-xs"><thead><tr className="text-[var(--tx-muted)]"><th className="py-2">Evento</th><th>Módulo</th><th>Data</th></tr></thead><tbody>{data.recent.slice(0,60).map((e,i)=><tr key={i} className="border-t border-[var(--tx-border)]"><td className="py-2 font-semibold">{e.event_name}</td><td>{e.module_label||e.module||"—"}</td><td>{new Date(e.created_at).toLocaleString("pt-BR")}</td></tr>)}</tbody></table></div></section>
    <section className="tx-surface rounded-2xl p-5"><h2 className="text-lg font-black">Eventos por tipo</h2><div className="mt-4 max-h-[420px] overflow-auto"><table className="w-full text-left text-xs"><thead><tr className="text-[var(--tx-muted)]"><th className="py-2">Evento</th><th className="text-right">Quantidade</th></tr></thead><tbody>{data.events.map(x=><tr key={x.name} className="border-t border-[var(--tx-border)]"><td className="py-2">{x.name}</td><td className="text-right font-bold">{number(x.value)}</td></tr>)}</tbody></table></div></section>
   </div>
  </>}
 </div>;
}
