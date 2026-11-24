 "use client";

import { useState } from "react";
import { Activity, BarChart3, BookOpen, CalendarDays, Clapperboard, Compass, FileText, Image, Lightbulb, Search, Sparkles, Target, Users, Video, Zap, Rss, ArrowRight, Lock } from "lucide-react";
import FeedDashboard from "./feed-dashboard";
import SeoWorkspace from "./seo-workspace";
import CreatorWorkspace from "./creator-workspace";

type Section = "optimize" | "research" | "tools";
type Module = "overview" | "channel" | "keywords" | "videos" | "shorts" | "channels" | "thumbnails" | "ideas" | "scripts" | "calendar" | "clipping" | "learn";

const researchItems: {id:Module;label:string;description:string;icon:any;status:"ready"|"planned"}[] = [
 {id:"keywords",label:"Palavras-chave",description:"Volume, concorrência e oportunidades de SEO.",icon:Search,status:"ready"},
 {id:"videos",label:"Vídeos",description:"Encontre vídeos de referência e padrões de desempenho.",icon:Video,status:"ready"},
 {id:"shorts",label:"Shorts",description:"Analise ideias e formatos de vídeos curtos.",icon:Clapperboard,status:"ready"},
 {id:"channels",label:"Canais",description:"Compare canais e identifique referências.",icon:Users,status:"ready"},
 {id:"thumbnails",label:"Thumbnails",description:"Inspiração visual e análise de capas.",icon:Image,status:"planned"}
];
const toolItems: {id:Module;label:string;description:string;icon:any;status:"ready"|"planned"}[] = [
 {id:"ideas",label:"Ideias diárias",description:"Transforme oportunidades em pautas para novos vídeos.",icon:Lightbulb,status:"ready"},
 {id:"scripts",label:"Roteiros",description:"Organize a criação de roteiros e estruturas.",icon:FileText,status:"ready"},
 {id:"calendar",label:"Calendário editorial",description:"Planeje a sequência de publicações.",icon:CalendarDays,status:"planned"},
 {id:"clipping",label:"Clipping",description:"Recorte e reaproveite trechos de vídeos.",icon:Clapperboard,status:"planned"},
 {id:"learn",label:"Aprender",description:"Guias e materiais para melhorar seu canal.",icon:BookOpen,status:"planned"}
];

export default function IntelligenceCenter({user,plan}:{user:any;plan:string}) {
 const [section,setSection]=useState<Section>("optimize");
 const [module,setModule]=useState<Module>("overview");
 const open=(id:Module)=>{setModule(id); if(["keywords","videos","shorts","channels","thumbnails"].includes(id))setSection("research"); if(["ideas","scripts","calendar","clipping","learn"].includes(id))setSection("tools");};
 const tabs:[Section,string,string][]=[["optimize","Otimizar","Desempenho do seu canal"],["research","Pesquisar","Descubra oportunidades"],["tools","Ferramentas","Planeje e produza"]];
 const title=module==="overview"?"Visão geral":module==="channel"?"Desempenho do canal":researchItems.concat(toolItems).find(x=>x.id===module)?.label||"Inteligência TubeX";
 return <div className="space-y-5">
  <section className="relative overflow-hidden rounded-3xl border border-[var(--tx-border)] bg-[radial-gradient(circle_at_90%_0%,rgba(245,190,55,.16),transparent_38%),var(--tx-surface)] p-5 md:p-7">
   <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
    <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[var(--tx-accent-strong)]">TubeX Intelligence</p><h1 className="mt-2 text-3xl font-black tracking-tight">Central de Inteligência</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--tx-muted)]">Analise seu canal, pesquise oportunidades e organize sua produção em um único espaço.</p></div>
    <div className="flex items-center gap-2 rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] px-3 py-2 text-xs font-bold"><Activity size={15} className="text-[var(--tx-accent-strong)]"/> Plano {String(plan||"free").toUpperCase()}</div>
   </div>
   <div className="mt-6 flex flex-wrap gap-2">{tabs.map(([id,label,sub])=><button key={id} onClick={()=>{setSection(id);setModule(id==="optimize"?"overview":id==="research"?"keywords":"ideas")}} className={`rounded-xl px-4 py-2.5 text-left transition ${section===id?"bg-[var(--tx-accent)] text-[#171717]":"border border-[var(--tx-border)] bg-[var(--tx-surface-2)] text-[var(--tx-muted)]"}`}><span className="block text-xs font-black">{label}</span><span className="block text-[9px] opacity-75">{sub}</span></button>)}</div>
  </section>
  {section==="optimize"&&<div className="space-y-4">
   <div className="grid gap-3 md:grid-cols-3">
    <button onClick={()=>setModule("channel")} className="rounded-2xl border border-[var(--tx-border)] bg-[var(--tx-surface)] p-4 text-left hover:border-[var(--tx-accent)]"><Rss className="mb-3 text-[var(--tx-accent-strong)]"/><b className="block text-sm">Feed inteligente</b><span className="mt-1 block text-xs text-[var(--tx-muted)]">Desempenho, vídeos em destaque, temas e comentários.</span></button>
    <button onClick={()=>setModule("keywords")} className="rounded-2xl border border-[var(--tx-border)] bg-[var(--tx-surface)] p-4 text-left hover:border-[var(--tx-accent)]"><Target className="mb-3 text-[var(--tx-accent-strong)]"/><b className="block text-sm">SEO Explorer</b><span className="mt-1 block text-xs text-[var(--tx-muted)]">Avalie palavras-chave e oportunidades.</span></button>
    <button onClick={()=>setModule("ideas")} className="rounded-2xl border border-[var(--tx-border)] bg-[var(--tx-surface)] p-4 text-left hover:border-[var(--tx-accent)]"><Sparkles className="mb-3 text-[var(--tx-accent-strong)]"/><b className="block text-sm">Ideias e estratégias</b><span className="mt-1 block text-xs text-[var(--tx-muted)]">Use padrões do canal para orientar novos conteúdos.</span></button>
   </div>
   {module==="overview"&&<div className="rounded-2xl border border-[var(--tx-border)] bg-[var(--tx-surface)] p-5"><h2 className="font-black">Otimização do canal</h2><p className="mt-1 text-sm text-[var(--tx-muted)]">Selecione um módulo para abrir a análise correspondente.</p></div>}
   {module==="channel"&&<FeedDashboard/>}
   {module==="keywords"&&<SeoWorkspace user={user} plan={plan}/>}
   {module==="ideas"&&<CreatorWorkspace user={user} plan={plan}/>}
  </div>}
  {section==="research"&&<div className="space-y-4">
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{researchItems.map(item=><button key={item.id} onClick={()=>item.status==="ready"&&open(item.id)} className={`rounded-2xl border p-4 text-left transition ${item.status==="ready"?"border-[var(--tx-border)] bg-[var(--tx-surface)] hover:border-[var(--tx-accent)]":"border-[var(--tx-border)] bg-[var(--tx-surface-2)] opacity-75"}`}><div className="flex items-start justify-between"><item.icon className="text-[var(--tx-accent-strong)]"/>{item.status==="planned"?<Lock size={14} className="text-[var(--tx-muted)]"/>:<ArrowRight size={14}/>}</div><b className="mt-3 block text-sm">{item.label}</b><span className="mt-1 block text-xs leading-5 text-[var(--tx-muted)]">{item.description}</span>{item.status==="planned"&&<span className="mt-3 inline-block text-[9px] font-black uppercase tracking-wider text-[var(--tx-muted)]">Em desenvolvimento</span>}</button>)}</div>
   {module==="keywords"&&<SeoWorkspace user={user} plan={plan}/>}
   {["videos","shorts","channels"].includes(module)&&<CreatorWorkspace user={user} plan={plan}/>}
  </div>}
  {section==="tools"&&<div className="space-y-4">
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{toolItems.map(item=><button key={item.id} onClick={()=>item.status==="ready"&&open(item.id)} className={`rounded-2xl border p-4 text-left transition ${item.status==="ready"?"border-[var(--tx-border)] bg-[var(--tx-surface)] hover:border-[var(--tx-accent)]":"border-[var(--tx-border)] bg-[var(--tx-surface-2)] opacity-75"}`}><div className="flex items-start justify-between"><item.icon className="text-[var(--tx-accent-strong)]"/>{item.status==="planned"?<Lock size={14} className="text-[var(--tx-muted)]"/>:<ArrowRight size={14}/>}</div><b className="mt-3 block text-sm">{item.label}</b><span className="mt-1 block text-xs leading-5 text-[var(--tx-muted)]">{item.description}</span>{item.status==="planned"&&<span className="mt-3 inline-block text-[9px] font-black uppercase tracking-wider text-[var(--tx-muted)]">Em desenvolvimento</span>}</button>)}</div>
   {module==="ideas"&&<CreatorWorkspace user={user} plan={plan}/>}
   {module==="scripts"&&<CreatorWorkspace user={user} plan={plan}/>}
  </div>}
 </div>;
}
