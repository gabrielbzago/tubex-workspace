"use client";
import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import {Activity,Users,Search,ShoppingCart,RefreshCw,AlertTriangle} from "lucide-react";

type Daily={date:string;installs:number;searches:number;logins:number};
type ExtensionUser={install_id:string;email:string;name:string|null;picture:string|null;user_id:string|null;plan:string;account_status:string|null;extension_version:string|null;first_seen:string;last_seen:string};
type UserActivityDay={date:string;users:number};
type UserActivity={date:string;accountKey:string;account:string;email:string|null;installId:string;actions:number;modules:{name:string;label:string;actions:number}[]};
type MonthlyUser={accountKey:string;account:string;email:string|null;actions:number;activeDays:number;modules:{name:string;label:string;actions:number}[]};
type ChatAnalytics={totals:{activeUsers:number;messages:number;opens:number;credits:number};users:{user_id:string;name:string|null;email:string|null;plan:string;opens:number;messages:number;credits:number;last_used:string}[];recent:{user_id:string|null;event_name:string;created_at:string;plan:string;credits:number}[]};
type Payload={days:number;month:string;monthlyLeaderboardAvailable:boolean;monthlyTopUsers:MonthlyUser[];monthlyTopModules:{name:string;label:string;actions:number}[];totals:Record<string,number>;funnel:{name:string;value:number}[];modules:{name:string;label:string;value:number;actions:number}[];events:{name:string;value:number}[];daily:Daily[];userActivityDaily:UserActivityDay[];userActivity:UserActivity[];extensionUsers:ExtensionUser[];recent:{user_id:string|null;install_id:string;event_name:string;module:string|null;module_label:string|null;created_at:string}[]};
const number=(v:number|undefined)=>new Intl.NumberFormat("pt-BR").format(v||0);
function monthKey(date:Date){const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit"}).formatToParts(date);return `${parts.find((part)=>part.type==="year")?.value}-${parts.find((part)=>part.type==="month")?.value}`;}
function monthLabel(month:string){const [year,number]=month.split("-").map(Number);return new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,number-1,15)));}
function monthOptions(){const now=monthKey(new Date()),[year,month]=now.split("-").map(Number);return Array.from({length:12},(_,index)=>{const date=new Date(Date.UTC(year,month-1-index,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}`;});}
const SERIES=[
 {key:"installs",label:"Instalações",color:"#f59e0b"},
 {key:"searches",label:"Eventos de pesquisa/análise",color:"#0ea5e9"},
 {key:"logins",label:"Contas com login",color:"#10b981"},
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
  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--tx-muted)]"><span>Instalações e logins únicos; pesquisas/análises são eventos no dia.</span><span>Passe o mouse ou toque nos pontos para consultar o histórico</span></div>
 </div>;
}
function UserUsageDailyChart({daily,selectedDate,onSelectDate}:{daily:UserActivityDay[];selectedDate:string|null;onSelectDate:(date:string)=>void}){
 const width=960,height=190,left=42,right=20,top=14,bottom=34,plotW=width-left-right,plotH=height-top-bottom;
 const max=Math.max(1,...daily.map((item)=>item.users));
 const tickIndices=Array.from(new Set(Array.from({length:Math.min(6,daily.length)},(_,i)=>Math.round(i*(daily.length-1)/Math.max(1,Math.min(6,daily.length)-1)))));
 const label=(date:string)=>new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
 const slot=plotW/Math.max(1,daily.length),barW=Math.max(2,Math.min(22,slot*.62));
 return daily.length?<div className="overflow-hidden rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] p-2 sm:p-3"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Contas únicas usando o produto por dia" className="block h-auto w-full">
  {[0,1,2,3].map((i)=>{const value=Math.round(max-(max/3)*i),y=top+(plotH/3)*i;return <g key={i}><line x1={left} x2={width-right} y1={y} y2={y} stroke="currentColor" opacity=".10" strokeDasharray="4 5"/><text x={left-9} y={y+4} textAnchor="end" fill="currentColor" opacity=".58" fontSize="11">{value}</text></g>})}
  {daily.map((item,i)=>{const x=left+slot*i+(slot-barW)/2,barHeight=Math.max(item.users?3:0,(item.users/max)*plotH);return <rect key={item.date} x={x} y={top+plotH-barHeight} width={barW} height={barHeight} rx="3" fill={selectedDate===item.date?"#f59e0b":"#0ea5e9"} className={item.users?"cursor-pointer":""} role={item.users?"button":undefined} tabIndex={item.users?0:-1} aria-label={item.users?`${label(item.date)}: ${item.users} contas. Clique para filtrar o histórico`:undefined} pointerEvents={item.users?"auto":"none"} onClick={()=>item.users&&onSelectDate(item.date)} onKeyDown={(event)=>{if(item.users&&(event.key==="Enter"||event.key===" ")){event.preventDefault();onSelectDate(item.date);}}}><title>{label(item.date)}: {item.users} contas ativas</title></rect>})}
  {tickIndices.map((i)=><text key={i} x={left+slot*i+slot/2} y={height-10} textAnchor="middle" fill="currentColor" opacity=".62" fontSize="11">{label(daily[i].date)}</text>)}
 </svg></div>:<p className="rounded-xl bg-[var(--tx-surface-2)] p-4 text-sm text-[var(--tx-muted)]">Ainda não há atividade de módulos identificada neste período.</p>;
}
export default function AdminAnalytics(){
 const [data,setData]=useState<Payload|null>(null),[chatData,setChatData]=useState<ChatAnalytics|null>(null),[days,setDays]=useState(30),[month,setMonth]=useState(()=>monthKey(new Date())),[selectedDate,setSelectedDate]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[userFilter,setUserFilter]=useState("");
 async function load(){
  setLoading(true);setError("");
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session?.access_token) throw new Error("Sessão expirada. Entre novamente.");
   const chatRes=await fetch(`/api/admin/ai-analytics?days=${days}`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
   const chatJson=await chatRes.json();
   if(chatRes.ok) setChatData(chatJson); else setChatData(null);
   const res=await fetch(`/api/admin/analytics?days=${days}&month=${month}`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
   const json=await res.json();
   if(!res.ok) throw new Error(json.error==="forbidden"?"Acesso restrito ao proprietário.":json.error||"Falha ao carregar analytics.");
   setData(json);
  }catch(e:any){setError(e.message||"Não foi possível carregar os dados.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{load();},[days,month]);
 const maxModule=Math.max(1,...(data?.modules||[]).map(x=>x.value));
 const visibleUserActivity=useMemo(()=>{
  const rows=data?.userActivity||[],query=userFilter.trim().toLowerCase();
  return rows.filter((row)=>(!selectedDate||row.date===selectedDate)&&(!query||`${row.account} ${row.email||""} ${row.modules.map((module)=>module.label).join(" ")}`.toLowerCase().includes(query)));
 },[data?.userActivity,userFilter,selectedDate]);
 return <div className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="tx-kicker">OWNER · INTELIGÊNCIA DO PRODUTO</p><h1 className="mt-2 text-3xl font-black">TubeX Analytics</h1><p className="mt-1 text-sm text-[var(--tx-muted)]">Aquisição, ativação, utilização e conversão da extensão.</p></div>
   <div className="flex flex-wrap gap-2"><select value={days} onChange={e=>{setDays(Number(e.target.value));setSelectedDate(null)}} aria-label="Período do histórico diário" className="rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] px-3 py-2 text-sm"><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={60}>60 dias</option><option value={90}>90 dias</option></select><select value={month} onChange={e=>setMonth(e.target.value)} aria-label="Mês do ranking" className="rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] px-3 py-2 text-sm">{monthOptions().map((option)=><option key={option} value={option}>{monthLabel(option)}</option>)}</select><button onClick={load} className="tx-btn tx-btn-secondary"><RefreshCw size={14}/> Atualizar</button></div>
  </div>
  {error&&<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"><AlertTriangle className="mr-2 inline" size={16}/>{error}</div>}
  {chatData&&<>
   <section className="tx-surface rounded-2xl p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="tx-kicker">INTELIGÊNCIA DE PRODUTO</p><h2 className="mt-1 text-xl font-black">Uso do TubeX AI Chat</h2><p className="mt-1 text-xs text-[var(--tx-muted)]">Contas autenticadas que abriram o Chat e enviaram mensagens. Nenhum conteúdo das conversas é armazenado neste relatório.</p></div><span className="rounded-full bg-[var(--tx-surface-2)] px-3 py-1 text-xs font-bold">Últimos {days} dias</span></div>
    {chatData?<>
     <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Usuários identificados",chatData.totals.activeUsers],["Mensagens enviadas",chatData.totals.messages],["Aberturas do Chat",chatData.totals.opens],["Créditos consumidos",chatData.totals.credits]].map(([label,value]:any)=><div key={label} className="rounded-xl border border-[var(--tx-border)] p-4"><div className="text-xs font-semibold text-[var(--tx-muted)]">{label}</div><div className="mt-2 text-2xl font-black">{number(value)}</div></div>)}</div>
     <div className="max-h-[480px] overflow-auto rounded-xl border border-[var(--tx-border)]"><table className="w-full min-w-[760px] text-left text-xs"><thead className="sticky top-0 bg-[var(--tx-surface)] text-[var(--tx-muted)]"><tr><th className="px-3 py-3">Usuário</th><th>Plano</th><th className="text-right">Aberturas</th><th className="text-right">Mensagens</th><th className="text-right">Créditos</th><th className="px-3">Último uso</th></tr></thead><tbody>{chatData.users.map(user=><tr key={user.user_id} className="border-t border-[var(--tx-border)]"><td className="px-3 py-3"><div className="font-semibold">{user.name||"Sem nome"}</div><div className="mt-1 break-all text-[var(--tx-muted)]">{user.email||user.user_id}</div></td><td><span className="rounded-full bg-[var(--tx-surface-2)] px-2 py-1">{user.plan||"free"}</span></td><td className="text-right">{number(user.opens)}</td><td className="text-right font-bold">{number(user.messages)}</td><td className="text-right">{number(user.credits)}</td><td className="px-3 whitespace-nowrap">{user.last_used?new Date(user.last_used).toLocaleString("pt-BR"):"—"}</td></tr>)}</tbody></table></div>
     {!chatData.users.length&&<p className="mt-3 text-sm text-[var(--tx-muted)]">Nenhum uso do Chat registrado neste período. Os eventos começam a aparecer após a publicação desta versão.</p>}
    </>:<p className="rounded-xl bg-[var(--tx-surface-2)] p-4 text-sm text-[var(--tx-muted)]">Não foi possível carregar os dados do Chat.</p>}
   </section>
  </>}
  {loading?<div className="tx-surface rounded-2xl p-8 text-center text-sm">Carregando eventos...</div>:data&&<>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {[["Instalações ativas no período",data.totals.installs,Activity],["Contas com login",data.totals.logins,Users],["Eventos de pesquisa/análise",data.totals.searches,Search],["Assinaturas ativas (total atual)",data.totals.subscriptions,ShoppingCart]].map(([label,value,Icon]:any)=><div key={label} className="tx-surface rounded-2xl p-5"><div className="flex justify-between text-[var(--tx-muted)]"><span className="text-xs font-bold">{label}</span><Icon size={17}/></div><p className="mt-3 text-3xl font-black">{number(value)}</p></div>)}
   </div>
   <section className="tx-surface rounded-2xl p-5">
    <div className="mb-4"><h2 className="text-lg font-black">Atividade diária</h2><p className="mt-1 text-xs text-[var(--tx-muted)]">Evolução diária de instalações, pesquisas/análises e logins no período selecionado.</p></div>
    {data.daily.length?<DailyActivityChart daily={data.daily} days={days}/>:<p className="text-sm text-[var(--tx-muted)]">Ainda não há atividade registrada no período.</p>}
   </section>
   <section className="tx-surface rounded-2xl p-5">
    <div className="mb-4"><h2 className="text-lg font-black">Uso diário por conta e módulo</h2><p className="mt-1 text-xs text-[var(--tx-muted)]">Contas ativas por dia e módulos registrados para cada conta no período selecionado.</p></div>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-[var(--tx-muted)]">{selectedDate?`Histórico de ${new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR")}`:"Clique em uma barra para filtrar por dia."}</span>{selectedDate&&<button type="button" onClick={()=>setSelectedDate(null)} className="font-bold text-[var(--tx-accent)]">Limpar dia</button>}</div>
    <UserUsageDailyChart daily={data.userActivityDaily||[]} selectedDate={selectedDate} onSelectDate={(date)=>setSelectedDate((current)=>current===date?null:date)}/>
    <div className="mb-3 mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[var(--tx-muted)]">Cada linha representa uma conta em um dia. Instalações sem e-mail verificado aparecem pelo identificador local.</p><input value={userFilter} onChange={(event)=>setUserFilter(event.target.value)} placeholder="Filtrar por conta ou módulo" aria-label="Filtrar histórico por conta ou módulo" className="w-full max-w-xs rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] px-3 py-2 text-xs"/></div>
    {visibleUserActivity.length?<div className="max-h-[520px] overflow-auto rounded-xl border border-[var(--tx-border)]"><table className="w-full min-w-[1100px] table-fixed text-left text-xs"><colgroup><col className="w-32"/><col className="w-72"/><col/><col className="w-20"/></colgroup><thead className="sticky top-0 bg-[var(--tx-surface)] text-[var(--tx-muted)]"><tr><th className="px-3 py-3">Dia</th><th className="px-3 py-3">Conta</th><th className="px-3 py-3">Módulos usados</th><th className="px-3 py-3 text-right">Eventos de uso</th></tr></thead><tbody>{visibleUserActivity.map((row)=><tr key={`${row.date}:${row.accountKey}`} className="border-t border-[var(--tx-border)] align-top"><td className="whitespace-nowrap px-3 py-3 font-medium">{new Date(`${row.date}T12:00:00`).toLocaleDateString("pt-BR")}</td><td className="px-3 py-3"><div className="break-all font-semibold">{row.account}</div>{row.email&&row.account!==row.email&&<div className="mt-1 break-all text-[var(--tx-muted)]">{row.email}</div>}</td><td className="px-3 py-2.5"><div className="flex flex-wrap gap-2">{row.modules.map((module)=><span key={module.name} className="rounded-full bg-[var(--tx-surface-2)] px-2.5 py-1.5 leading-4">{module.label} · {number(module.actions)} eventos</span>)}</div></td><td className="px-3 py-3 text-right font-bold">{number(row.actions)}</td></tr>)}</tbody></table></div>:<p className="rounded-xl bg-[var(--tx-surface-2)] p-4 text-sm text-[var(--tx-muted)]">{userFilter?"Nenhum uso corresponde a esse filtro.":selectedDate?"Nenhum uso registrado neste dia.":"Ainda não há uso de módulos identificado neste período."}</p>}
   </section>
   <section className="tx-surface rounded-2xl p-5">
    <div className="mb-4"><h2 className="text-lg font-black">Ranking mensal · {monthLabel(month)}</h2><p className="mt-1 text-xs text-[var(--tx-muted)]">Ranking por eventos de uso de módulos no mês selecionado. Uma interação pode gerar mais de um evento.</p></div>
    {!data.monthlyLeaderboardAvailable?<p className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-700">Não foi possível carregar os dados do ranking mensal.</p>:<div className="grid gap-4 xl:grid-cols-2">
     <div className="rounded-xl border border-[var(--tx-border)] p-4"><h3 className="mb-3 text-sm font-bold">Usuários mais ativos por eventos de uso</h3>{data.monthlyTopUsers.length?<div className="space-y-3">{data.monthlyTopUsers.map((user,index)=><div key={user.accountKey} className="flex items-start gap-3 border-b border-[var(--tx-border)] pb-3 last:border-0 last:pb-0"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--tx-surface-2)] text-xs font-black">{index+1}</span><div className="min-w-0 flex-1"><div className="break-all text-sm font-semibold">{user.account}</div>{user.email&&user.account!==user.email&&<div className="break-all text-xs text-[var(--tx-muted)]">{user.email}</div>}<div className="mt-1 flex flex-wrap gap-1.5">{user.modules.slice(0,5).map((module)=><span key={module.name} className="rounded-full bg-[var(--tx-surface-2)] px-2 py-1 text-[11px]">{module.label} · {number(module.actions)} eventos</span>)}</div></div><div className="shrink-0 text-right"><b className="text-sm">{number(user.actions)}</b><div className="text-[10px] text-[var(--tx-muted)]">eventos · {number(user.activeDays)} dias</div></div></div>)}</div>:<p className="text-sm text-[var(--tx-muted)]">Sem atividade de módulos identificada neste mês.</p>}</div>
     <div className="rounded-xl border border-[var(--tx-border)] p-4"><h3 className="mb-3 text-sm font-bold">Módulos mais usados</h3>{data.monthlyTopModules.length?<div className="space-y-3">{data.monthlyTopModules.map((module,index)=><div key={module.name}><div className="mb-1 flex justify-between gap-3 text-xs"><span>{index+1}. {module.label}</span><b>{number(module.actions)} eventos</b></div><div className="h-2 overflow-hidden rounded-full bg-[var(--tx-surface-2)]"><div className="h-full rounded-full bg-sky-500" style={{width:`${module.actions/Math.max(1,data.monthlyTopModules[0].actions)*100}%`}}/></div></div>)}</div>:<p className="text-sm text-[var(--tx-muted)]">Sem atividade de módulos identificada neste mês.</p>}</div>
    </div>}
   </section>
   <div className="grid gap-4 xl:grid-cols-2">
    <section className="tx-surface rounded-2xl p-5"><h2 className="text-lg font-black">Atividade e conversão</h2><p className="mb-5 mt-1 text-xs text-[var(--tx-muted)]">Contas ou instalações únicas em cada etapa no período. As etapas são independentes; assinaturas ativas aparecem no cartão acima e representam o total atual.</p><div className="space-y-4">{data.funnel.map((x)=>{const max=Math.max(1,...data.funnel.map((step)=>step.value));return <div key={x.name}><div className="mb-1 flex justify-between text-xs"><span>{x.name}</span><b>{number(x.value)}</b></div><div className="h-2 overflow-hidden rounded-full bg-[var(--tx-surface-2)]"><div className="h-full rounded-full bg-[var(--tx-accent)]" style={{width:`${Math.min(100,x.value/max*100)}%`}}/></div></div>})}</div></section>
    <section className="tx-surface rounded-2xl p-5"><h2 className="text-lg font-black">Usuários por módulo</h2><p className="mb-5 mt-1 text-xs text-[var(--tx-muted)]">Usuários únicos por módulo. Ações são eventos instrumentados de abertura, clique e uso; uma interação pode gerar mais de um evento. Verificações automáticas, webhooks de cobrança e respostas genéricas de API ficam fora.</p>{data.modules.length?<div className="space-y-3">{data.modules.map(x=><div key={x.name}><div className="mb-1 flex justify-between text-xs"><span>{x.label||x.name}</span><b title={`${number(x.actions)} eventos de uso registrados`}>{number(x.value)} usuários · {number(x.actions)} eventos</b></div><div className="h-2 overflow-hidden rounded-full bg-[var(--tx-surface-2)]"><div className="h-full rounded-full bg-sky-500" style={{width:`${x.value/maxModule*100}%`}}/></div></div>)}</div>:<p className="text-sm text-[var(--tx-muted)]">Ainda não há eventos de módulos.</p>}</section>
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
