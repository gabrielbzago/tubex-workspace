"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Activity, AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, Bell,
  CheckCircle2, Clock3, Eye, MessageCircle, PlayCircle, RefreshCw,
  ThumbsUp, TrendingDown, TrendingUp, Video, Zap
} from "lucide-react";

type Channel = { id:string; title:string; description:string; thumbnail:string; subscribers:number; views:number; videoCount:number; uploads:string };
type VideoRow = { id:string; title:string; thumbnail:string; publishedAt:string; views:number; likes:number; comments:number; duration?:string };
type CommentRow = { id:string; videoId:string; videoTitle:string; author:string; text:string; publishedAt:string; likes:number; replies:number };

const API="https://www.googleapis.com/youtube/v3";
const number=(v:number)=>new Intl.NumberFormat("pt-BR",{notation:v>99999?"compact":"standard",maximumFractionDigits:1}).format(v||0);
const date=(v:string)=>new Date(v).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
const short=(s:string,n=100)=>s.length>n?s.slice(0,n-1)+"…":s;

async function yt(path:string,token:string){
 const r=await fetch(`${API}/${path}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(d?.error?.message||`YouTube API: ${r.status}`);
 return d;
}
function Metric({label,value,sub,icon:Icon,tone="gold"}:any){
 return <div className="rounded-2xl border border-[var(--tx-border)] bg-[var(--tx-surface)] p-4 shadow-sm">
  <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[.13em] text-[var(--tx-muted)]">{label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${tone==="green"?"bg-emerald-500/10 text-emerald-500":tone==="red"?"bg-rose-500/10 text-rose-500":"bg-[var(--tx-accent-soft)] text-[var(--tx-accent-strong)]"}`}><Icon size={17}/></span></div>
  <div className="mt-3 text-3xl font-black tracking-tight">{value}</div><div className="mt-1 text-[11px] text-[var(--tx-muted)]">{sub}</div>
 </div>
}
function Panel({title,subtitle,icon:Icon,children,action}:any){
 return <section className="overflow-hidden rounded-2xl border border-[var(--tx-border)] bg-[var(--tx-surface)] shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-[var(--tx-border)] px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--tx-accent-soft)] text-[var(--tx-accent-strong)]"><Icon size={17}/></span><div><h3 className="text-sm font-black">{title}</h3>{subtitle&&<p className="mt-0.5 text-[10px] text-[var(--tx-muted)]">{subtitle}</p>}</div></div>{action}</div><div className="p-5">{children}</div></section>
}
export default function FeedDashboard(){
 const [channel,setChannel]=useState<Channel|null>(null),[videos,setVideos]=useState<VideoRow[]>([]),[comments,setComments]=useState<CommentRow[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[commentWarning,setCommentWarning]=useState(""),[updated,setUpdated]=useState(""),[range,setRange]=useState<"7"|"28"|"90">("28");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const {data}=await supabase.auth.getSession(); const token=String((data.session as any)?.provider_token||"");
   if(!token)throw new Error("O canal não está autorizado para leitura. Reconecte o YouTube pela opção de conectar canal.");
   const mine=await yt("channels?part=snippet,statistics,contentDetails&mine=true",token);
   const c=mine.items?.[0]; if(!c)throw new Error("Nenhum canal do YouTube foi encontrado nesta conta.");
   const ch:Channel={id:c.id,title:c.snippet?.title||"Canal",description:c.snippet?.description||"",thumbnail:c.snippet?.thumbnails?.high?.url||c.snippet?.thumbnails?.default?.url||"",subscribers:Number(c.statistics?.subscriberCount||0),views:Number(c.statistics?.viewCount||0),videoCount:Number(c.statistics?.videoCount||0),uploads:c.contentDetails?.relatedPlaylists?.uploads||""};
   setChannel(ch);
   let playlistItems:any[]=[];let pageToken="";
   for(let page=0;page<2;page++){
    const p=new URLSearchParams({part:"snippet,contentDetails",playlistId:ch.uploads,maxResults:"50"});if(pageToken)p.set("pageToken",pageToken);
    const result=await yt(`playlistItems?${p}`,token);playlistItems.push(...(result.items||[]));pageToken=result.nextPageToken||"";if(!pageToken)break;
   }
   const ids=playlistItems.map(x=>x.contentDetails?.videoId).filter(Boolean);
   const videoRows:VideoRow[]=[];
   for(let i=0;i<ids.length;i+=50){
    const p=new URLSearchParams({part:"snippet,statistics,contentDetails",id:ids.slice(i,i+50).join(",")});
    const result=await yt(`videos?${p}`,token);
    for(const v of result.items||[])videoRows.push({id:v.id,title:v.snippet?.title||"Sem título",thumbnail:v.snippet?.thumbnails?.medium?.url||v.snippet?.thumbnails?.default?.url||"",publishedAt:v.snippet?.publishedAt||"",views:Number(v.statistics?.viewCount||0),likes:Number(v.statistics?.likeCount||0),comments:Number(v.statistics?.commentCount||0)});
   }
   videoRows.sort((a,b)=>new Date(b.publishedAt).getTime()-new Date(a.publishedAt).getTime());setVideos(videoRows);
   const recentIds=videoRows.slice(0,12).map(v=>v.id);const pending:CommentRow[]=[];let commentDenied=false;
   for(const id of recentIds){
    try{
     const p=new URLSearchParams({part:"snippet,replies",videoId:id,maxResults:"100",order:"time"});
     const result=await yt(`commentThreads?${p}`,token);
     const v=videoRows.find(x=>x.id===id)!;
     for(const item of result.items||[]){
      const top=item.snippet?.topLevelComment?.snippet; if(!top)continue;
      if(Number(item.snippet?.totalReplyCount||0)===0)pending.push({id:item.id,videoId:id,videoTitle:v.title,author:top.authorDisplayName||"Usuário",text:top.textDisplay||"",publishedAt:top.publishedAt||"",likes:Number(top.likeCount||0),replies:0});
     }
    }catch(e:any){ commentDenied=true; console.warn("TubeX comments",e.message); }
   }
   pending.sort((a,b)=>new Date(b.publishedAt).getTime()-new Date(a.publishedAt).getTime());setComments(pending);setCommentWarning(commentDenied?"O YouTube não liberou a leitura de comentários para esta conexão. Verifique as permissões OAuth do canal; os indicadores podem estar incompletos.":"");setUpdated(new Date().toLocaleString("pt-BR"));
  }catch(e:any){setError(e?.message||"Não foi possível carregar os dados.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load()},[load]);
 const days=Number(range);const cutoff=Date.now()-days*86400000;
 const filtered=useMemo(()=>videos.filter(v=>new Date(v.publishedAt).getTime()>=cutoff),[videos,cutoff]);
 const sorted=useMemo(()=>[...filtered].sort((a,b)=>b.views-a.views),[filtered]);
 const best=sorted[0],worst=sorted.length?sorted[sorted.length-1]:undefined;
 const avg=filtered.length?Math.round(filtered.reduce((s,v)=>s+v.views,0)/filtered.length):0;
 const totalViews=filtered.reduce((s,v)=>s+v.views,0),totalLikes=filtered.reduce((s,v)=>s+v.likes,0);
 const max=Math.max(1,...filtered.map(v=>v.views));
 const chart=filtered.slice().reverse().slice(-14);
 const insight=best&&worst&&best.views>Math.max(1,avg)*1.5
  ?`“${short(best.title,54)}” está acima da média recente. Analise o tema e a promessa da capa para repetir o padrão.`
  :"Ainda não há diferença forte entre os vídeos recentes. Teste novas abordagens de tema e embalagem (título + thumbnail).";
 if(loading)return <div className="grid min-h-[55vh] place-items-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-[var(--tx-accent-strong)]" size={28}/><p className="mt-3 text-sm font-bold">Preparando seu painel de desempenho…</p><p className="mt-1 text-xs text-[var(--tx-muted)]">Buscando canal, vídeos e comentários no YouTube.</p></div></div>;
 if(error)return <div className="mx-auto max-w-3xl rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6"><div className="flex gap-3"><AlertCircle className="text-rose-500"/><div><h2 className="font-black">Não foi possível carregar seu feed</h2><p className="mt-2 text-sm text-[var(--tx-muted)]">{error}</p><button onClick={()=>void load()} className="mt-4 rounded-xl bg-[var(--tx-accent)] px-4 py-2 text-xs font-black text-[#171717]">Tentar novamente</button></div></div></div>;
 return <div className="space-y-5">
  <div className="overflow-hidden rounded-3xl border border-[var(--tx-border)] bg-[radial-gradient(circle_at_85%_10%,rgba(244,197,66,.18),transparent_35%),var(--tx-surface)] p-5 md:p-7">
   <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
    <div className="flex items-center gap-4">{channel?.thumbnail&&<img src={channel.thumbnail} alt="" className="h-16 w-16 rounded-2xl border border-[var(--tx-border)] object-cover"/>}<div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500"/><span className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-500">Canal conectado</span></div><h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">{channel?.title}</h1><p className="mt-1 text-xs text-[var(--tx-muted)]">{number(channel?.subscribers||0)} inscritos · {number(channel?.videoCount||0)} vídeos · atualizado {updated}</p></div></div>
    <div className="flex items-center gap-2"><select value={range} onChange={e=>setRange(e.target.value as any)} className="rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] px-3 py-2 text-xs font-bold"><option value="7">Últimos 7 dias</option><option value="28">Últimos 28 dias</option><option value="90">Últimos 90 dias</option></select><button onClick={()=>void load()} className="flex items-center gap-2 rounded-xl bg-[var(--tx-accent)] px-4 py-2.5 text-xs font-black text-[#171717]"><RefreshCw size={14}/> Atualizar</button></div>
   </div>
  </div>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   <Metric label="Visualizações do canal" value={number(channel?.views||0)} sub="Total acumulado do canal" icon={Eye}/>
   <Metric label="Inscritos" value={number(channel?.subscribers||0)} sub="Inscritos públicos atuais" icon={Activity} tone="green"/>
   <Metric label="Views nos vídeos recentes" value={number(totalViews)} sub={`${filtered.length} vídeos publicados no período`} icon={PlayCircle}/>
   <Metric label="Comentários sem resposta" value={number(comments.length)} sub="Nos 12 vídeos mais recentes" icon={MessageCircle} tone={comments.length?"red":"green"}/>
  </div>
  <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
   <Panel title="Ritmo de visualizações" subtitle={`Desempenho dos vídeos publicados nos últimos ${days} dias`} icon={BarChart3}>
    {chart.length?<div className="flex h-52 items-end gap-2 border-b border-[var(--tx-border)] pb-2">{chart.map(v=><div key={v.id} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"><div title={`${v.title}: ${number(v.views)} views`} className="w-full rounded-t-lg bg-gradient-to-t from-amber-500 to-yellow-300 transition hover:brightness-110" style={{height:`${Math.max(4,v.views/max*100)}%`}}/><span className="mt-2 truncate text-center text-[9px] text-[var(--tx-muted)]">{date(v.publishedAt)}</span></div>)}</div>:<p className="py-12 text-center text-sm text-[var(--tx-muted)]">Sem vídeos publicados neste período.</p>}
    <div className="mt-4 flex flex-wrap gap-4 text-xs"><span className="font-bold">Média por vídeo: {number(avg)} views</span><span className="text-[var(--tx-muted)]">Curtidas: {number(totalLikes)}</span></div>
   </Panel>
   <Panel title="Diagnóstico TubeX" subtitle="Sinais observados nos seus vídeos recentes" icon={Zap}>
    <div className="space-y-3">
     <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"><div className="flex items-center gap-2 text-xs font-black text-emerald-500"><TrendingUp size={15}/> O que está dando certo</div><p className="mt-2 text-xs leading-5">{best?`“${short(best.title,70)}” lidera com ${number(best.views)} visualizações entre os vídeos do período.`:"Ainda faltam vídeos no período para identificar um destaque."}</p></div>
     <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3"><div className="flex items-center gap-2 text-xs font-black text-rose-500"><TrendingDown size={15}/> O que merece atenção</div><p className="mt-2 text-xs leading-5">{worst?`“${short(worst.title,70)}” está na última posição em visualizações entre os vídeos do período (${number(worst.views)}). Compare tema, título e capa.`:"Publique mais vídeos para formar uma base de comparação."}</p></div>
     <p className="rounded-xl bg-[var(--tx-surface-2)] p-3 text-xs leading-5 text-[var(--tx-muted)]">{insight}</p>
    </div>
   </Panel>
  </div>
  <div className="grid gap-5 xl:grid-cols-2">
   <Panel title="Vídeos em destaque" subtitle="Os maiores resultados do período, com capas reais" icon={TrendingUp}>
    {sorted.slice(0,4).length?<div className="space-y-3">{sorted.slice(0,4).map((v,i)=><div key={v.id} className="flex gap-3"><div className="relative w-32 shrink-0 overflow-hidden rounded-xl bg-[var(--tx-surface-2)]"><img src={v.thumbnail} alt="" className="aspect-video h-full w-full object-cover"/><span className="absolute left-1 top-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-black text-white">#{i+1}</span></div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-xs font-extrabold">{v.title}</p><p className="mt-2 flex items-center gap-3 text-[10px] text-[var(--tx-muted)]"><span className="flex items-center gap-1"><Eye size={12}/>{number(v.views)}</span><span className="flex items-center gap-1"><ThumbsUp size={12}/>{number(v.likes)}</span><span>{date(v.publishedAt)}</span></p></div></div>)}</div>:<p className="text-xs text-[var(--tx-muted)]">Sem dados suficientes.</p>}
   </Panel>
   <Panel title="Vídeos que precisam de atenção" subtitle="Menores visualizações entre os publicados no período" icon={TrendingDown}>
    {sorted.slice(-4).reverse().length?<div className="space-y-3">{sorted.slice(-4).reverse().map(v=><div key={v.id} className="flex gap-3"><img src={v.thumbnail} alt="" className="aspect-video w-32 shrink-0 rounded-xl object-cover"/><div className="min-w-0 flex-1"><p className="line-clamp-2 text-xs font-extrabold">{v.title}</p><p className="mt-2 text-[10px] text-[var(--tx-muted)]">{number(v.views)} visualizações · {date(v.publishedAt)}</p></div></div>)}</div>:<p className="text-xs text-[var(--tx-muted)]">Sem dados suficientes.</p>}
   </Panel>
  </div>
  <Panel title="Comentários que aguardam resposta" subtitle="Comentários sem resposta nos 12 vídeos mais recentes. Abra o comentário no YouTube para responder." icon={MessageCircle} action={<span className="rounded-full bg-rose-500/10 px-3 py-1 text-[10px] font-black text-rose-500">{comments.length} pendentes</span>}>
   {commentWarning&&<div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-amber-600">{commentWarning}</div>}
   {comments.length?<div className="space-y-3">{comments.slice(0,12).map(c=><div key={c.id} className="rounded-xl border border-[var(--tx-border)] p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black">{c.author}</p><span className="text-[10px] text-[var(--tx-muted)]">{date(c.publishedAt)}</span></div><p className="mt-2 text-xs leading-5 text-[var(--tx-muted)]">{short(c.text.replace(/<[^>]*>/g,""),220)}</p><p className="mt-2 text-[10px] text-[var(--tx-muted)]">No vídeo: {short(c.videoTitle,80)}</p><a target="_blank" rel="noreferrer" href={`https://studio.youtube.com/video/${c.videoId}/comments`} className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-[var(--tx-accent-strong)]">Responder no YouTube <ArrowUpRight size={12}/></a></div>)}</div>:<div className="py-8 text-center"><CheckCircle2 className="mx-auto text-emerald-500" size={28}/><p className="mt-2 text-sm font-bold">{commentWarning?"Não foi possível confirmar os comentários pendentes":"Nenhum comentário sem resposta encontrado"}</p><p className="mt-1 text-[10px] text-[var(--tx-muted)]">A busca considera os 12 vídeos mais recentes e comentários acessíveis pela API.</p></div>}
  </Panel>
 </div>
}
