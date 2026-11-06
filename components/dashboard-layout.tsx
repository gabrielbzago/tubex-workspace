"use client";

import { useEffect,useState } from "react";
import { Home,Users,Settings,CreditCard,LifeBuoy,LogOut,ChevronDown,ExternalLink,ShieldCheck,Check,Menu,X,Search,Lightbulb,Download,Puzzle,ArrowRight,MonitorSmartphone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "./theme-toggle";
import AffiliatePage from "./affiliate-page";
import AdminAffiliates from "./admin-affiliates";
import SeoWorkspace from "./seo-workspace";
import CreatorWorkspace from "./creator-workspace";
import { translateUiText, type TubeXLang } from "@/lib/ui-i18n";

type Lang="pt-br"|"pt-pt"|"es"|"en";
const languages=[
 ["pt-br","🇧🇷","Português (Brasil)"],["pt-pt","🇵🇹","Português (Portugal)"],["es","🇪🇸","Español"],["en","🇺🇸","English"]
] as const;

const i18n={
 "pt-br":{dashboard:"Visão geral",affiliate:"Afiliados",account:"Conta",billing:"Assinatura",support:"Suporte",welcome:"Seu espaço TubeX",overview:"Pesquise palavras-chave, compare concorrentes e analise oportunidades para seus próximos vídeos.",connected:"Canal conectado",notConnected:"Nenhum canal conectado",plan:"Plano atual",status:"Status",active:"Ativo",free:"Free",openExtension:"Abrir extensão",manage:"Gerenciar conta",logout:"Sair",affiliateTitle:"Programa de Afiliados",affiliateText:"Compartilhe o TubeX e acompanhe suas vendas e comissões.",supportText:"Precisa de ajuda? Fale com o suporte.",contact:"Falar com suporte",subscription:"Sua assinatura",upgrade:"Ver planos",security:"Sessão protegida",language:"Idioma",admin:"Admin / Afiliados",extBadge:"Ferramenta principal do TubeX",extHeadline:"A extensão TubeX é onde tudo acontece.",extBody:"Para analisar vídeos enquanto navega pelo YouTube, encontrar tags, avaliar SEO e trabalhar diretamente no YouTube Studio, utilize a extensão. Este painel web é complementar e reúne análises, planejamento e gestão da sua conta.",installExt:"Instalar extensão TubeX",storeLabel:"Disponível na Chrome Web Store",step1:"1. Instale no Chrome",step1Text:"Adicione o TubeX pelo link oficial.",step2:"2. Fixe a extensão",step2Text:"Use o ícone de extensões do navegador.",step3:"3. Abra o YouTube",step3Text:"Acesse as ferramentas TubeX nas páginas compatíveis.",complementText:"Este painel funciona como complemento; a extensão é a experiência central para uso diário no YouTube.",webPanel:"Explorar painel web"},
 "pt-pt":{dashboard:"Visão geral",affiliate:"Afiliados",account:"Conta",billing:"Subscrição",support:"Suporte",welcome:"O seu espaço TubeX",overview:"Pesquise palavras-chave, compare concorrentes e analise oportunidades para os seus próximos vídeos.",connected:"Canal ligado",notConnected:"Nenhum canal ligado",plan:"Plano atual",status:"Estado",active:"Ativo",free:"Free",openExtension:"Abrir extensão",manage:"Gerir conta",logout:"Sair",affiliateTitle:"Programa de Afiliados",affiliateText:"Partilhe o TubeX e acompanhe vendas e comissões.",supportText:"Precisa de ajuda? Fale com o suporte.",contact:"Falar com suporte",subscription:"A sua subscrição",upgrade:"Ver planos",security:"Sessão protegida",language:"Idioma",admin:"Admin / Afiliados",extBadge:"Ferramenta principal do TubeX",extHeadline:"A extensão TubeX é onde tudo acontece.",extBody:"Para analisar vídeos enquanto navega no YouTube, encontrar tags, avaliar SEO e trabalhar diretamente no YouTube Studio, utilize a extensão. Este painel web é complementar e reúne análises, planeamento e gestão da sua conta.",installExt:"Instalar extensão TubeX",storeLabel:"Disponível na Chrome Web Store",step1:"1. Instale no Chrome",step1Text:"Adicione o TubeX através do link oficial.",step2:"2. Fixe a extensão",step2Text:"Utilize o ícone de extensões do navegador.",step3:"3. Abra o YouTube",step3Text:"Aceda às ferramentas TubeX nas páginas compatíveis.",complementText:"Este painel funciona como complemento; a extensão é a experiência central para utilização diária no YouTube.",webPanel:"Explorar painel web"},
 "es":{dashboard:"Resumen",affiliate:"Afiliados",account:"Cuenta",billing:"Suscripción",support:"Soporte",welcome:"Tu espacio TubeX",overview:"Investiga palabras clave, compara competidores y analiza oportunidades para tus próximos vídeos.",connected:"Canal conectado",notConnected:"Ningún canal conectado",plan:"Plan actual",status:"Estado",active:"Activo",free:"Free",openExtension:"Abrir extensión",manage:"Gestionar cuenta",logout:"Cerrar sesión",affiliateTitle:"Programa de Afiliados",affiliateText:"Comparte TubeX y controla ventas y comisiones.",supportText:"¿Necesitas ayuda? Habla con soporte.",contact:"Hablar con soporte",subscription:"Tu suscripción",upgrade:"Ver planes",security:"Sesión protegida",language:"Idioma",admin:"Admin / Afiliados",extBadge:"Herramienta principal de TubeX",extHeadline:"La extensión TubeX es donde sucede todo.",extBody:"Para analizar vídeos mientras navegas por YouTube, encontrar etiquetas, evaluar SEO y trabajar directamente en YouTube Studio, utiliza la extensión. Este panel web es complementario y reúne análisis, planificación y gestión de tu cuenta.",installExt:"Instalar extensión TubeX",storeLabel:"Disponible en Chrome Web Store",step1:"1. Instala en Chrome",step1Text:"Añade TubeX desde el enlace oficial.",step2:"2. Fija la extensión",step2Text:"Usa el icono de extensiones del navegador.",step3:"3. Abre YouTube",step3Text:"Accede a las herramientas TubeX en las páginas compatibles.",complementText:"Este panel funciona como complemento; la extensión es la experiencia central para el uso diario en YouTube.",webPanel:"Explorar panel web"},
 "en":{dashboard:"Overview",affiliate:"Affiliates",account:"Account",billing:"Subscription",support:"Support",welcome:"Your TubeX workspace",overview:"Research keywords, compare competing videos and uncover opportunities for your next uploads.",connected:"Channel connected",notConnected:"No channel connected",plan:"Current plan",status:"Status",active:"Active",free:"Free",openExtension:"Open extension",manage:"Manage account",logout:"Sign out",affiliateTitle:"Affiliate Program",affiliateText:"Share TubeX and track sales and commissions.",supportText:"Need help? Contact support.",contact:"Contact support",subscription:"Your subscription",upgrade:"View plans",security:"Protected session",language:"Language",admin:"Admin / Affiliates",extBadge:"TubeX primary tool",extHeadline:"The TubeX extension is where everything happens.",extBody:"Use the extension to analyze videos while browsing YouTube, find tags, evaluate SEO, and work directly in YouTube Studio. This web dashboard is complementary, bringing together analytics, planning, and account management.",installExt:"Install TubeX extension",storeLabel:"Available on the Chrome Web Store",step1:"1. Install in Chrome",step1Text:"Add TubeX using the official link.",step2:"2. Pin the extension",step2Text:"Use your browser’s extensions menu.",step3:"3. Open YouTube",step3Text:"Access TubeX tools on supported pages.",complementText:"This dashboard is a companion; the extension is the central everyday YouTube experience.",webPanel:"Explore web dashboard"}
} as const;

function Logo(){return <a href="/dashboard" className="flex items-center gap-2 font-black tracking-[-.06em] text-[22px] text-[var(--tx-text)]"><span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--tx-accent)] text-[10px] text-[#11151a]">TX</span>Tube<span className="text-[var(--tx-accent)]">X</span></a>}

export default function DashboardLayout({user}:{user:any}){
 const [tab,setTab]=useState<"workspace"|"creator"|"dashboard"|"affiliate"|"admin"|"account"|"billing"|"support">("dashboard");
 const [mobileOpen,setMobileOpen]=useState(false);
 const [lang,setLang]=useState<Lang>("pt-br"),[openLang,setOpenLang]=useState(false),[userData,setUserData]=useState<any>(null);
 const t=i18n[lang];
 const ownerEmails = [process.env.NEXT_PUBLIC_OWNER_EMAIL || "", "gabrielbzago@gmail.com"].map(v => v.trim().toLowerCase()).filter(Boolean);
 const userEmail = String(user?.email || "").trim().toLowerCase();
 // A navegação espelha apenas os sinais de autorização persistidos/allowlist.
 // O backend continua sendo a autoridade final em qualquer ação administrativa.
 const role = String(userData?.role || userData?.user_role || "").toLowerCase();
 const planRaw = String(userData?.plan || "").toLowerCase();
 const isOwner = role==="owner" || role==="admin" || role==="administrator" || planRaw==="owner" || planRaw==="admin" || userData?.is_owner === true || ownerEmails.includes(userEmail);

 useEffect(()=>{const saved=localStorage.getItem("tubex-language") as Lang|null;const b=navigator.language.toLowerCase();const l=saved||(b.startsWith("pt-br")?"pt-br":b.startsWith("pt")?"pt-pt":b.startsWith("es")?"es":"en");setLang(l);document.documentElement.lang=l;window.dispatchEvent(new CustomEvent("tubex-language-change",{detail:l}));
  (async()=>{if(!user?.email)return;const {data}=await supabase.from("users").select("*").eq("email",user.email).maybeSingle();setUserData(data)})();
 },[user?.email]);
 // Apply the selected language to all UI text nodes, including the independently
 // rendered Keyword Explorer and Workspace SEO, and keep newly rendered UI in sync.
 useEffect(()=>{
  const originals = new WeakMap<Text,string>();
  const originalAttributes = new WeakMap<Element,Record<string,string>>();
  const detectedLang = document.documentElement.lang.toLowerCase();
  let activeLang = ((["pt-br","pt-pt","es","en"].includes(detectedLang) ? detectedLang : localStorage.getItem("tubex-language")) as TubeXLang|null) || lang;
  const translateNode = (node: Node) => {
   if(node.nodeType===Node.TEXT_NODE){
    const text=node as Text;
    const parent=text.parentElement;
    if(!parent || parent.closest("script,style,textarea,input,[contenteditable='true']")) return;
    if(!originals.has(text)) originals.set(text,text.nodeValue || "");
    const original=originals.get(text) || "";
    const translated=translateUiText(original,activeLang);
    if(text.nodeValue!==translated) text.nodeValue=translated;
    return;
   }
   const element=node as Element;
   let baseAttributes=originalAttributes.get(element);
   if(!baseAttributes){baseAttributes={};for(const attr of ["placeholder","title","aria-label"]){const value=element.getAttribute(attr);if(value)baseAttributes[attr]=value;}originalAttributes.set(element,baseAttributes);}
   for(const attr of ["placeholder","title","aria-label"]){
    const value=baseAttributes[attr];
    if(value){const translated=translateUiText(value,activeLang);if(element.getAttribute(attr)!==translated)element.setAttribute(attr,translated);}
   }
   node.childNodes.forEach(translateNode);
  };
  const apply=(next:TubeXLang)=>{activeLang=next;document.documentElement.lang=next; if(document.body) translateNode(document.body);};
  apply(activeLang);
  const observer=new MutationObserver(records=>records.forEach(record=>{
   record.addedNodes.forEach(translateNode);
   if(record.type==="characterData" && record.target.nodeType===Node.TEXT_NODE) translateNode(record.target);
  }));
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["placeholder","title","aria-label"]});
  const onLanguage=(event:Event)=>apply((event as CustomEvent<TubeXLang>).detail || activeLang);
  window.addEventListener("tubex-language-change",onLanguage);
  return()=>{observer.disconnect();window.removeEventListener("tubex-language-change",onLanguage)};
 },[]);
 function changeLang(l:Lang){
  setLang(l);setOpenLang(false);localStorage.setItem("tubex-language",l);
  document.documentElement.lang=l;
  window.dispatchEvent(new CustomEvent("tubex-language-change",{detail:l}));
}
 async function logout(){
  // Limpa o cache de pesquisa somente quando o usuário encerra a sessão.
  try {
   const ownerKey=String(user?.id||user?.email||"user");
   localStorage.removeItem(`tubex-keyword-active-v1:${ownerKey}`);
   for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i)||"";if(key.startsWith("tubex-keyword-cache-v3:"))localStorage.removeItem(key);}
  } catch {}
  await supabase.auth.signOut();window.location.href="/";
 }
 const plan=String(isOwner ? "expert" : (userData?.plan||"free")).toLowerCase();
 const displayName=userData?.name||user?.user_metadata?.full_name||user?.email?.split("@")[0]||"Creator";
 const navItems:any[]=[
  ["dashboard",Home,t.dashboard],["workspace",Search,"Workspace SEO"],["creator",Lightbulb,"Keyword Explorer"],["affiliate",Users,t.affiliate],
  ...(isOwner?[["admin",ShieldCheck,t.admin]]:[]),
  ["account",Settings,t.account],["billing",CreditCard,t.billing],["support",LifeBuoy,t.support]
 ];
 function selectTab(next:any){setTab(next);setMobileOpen(false)}
 return <div className="min-h-screen bg-[var(--tx-bg)] text-[var(--tx-text)]">
  <aside className="fixed inset-y-0 left-0 hidden w-[232px] border-r border-[var(--tx-border)] bg-[var(--tx-surface)] p-4 lg:flex lg:flex-col">
   <Logo/>
   <div className="mt-8 rounded-2xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-4"><p className="text-[9px] font-black uppercase tracking-[.15em] text-[var(--tx-accent)]">TubeX</p><p className="mt-2 text-xs font-bold">YouTube growth workspace</p><p className="mt-1 text-[10px] leading-5 text-[var(--tx-muted)]">{t.overview}</p></div>
   <a href="https://chromewebstore.google.com/detail/tubex-seo-analyzer-for-yo/lgddmmhnmkmkfhaodogcoecdecegemgk" target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[var(--tx-accent)]/45 bg-[var(--tx-accent-soft)] px-3 py-3 text-[10px] font-black text-[var(--tx-text)]"><span className="flex min-w-0 items-center gap-2"><Puzzle size={15} className="shrink-0 text-[var(--tx-accent-strong)]"/><span>Instalar extensão TubeX</span></span><ExternalLink size={12}/></a>
   <nav className="mt-5 grid gap-1">
    {navItems.map(([id,Icon,label]:any)=><button key={id} onClick={()=>selectTab(id)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[11px] font-extrabold transition ${tab===id?"bg-[var(--tx-accent-soft)] text-[var(--tx-text)]":"text-[var(--tx-muted)] hover:bg-[var(--tx-surface-2)]"}`}><Icon size={16}/><span>{label}</span>{id==="admin"&&<span className="ml-auto rounded-md bg-[var(--tx-accent)] px-1.5 py-0.5 text-[8px] font-black text-[#11151a]">OWNER</span>}</button>)}
   </nav>
   <div className="mt-auto">
    <div className="mb-3 flex items-center gap-2 rounded-xl border border-[var(--tx-border)] p-2"><div className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-[var(--tx-accent)] text-xs font-black text-[#11151a]">{displayName.slice(0,1).toUpperCase()}</div><div className="min-w-0"><div className="flex items-center gap-1"><p className="truncate text-[11px] font-bold">{displayName}</p>{isOwner&&<span className="rounded bg-[var(--tx-accent)] px-1 py-0.5 text-[7px] font-black text-[#11151a]">OWNER</span>}</div><p className="truncate text-[9px] text-[var(--tx-muted)]">{user?.email}</p></div></div>
    <button onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-[var(--tx-muted)] hover:bg-[var(--tx-surface-2)]"><LogOut size={15}/>{t.logout}</button>
   </div>
  </aside>
  <main className="tx-app-main min-h-screen min-w-0 w-full lg:pl-[232px]">
   <header className="sticky top-0 z-40 border-b border-[var(--tx-border)] bg-[var(--tx-bg)]/90 backdrop-blur-xl">
    <div className="mx-auto flex h-[60px] w-full max-w-[1180px] min-w-0 items-center gap-2 px-3 sm:h-[66px] sm:px-4">
     <div className="flex items-center gap-2 lg:hidden"><button onClick={()=>setMobileOpen(v=>!v)} aria-label="Menu" className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] text-[var(--tx-muted)]">{mobileOpen?<X size={15}/>:<Menu size={15}/>}</button><Logo/></div><div className="hidden lg:block"><p className="text-[11px] font-black">{tab==="workspace"?"Workspace SEO":tab==="creator"?"Keyword Explorer":tab==="dashboard"?t.dashboard:tab==="affiliate"?t.affiliate:tab==="admin"?t.admin:tab==="account"?t.account:tab==="billing"?t.billing:t.support}</p></div>
     <div className="ml-auto flex items-center gap-2">
      <ThemeToggle/>
      <div className="relative"><button onClick={()=>setOpenLang(!openLang)} className="tx-mini-btn">{languages.find(x=>x[0]===lang)?.[1]}<ChevronDown size={11}/></button>{openLang&&<div className="tx-menu">{languages.map(x=><button key={x[0]} onClick={()=>changeLang(x[0])}>{x[1]} {x[2]}</button>)}</div>}</div>
      <button onClick={logout} title={t.logout} className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] text-[var(--tx-muted)] hover:text-[var(--tx-text)]"><LogOut size={14}/></button>
     </div>
    </div>
   </header>
  {mobileOpen&&<div className="tx-mobile-menu lg:hidden max-h-[calc(100dvh-60px)] overflow-y-auto border-b border-[var(--tx-border)] bg-[var(--tx-surface)] px-3 py-3"><nav className="grid grid-cols-2 gap-1">{navItems.map(([id,Icon,label]:any)=><button key={id} onClick={()=>selectTab(id)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[11px] font-extrabold ${tab===id?"bg-[var(--tx-accent-soft)] text-[var(--tx-text)]":"text-[var(--tx-muted)]"}`}><Icon size={15}/><span>{label}</span>{id==="admin"&&<span className="ml-auto rounded-md bg-[var(--tx-accent)] px-1.5 py-0.5 text-[8px] font-black text-[#11151a]">OWNER</span>}</button>)}</nav></div>}
   <div className="tx-dashboard-content mx-auto w-full max-w-[1180px] min-w-0 px-3 py-4 pb-24 sm:px-4 sm:py-6 lg:py-8">
    {tab==="workspace"&&<SeoWorkspace user={user} plan={isOwner ? "expert" : plan}/> }
    {tab==="creator"&&<CreatorWorkspace user={user} plan={isOwner ? "expert" : plan}/>}
    {tab==="dashboard"&&<Overview user={user} userData={userData} t={t} onTab={setTab} isOwner={isOwner}/>}
    {tab==="affiliate"&&<AffiliatePage userData={userData}/>} {tab==="admin"&&isOwner&&<AdminAffiliates/>}{tab==="admin"&&!isOwner&&<section className="tx-surface rounded-[22px] p-7"><p className="tx-kicker">ACCESS DENIED</p><h1 className="mt-2 text-3xl font-black">Área exclusiva do Owner</h1><p className="mt-3 text-sm text-[var(--tx-muted)]">Esta área é reservada ao administrador do TubeX.</p></section>}
    {tab==="account"&&<Account user={user} userData={userData} t={t} isOwner={isOwner}/>}
    {tab==="billing"&&<Billing userData={userData} t={t}/>}
    {tab==="support"&&<Support t={t}/>}
   </div>
  </main>
 </div>
}

function Overview({user,userData,t,onTab,isOwner}:any){
 const name=userData?.name||user?.user_metadata?.full_name||user?.email?.split("@")[0]||"Creator";
 const plan=String(isOwner ? "OWNER" : (userData?.plan||"free")).toUpperCase();
 const extensionUrl="https://chromewebstore.google.com/detail/tubex-seo-analyzer-for-yo/lgddmmhnmkmkfhaodogcoecdecegemgk";
 return <div className="min-w-0 space-y-4 sm:space-y-5">
  <section className="relative overflow-hidden rounded-[22px] border border-[var(--tx-accent)]/45 bg-[linear-gradient(115deg,var(--tx-surface),color-mix(in_srgb,var(--tx-accent)_13%,var(--tx-surface)))] p-4 shadow-[var(--tx-shadow)] sm:p-6 md:p-7">
   <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--tx-accent)] opacity-[.12] blur-3xl"/>
   <div className="relative flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
     <div className="inline-flex items-center gap-2 rounded-full border border-[var(--tx-accent)]/40 bg-[var(--tx-accent-soft)] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.12em] text-[var(--tx-accent-strong)]"><Puzzle size={12}/> {t.extBadge}</div>
     <h1 className="mt-3 text-2xl font-black leading-tight tracking-[-.045em] sm:text-3xl md:text-4xl">{t.extHeadline}</h1>
     <p className="mt-2 max-w-2xl text-xs leading-6 text-[var(--tx-muted)] sm:text-sm">{t.extBody}</p>
    </div>
    <div className="relative flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[190px]">
     <a href={extensionUrl} target="_blank" rel="noreferrer" className="tx-btn tx-btn-primary w-full"><Download size={15}/> {t.installExt} <ArrowRight size={14}/></a>
     <span className="text-center text-[9px] leading-4 text-[var(--tx-muted)]">{t.storeLabel}</span>
    </div>
   </div>
   <div className="relative mt-5 grid gap-2 border-t border-[var(--tx-border)]/80 pt-4 sm:grid-cols-3">
    <div className="flex items-start gap-2 rounded-xl bg-[var(--tx-surface)]/65 p-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--tx-accent-soft)] text-[var(--tx-accent-strong)]"><Download size={14}/></span><div><p className="text-[10px] font-black">{t.step1}</p><p className="mt-1 text-[9px] leading-4 text-[var(--tx-muted)]">{t.step1Text}</p></div></div>
    <div className="flex items-start gap-2 rounded-xl bg-[var(--tx-surface)]/65 p-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--tx-accent-soft)] text-[var(--tx-accent-strong)]"><Puzzle size={14}/></span><div><p className="text-[10px] font-black">{t.step2}</p><p className="mt-1 text-[9px] leading-4 text-[var(--tx-muted)]">{t.step2Text}</p></div></div>
    <div className="flex items-start gap-2 rounded-xl bg-[var(--tx-surface)]/65 p-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--tx-accent-soft)] text-[var(--tx-accent-strong)]"><MonitorSmartphone size={14}/></span><div><p className="text-[10px] font-black">{t.step3}</p><p className="mt-1 text-[9px] leading-4 text-[var(--tx-muted)]">{t.step3Text}</p></div></div>
   </div>
   <div className="relative mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-[9px] leading-4 text-[var(--tx-muted)]">{t.complementText}</p>
    <button onClick={()=>onTab("workspace")} className="tx-btn tx-btn-secondary w-full sm:w-auto">{t.webPanel} <ArrowRight size={13}/></button>
   </div>
  </section>
  <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
   <Stat title={t.plan} value={plan} icon={<ShieldCheck size={17}/>}/>
   <Stat title={t.status} value={userData?.status==="inactive"?"Inactive":t.active} icon={<Check size={17}/>}/>
   <Stat title={t.connected} value={userData?.youtube_channel_name||t.notConnected} icon={<Users size={17}/>}/>
  </section>
  <div className="grid min-w-0 gap-3 lg:grid-cols-2 sm:gap-4">
   <section className="tx-surface min-w-0 rounded-[20px] p-4 sm:p-6"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="tx-kicker">{t.affiliate}</p><h2 className="mt-2 text-lg font-black sm:text-xl">{t.affiliateTitle}</h2><p className="mt-2 text-xs leading-6 text-[var(--tx-muted)] sm:text-sm">{t.affiliateText}</p></div><Users className="shrink-0 text-[var(--tx-accent)]" size={22}/></div><button onClick={()=>onTab("affiliate")} className="tx-btn tx-btn-secondary mt-4 w-full sm:mt-5 sm:w-auto">{t.affiliate}</button></section>
   <section className="tx-surface min-w-0 rounded-[20px] p-4 sm:p-6"><p className="tx-kicker">{t.billing}</p><h2 className="mt-2 text-lg font-black sm:text-xl">{t.subscription}</h2><p className="mt-2 text-xs leading-6 text-[var(--tx-muted)] sm:text-sm">TubeX {plan} · {userData?.status||"active"}</p><button onClick={()=>onTab("billing")} className="tx-btn tx-btn-primary mt-4 w-full sm:mt-5 sm:w-auto">{t.upgrade}</button></section>
  </div>
 </div>
}
function Stat({title,value,icon}:any){return <div className="tx-surface rounded-[18px] p-5"><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[.13em] text-[var(--tx-muted)]">{title}</span><span className="text-[var(--tx-accent)]">{icon}</span></div><p className="mt-4 truncate text-xl font-black">{value}</p></div>}
function Account({user,userData,t,isOwner}:any){return <section className="tx-surface max-w-3xl rounded-[22px] p-7"><p className="tx-kicker">{t.account}</p><h1 className="mt-2 text-3xl font-black">{userData?.name||user?.user_metadata?.full_name||"Creator"}</h1><div className="mt-7 grid gap-4 sm:grid-cols-2"><Field label="E-mail" value={user?.email||"—"}/><Field label={t.plan} value={String(isOwner ? "OWNER" : (userData?.plan||"free")).toUpperCase()}/><Field label="Status" value={userData?.status||"active"}/><Field label="YouTube" value={userData?.youtube_channel_name||t.notConnected}/></div><p className="mt-6 text-xs text-[var(--tx-muted)]">{t.security}</p></section>}
function Field({label,value}:any){return <div className="rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-4"><p className="text-[10px] font-bold text-[var(--tx-muted)]">{label}</p><p className="mt-2 truncate text-sm font-bold">{value}</p></div>}
function Billing({userData,t}:any){return <section className="tx-surface max-w-4xl rounded-[22px] p-7"><p className="tx-kicker">{t.billing}</p><h1 className="mt-2 text-3xl font-black">{t.subscription}</h1><p className="mt-2 text-sm text-[var(--tx-muted)]">Plano atual: {String(userData?.plan==="owner" ? "OWNER" : (userData?.plan||"free")).toUpperCase()}</p><div className="mt-7 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-[var(--tx-border)] p-5"><p className="text-xs font-bold">Pro</p><p className="mt-2 text-2xl font-black">R$29,99<span className="text-xs text-[var(--tx-muted)]">/mês</span></p><a target="_blank" rel="noreferrer" href="https://buy.stripe.com/3cI7sK7058OtdzDaUegjC01" className="tx-btn tx-btn-secondary mt-5 w-full">{t.upgrade}</a><p className="mt-4 text-xl font-black">R$299,90<span className="text-xs text-[var(--tx-muted)]">/ano</span></p><a target="_blank" rel="noreferrer" href="https://buy.stripe.com/28E3cudote8NgLPd2mgjC03" className="tx-btn tx-btn-secondary mt-3 w-full">Pro anual</a></div><div className="rounded-2xl border border-[var(--tx-accent)] p-5"><p className="tx-kicker">EXPERT · MAIS POPULAR</p><p className="mt-2 text-2xl font-black">R$49,99<span className="text-xs text-[var(--tx-muted)]">/mês</span></p><a target="_blank" rel="noreferrer" href="https://buy.stripe.com/dRmaEW98dggV3Z3d2mgjC02" className="tx-btn tx-btn-primary mt-5 w-full">{t.upgrade}</a><p className="mt-4 text-xl font-black">R$499,90<span className="text-xs text-[var(--tx-muted)]">/ano</span></p><a target="_blank" rel="noreferrer" href="https://buy.stripe.com/28E8wO3NTe8N67b2nIgjC04" className="tx-btn tx-btn-primary mt-3 w-full">Expert anual</a></div></div></section>}
function Support({t}:any){return <section className="tx-surface max-w-3xl rounded-[22px] p-7"><p className="tx-kicker">{t.support}</p><h1 className="mt-2 text-3xl font-black">{t.supportText}</h1><p className="mt-3 text-sm leading-6 text-[var(--tx-muted)]">gabrielbzago@gmail.com</p><a className="tx-btn tx-btn-primary mt-6" href="mailto:gabrielbzago@gmail.com">{t.contact}</a></section>}
