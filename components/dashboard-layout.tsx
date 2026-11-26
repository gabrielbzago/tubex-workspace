"use client";

import { useEffect,useState } from "react";
import { Sparkles,Gauge,Home,Users,Settings,CreditCard,LifeBuoy,LogOut,ChevronDown,ExternalLink,ShieldCheck,Check,Menu,X,Search,Lightbulb,Download,Puzzle,ArrowRight,MonitorSmartphone,Activity,Trophy,Rss,ChevronRight,ChevronUp,TrendingUp,Eye,Video } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "./theme-toggle";
import AffiliatePage from "./affiliate-page";
import AdminAffiliates from "./admin-affiliates";
import AdminAnalytics from "./admin-analytics";
import AdminSubscriberBehavior from "./admin-subscriber-behavior";
import CancellationAdmin, { CancellationForm } from "./cancellation-center";
import SeoWorkspace from "./seo-workspace";
import CreatorWorkspace from "./creator-workspace";
import AchievementsCenter from "./achievements-center";
import FeedDashboard from "./feed-dashboard";
import IntelligenceCenter from "./intelligence-center";
import TubeXAIChat from "./tubex-ai-chat";
import ChannelHome from "./channel-home";
import OptimizeView from "./optimize-view";
import ResearchView from "./research-view";
import AdminHub from "./admin-hub";
import WelcomeSplash from "./welcome-splash";
import { translateUiText, type TubeXLang } from "@/lib/ui-i18n";
import { recordWebProductEvent } from "@/lib/tubex-client-analytics";

type Lang="pt-br"|"pt-pt"|"es"|"en";
type Tab="home"|"ai"|"research"|"optimize"|"achievements"|"affiliate"|"account"|"support"|"admin";
const languages=[
 ["pt-br","🇧🇷","Português (Brasil)"],["pt-pt","🇵🇹","Português (Portugal)"],["es","🇪🇸","Español"],["en","🇺🇸","English"]
] as const;

const i18n={
 "pt-br":{dashboard:"Visão geral",affiliate:"Afiliados",account:"Conta",billing:"Assinatura",support:"Suporte",welcome:"Seu espaço TubeX",overview:"Pesquise palavras-chave, compare concorrentes e analise oportunidades para seus próximos vídeos.",connected:"Canal conectado",notConnected:"Nenhum canal conectado",plan:"Plano atual",status:"Status",active:"Ativo",free:"Free",openExtension:"Abrir extensão",manage:"Gerenciar conta",logout:"Sair",affiliateTitle:"Programa de Afiliados",affiliateText:"Compartilhe o TubeX e acompanhe suas vendas e comissões.",supportText:"Precisa de ajuda? Fale com o suporte.",contact:"Falar com suporte",subscription:"Sua assinatura",upgrade:"Ver planos",security:"Sessão protegida",language:"Idioma",admin:"Admin / Afiliados",extBadge:"Ferramenta principal do TubeX",extHeadline:"A extensão TubeX é onde tudo acontece.",extBody:"Para analisar vídeos enquanto navega pelo YouTube, encontrar tags, avaliar SEO e trabalhar diretamente no YouTube Studio, utilize a extensão. Este painel web é complementar e reúne análises, planejamento e gestão da sua conta.",installExt:"Instalar extensão TubeX",storeLabel:"Disponível na Chrome Web Store",step1:"1. Instale no Chrome",step1Text:"Adicione o TubeX pelo link oficial.",step2:"2. Fixe a extensão",step2Text:"Use o ícone de extensões do navegador.",step3:"3. Abra o YouTube",step3Text:"Acesse as ferramentas TubeX nas páginas compatíveis.",complementText:"Este painel funciona como complemento; a extensão é a experiência central para uso diário no YouTube.",webPanel:"Explorar painel web"},
 "pt-pt":{dashboard:"Visão geral",affiliate:"Afiliados",account:"Conta",billing:"Subscrição",support:"Suporte",welcome:"O seu espaço TubeX",overview:"Pesquise palavras-chave, compare concorrentes e analise oportunidades para os seus próximos vídeos.",connected:"Canal ligado",notConnected:"Nenhum canal ligado",plan:"Plano atual",status:"Estado",active:"Ativo",free:"Free",openExtension:"Abrir extensão",manage:"Gerir conta",logout:"Sair",affiliateTitle:"Programa de Afiliados",affiliateText:"Partilhe o TubeX e acompanhe vendas e comissões.",supportText:"Precisa de ajuda? Fale com o suporte.",contact:"Falar com suporte",subscription:"A sua subscrição",upgrade:"Ver planos",security:"Sessão protegida",language:"Idioma",admin:"Admin / Afiliados",extBadge:"Ferramenta principal do TubeX",extHeadline:"A extensão TubeX é onde tudo acontece.",extBody:"Para analisar vídeos enquanto navega no YouTube, encontrar tags, avaliar SEO e trabalhar diretamente no YouTube Studio, utilize a extensão. Este painel web é complementar e reúne análises, planeamento e gestão da sua conta.",installExt:"Instalar extensão TubeX",storeLabel:"Disponível na Chrome Web Store",step1:"1. Instale no Chrome",step1Text:"Adicione o TubeX através do link oficial.",step2:"2. Fixe a extensão",step2Text:"Utilize o ícone de extensões do navegador.",step3:"3. Abra o YouTube",step3Text:"Aceda às ferramentas TubeX nas páginas compatíveis.",complementText:"Este painel funciona como complemento; a extensão é a experiência central para utilização diária no YouTube.",webPanel:"Explorar painel web"},
 "es":{dashboard:"Resumen",affiliate:"Afiliados",account:"Cuenta",billing:"Suscripción",support:"Soporte",welcome:"Tu espacio TubeX",overview:"Investiga palabras clave, compara competidores y analiza oportunidades para tus próximos vídeos.",connected:"Canal conectado",notConnected:"Ningún canal conectado",plan:"Plan actual",status:"Estado",active:"Activo",free:"Free",openExtension:"Abrir extensión",manage:"Gestionar cuenta",logout:"Cerrar sesión",affiliateTitle:"Programa de Afiliados",affiliateText:"Comparte TubeX y controla ventas y comisiones.",supportText:"¿Necesitas ayuda? Habla con soporte.",contact:"Hablar con soporte",subscription:"Tu suscripción",upgrade:"Ver planes",security:"Sesión protegida",language:"Idioma",admin:"Admin / Afiliados",extBadge:"Herramienta principal de TubeX",extHeadline:"La extensión TubeX es donde sucede todo.",extBody:"Para analizar vídeos mientras navegas por YouTube, encontrar etiquetas, evaluar SEO y trabajar directamente en YouTube Studio, utiliza la extensión. Este panel web es complementario y reúne análisis, planificación y gestión de tu cuenta.",installExt:"Instalar extensión TubeX",storeLabel:"Disponible en Chrome Web Store",step1:"1. Instala en Chrome",step1Text:"Añade TubeX desde el enlace oficial.",step2:"2. Fija la extensión",step2Text:"Usa el icono de extensiones del navegador.",step3:"3. Abre YouTube",step3Text:"Accede a las herramientas TubeX en las páginas compatibles.",complementText:"Este panel funciona como complemento; la extensión es la experiencia central para el uso diario en YouTube.",webPanel:"Explorar panel web"},
 "en":{dashboard:"Overview",affiliate:"Affiliates",account:"Account",billing:"Subscription",support:"Support",welcome:"Your TubeX workspace",overview:"Research keywords, compare competing videos and uncover opportunities for your next uploads.",connected:"Channel connected",notConnected:"No channel connected",plan:"Current plan",status:"Status",active:"Active",free:"Free",openExtension:"Open extension",manage:"Manage account",logout:"Sign out",affiliateTitle:"Affiliate Program",affiliateText:"Share TubeX and track sales and commissions.",supportText:"Need help? Contact support.",contact:"Contact support",subscription:"Your subscription",upgrade:"View plans",security:"Protected session",language:"Language",admin:"Admin / Affiliates",extBadge:"TubeX primary tool",extHeadline:"The TubeX extension is where everything happens.",extBody:"Use the extension to analyze videos while browsing YouTube, find tags, evaluate SEO, and work directly in YouTube Studio. This web dashboard is complementary, bringing together analytics, planning, and account management.",installExt:"Install TubeX extension",storeLabel:"Available on the Chrome Web Store",step1:"1. Install in Chrome",step1Text:"Add TubeX using the official link.",step2:"2. Pin the extension",step2Text:"Use your browser’s extensions menu.",step3:"3. Open YouTube",step3Text:"Access TubeX tools on supported pages.",complementText:"This dashboard is a companion; the extension is the central everyday YouTube experience.",webPanel:"Explore web dashboard"}
} as const;

function Logo(){return <a href="/dashboard" className="flex items-center gap-2" aria-label="TubeX"><img src="/logo.png" alt="TubeX" className="h-8 w-auto max-w-[142px] object-contain object-left"/></a>}

export default function DashboardLayout({user}:{user:any}){
 const [tab,setTab]=useState<Tab>("home");
 const [researchSub,setResearchSub]=useState<"keywords"|"ideas">("keywords");
 const [adminSub,setAdminSub]=useState<"analytics"|"subscribers"|"usage"|"cancellations"|"affiliates">("analytics");
 const [mobileOpen,setMobileOpen]=useState(false);
 const [toolsOpen,setToolsOpen]=useState(false);
 const [navQuery,setNavQuery]=useState("");
 const [channelContext,setChannelContext]=useState<any>(null);
 const [achievementSummary,setAchievementSummary]=useState<any>(null);
 const [ownerVerified,setOwnerVerified]=useState(false);
 const [lang,setLang]=useState<Lang>("pt-br"),[openLang,setOpenLang]=useState(false),[userData,setUserData]=useState<any>(null);
 const t=i18n[lang];
 const ownerEmails = [process.env.NEXT_PUBLIC_OWNER_EMAIL || "", ...(process.env.NEXT_PUBLIC_OWNER_EMAILS || "").split(","), "gabrielbzago@gmail.com"].map(v => v.trim().toLowerCase()).filter(Boolean);
 const ownerIds = (process.env.NEXT_PUBLIC_OWNER_USER_IDS || "").split(",").map(v => v.trim()).filter(Boolean);
 const userEmail = String(user?.email || "").trim().toLowerCase();
 // A autorização vem da identidade Supabase da conta TubeX, nunca do canal YouTube ativo.
 // O servidor também valida a role/allowlist antes de liberar qualquer endpoint administrativo.
 const isOwner = ownerVerified || ownerEmails.includes(userEmail) || ownerIds.includes(String(user?.id || "")) || ["owner","admin","administrator"].includes(String(userData?.role || userData?.user_role || userData?.account_role || userData?.plan || "").toLowerCase()) || userData?.is_owner === true || userData?.is_admin === true;

 useEffect(()=>{
  setOwnerVerified(false);
  setUserData(null);
  const readContext=()=>{try{const raw=localStorage.getItem("tubex-ai-channel-context");setChannelContext(raw?JSON.parse(raw):null)}catch{setChannelContext(null)}};
  readContext();window.addEventListener("tubex-channel-context",readContext);window.addEventListener("storage",readContext);
  let alive=true;
  (async()=>{try{const {data:sessionData}=await supabase.auth.getSession();const token=sessionData.session?.access_token;if(!token)return;
    const ownerRes=await fetch("/api/account/owner-status",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
    if(ownerRes.ok){const ownerPayload=await ownerRes.json();if(alive)setOwnerVerified(ownerPayload?.isOwner===true);}
    const res=await fetch("/api/achievements",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});if(!res.ok)return;const payload=await res.json();if(alive)setAchievementSummary(payload)}catch{} })();
  return()=>{alive=false;window.removeEventListener("tubex-channel-context",readContext);window.removeEventListener("storage",readContext)};
 },[user?.id,user?.email]);
 useEffect(()=>{const saved=localStorage.getItem("tubex-language") as Lang|null;const b=navigator.language.toLowerCase();const l=saved||(b.startsWith("pt-br")?"pt-br":b.startsWith("pt")?"pt-pt":b.startsWith("es")?"es":"en");setLang(l);document.documentElement.lang=l;window.dispatchEvent(new CustomEvent("tubex-language-change",{detail:l}));
  (async()=>{
   if(!user?.email)return;
   const {data}=await supabase.from("users").select("*").ilike("email",String(user.email).trim().toLowerCase().replace(/[\\%_]/g,(c:string)=>"\\"+c)).limit(1).maybeSingle();
   setUserData(data);
   // O plano exibido vem do servidor, com a mesma busca da extensão: todos os
   // e-mails da conta são consultados e o melhor plano vence (status validado).
   try{
    const {data:sessionData}=await supabase.auth.getSession();
    const token=sessionData.session?.access_token;
    if(!token)return;
    const res=await fetch("/api/account/plan",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
    if(!res.ok)return;
    const resolved=await res.json();
    if(resolved?.plan)setUserData((prev:any)=>({...(prev||{}),plan:resolved.plan,status:resolved.status||(resolved.plan==="free"?(prev?.status||"active"):"active"),planEmail:resolved.planEmail||null}));
   }catch{}
  })();
 },[user?.email]);
 useEffect(()=>{
  const trackStripeLink=(event:MouseEvent)=>{
   const target=event.target;
   if(!(target instanceof Element))return;
   const link=target.closest<HTMLAnchorElement>('a[href*="buy.stripe.com"],a[href*="/api/checkout"]');
   if(!link)return;
   // Pré-preenche o e-mail do login no checkout do Stripe para a assinatura cair
   // no mesmo e-mail da conta (evita assinatura em outro e-mail aparecer como FREE).
   try{const loginEmail=String(user?.email||"").trim().toLowerCase();if(loginEmail){const url=new URL(link.href);const key=url.pathname.includes("/api/checkout")?"email":"prefilled_email";if(!url.searchParams.get(key)){url.searchParams.set(key,loginEmail);link.href=url.toString()}}}catch{}
   const plan=String(link.textContent||"assinatura").trim().replace(/\s+/g," ").slice(0,40);
   void supabase.auth.getSession().then(({data})=>recordWebProductEvent(data.session,"upgrade_clicked","billing",{plan,source:"stripe_checkout_link"}));
  };
  document.addEventListener("click",trackStripeLink,true);
  return()=>document.removeEventListener("click",trackStripeLink,true);
 },[user?.email]);
 // Apply the selected language to all UI text nodes, including the independently
 // rendered Keyword Explorer and Workspace SEO, and keep newly rendered UI in sync.
 useEffect(()=>{
  const originals = new WeakMap<Text,string>();
  const written = new WeakMap<Text,string>();
  const originalAttributes = new WeakMap<Element,Record<string,string>>();
  const detectedLang = document.documentElement.lang.toLowerCase();
  let activeLang = ((["pt-br","pt-pt","es","en"].includes(detectedLang) ? detectedLang : localStorage.getItem("tubex-language")) as TubeXLang|null) || lang;
  const translateNode = (node: Node) => {
   if(node.nodeType===Node.TEXT_NODE){
    const text=node as Text;
    const parent=text.parentElement;
    if(!parent || parent.closest("script,style,textarea,input,[contenteditable='true']")) return;
    // Se o React trocou o texto (ex.: título da aba), o novo valor vira o original.
    if(!originals.has(text) || (written.has(text) && text.nodeValue!==written.get(text))) originals.set(text,text.nodeValue || "");
    const original=originals.get(text) || "";
    const translated=translateUiText(original,activeLang);
    written.set(text,translated);
    if(text.nodeValue!==translated) text.nodeValue=translated;
    return;
   }
   // childNodes também contém comentários e outros tipos de Node.
   // getAttribute/setAttribute existem somente em Element.
   if(node.nodeType!==Node.ELEMENT_NODE) return;
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
  try{sessionStorage.removeItem(`tubex-dashboard-open-recorded:${String(user?.id||"")}`)}catch{}
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
 // Navegação enxuta: 4 áreas principais + itens secundários discretos.
 const mainItems:[Tab,any,string,string][]=[
  ["home",Home,"Início","Seu canal em números"],
  ["ai",Sparkles,"TubeX AI","Chat com seu copiloto"],
  ["research",Search,"Pesquisar","Palavras-chave e ideias"],
  ["optimize",Gauge,"Otimizar","Seus vídeos e melhorias"],
 ];
 const secondaryItems:[Tab,any,string][]=[
  ["achievements",Trophy,"Conquistas"],["affiliate",Users,t.affiliate],["account",Settings,"Conta e assinatura"],["support",LifeBuoy,t.support],
  ...(isOwner?[["admin",ShieldCheck,"Admin"] as [Tab,any,string]]:[]),
 ];
 const titles:Record<Tab,string>={home:"Início",ai:"TubeX AI",research:"Pesquisar",optimize:"Otimizar",achievements:"Conquistas",affiliate:t.affiliate,account:"Conta e assinatura",support:t.support,admin:"Admin"};
 useEffect(()=>{
  const handleNavigate=(event:Event)=>{const next=(event as CustomEvent<string>).detail;if(next)selectTab(next)};
  window.addEventListener("tubex-navigate-tab",handleNavigate);
  return()=>window.removeEventListener("tubex-navigate-tab",handleNavigate);
 },[]);
 // Aceita nomes antigos (feed, workspace, creator…) para links e eventos existentes.
 function selectTab(raw:string){
  const [base,sub]=String(raw).split(":");
  const legacy:Record<string,Tab>={dashboard:"home",feed:"home",intelligence:"optimize",workspace:"research",creator:"research",billing:"account",analytics:"admin",behavior:"admin",usage:"admin",cancellations:"admin"};
  const next=(legacy[base]||base) as Tab;
  if(base==="creator"||sub==="ideas")setResearchSub("ideas");else if(base==="workspace"||sub==="keywords")setResearchSub("keywords");
  const adminMap:Record<string,any>={analytics:"analytics",behavior:"subscribers",usage:"usage",cancellations:"cancellations",admin:"affiliates"};
  if(next==="admin"&&base!=="admin")setAdminSub(adminMap[base]||"analytics");
  setTab(next);setMobileOpen(false);
  try{document.querySelector(".tx-dashboard-content")?.scrollTo({top:0,behavior:"smooth"})}catch{}
  const moduleByTab:Record<string,string>={home:"dashboard",ai:"ai",research:"seo_explorer",optimize:"intelligence_center",achievements:"achievements",affiliate:"affiliate",account:"account",support:"support"};
  const module=moduleByTab[next];if(module)void supabase.auth.getSession().then(({data})=>recordWebProductEvent(data.session,"module_opened",module));
 }
 const navButton=(id:Tab,Icon:any,label:string,hint?:string,small=false)=><button key={id} onClick={()=>selectTab(id)} aria-current={tab===id?"page":undefined} className={`tx-nav-item ${small?"is-small":""} ${tab===id?"is-active":""}`}><span className="tx-nav-icon"><Icon size={small?15:17}/></span><span className="min-w-0 flex-1 text-left"><span className="block truncate">{label}</span>{hint&&<small className="tx-nav-hint">{hint}</small>}</span>{id==="admin"&&<span className="tx-owner-pill">OWNER</span>}</button>;
 const planLabel=String(isOwner?"OWNER":(userData?.plan||"free")).toUpperCase();
 return <div className={`tx-saas-shell ${tab === "ai" ? "tx-shell-ai" : "tx-shell-page"} bg-[var(--tx-bg)] text-[var(--tx-text)]`}>
  <WelcomeSplash name={displayName} userId={String(user?.id||"")}/>
  <aside className="tx-sidebar fixed inset-y-0 left-0 z-50 hidden w-[248px] border-r border-[var(--tx-border)] p-4 lg:flex lg:flex-col">
   <div className="tx-sidebar-brand flex items-center justify-between gap-3"><Logo/></div>
   <nav className="tx-sidebar-nav" aria-label="Navegação principal">
    <section className="tx-nav-group">{mainItems.map(([id,Icon,label,hint])=>navButton(id,Icon,label,hint))}</section>
    <section className="tx-nav-group tx-nav-secondary"><p className="tx-nav-heading">Mais</p>{secondaryItems.map(([id,Icon,label])=>navButton(id,Icon,label,undefined,true))}</section>
   </nav>
   <div className="tx-sidebar-bottom mt-auto space-y-2">
    {!["expert","owner"].includes(plan)&&<button onClick={()=>selectTab("account")} className="tx-upgrade-card"><Sparkles size={15}/><span><b>Seja Expert</b><small>Análises ilimitadas e IA avançada</small></span></button>}
    <a href="https://chromewebstore.google.com/detail/tubex-seo-analyzer-for-yo/lgddmmhnmkmkfhaodogcoecdecegemgk" target="_blank" rel="noreferrer" className="tx-extension-link"><span className="tx-extension-icon"><Puzzle size={15}/></span><span className="min-w-0 flex-1"><b>Extensão TubeX</b><small>Use dentro do YouTube</small></span><ExternalLink size={13}/></a>
    <div className="tx-sidebar-user"><div className="tx-sidebar-avatar">{displayName.slice(0,1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-bold">{displayName}</p><p className="truncate text-[11px] text-[var(--tx-muted)]">Plano {planLabel}</p></div><button onClick={logout} title={t.logout} aria-label={t.logout} className="tx-logout-pill"><LogOut size={14}/><span>Sair</span></button></div>
   </div>
  </aside>
  <main className="tx-app-main min-w-0 w-full lg:pl-[248px]">
   <header className="tx-topbar sticky top-0 z-40 border-b border-[var(--tx-border)] bg-[var(--tx-bg)]/90 backdrop-blur-xl">
    <div className="mx-auto flex h-[60px] w-full min-w-0 items-center gap-2 px-4 sm:h-[66px] sm:px-6 lg:px-8">
     <div className="flex items-center gap-2 lg:hidden"><button onClick={()=>setMobileOpen(v=>!v)} aria-label="Menu" aria-expanded={mobileOpen} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] text-[var(--tx-muted)]">{mobileOpen?<X size={17}/>:<Menu size={17}/>}</button><Logo/></div>
     <p className="hidden text-[15px] font-bold lg:block">{titles[tab]}</p>
     <div className="ml-auto flex items-center gap-2">
      <ThemeToggle/>
      <div className="relative"><button onClick={()=>setOpenLang(!openLang)} className="tx-mini-btn">{languages.find(x=>x[0]===lang)?.[1]}<ChevronDown size={11}/></button>{openLang&&<div className="tx-menu">{languages.map(x=><button key={x[0]} onClick={()=>changeLang(x[0])}>{x[1]} {x[2]}</button>)}</div>}</div>
     </div>
    </div>
   </header>
   {mobileOpen&&<><button className="tx-mobile-scrim lg:hidden" aria-label="Fechar menu" onClick={()=>setMobileOpen(false)}/><div className="tx-mobile-menu lg:hidden"><nav className="grid gap-1">{mainItems.map(([id,Icon,label,hint])=>navButton(id,Icon,label,hint))}<p className="tx-nav-heading mt-3">Mais</p><div className="grid grid-cols-2 gap-1">{secondaryItems.map(([id,Icon,label])=>navButton(id,Icon,label,undefined,true))}</div><button onClick={logout} className="tx-logout-link tx-logout-strong mt-3"><LogOut size={17}/>Sair da conta</button></nav></div></>}
   <div key={tab} className={`tx-dashboard-content tx-page-enter mx-auto w-full min-w-0 px-3 sm:px-5 lg:px-7 ${tab === "ai" ? "is-ai" : "is-page"}`}>
    {tab==="home"&&<ChannelHome achievementSummary={achievementSummary} displayName={displayName}/>}
    {tab==="ai"&&<div className="tx-ai-home"><TubeXAIChat/></div>}
    {tab==="research"&&<ResearchView user={user} plan={isOwner?"expert":plan} initial={researchSub}/>}
    {tab==="optimize"&&<OptimizeView user={user} plan={isOwner?"expert":plan}/>}
    {tab==="achievements"&&<AchievementsCenter user={user}/>}
    {tab==="affiliate"&&<AffiliatePage userData={userData}/>}
    {tab==="admin"&&(isOwner?<AdminHub initial={adminSub}/>:<section className="tx-surface rounded-[22px] p-7"><p className="tx-kicker">ACESSO RESTRITO</p><h1 className="mt-2 text-3xl font-black">Área exclusiva do Owner</h1></section>)}
    {tab==="account"&&<div className="space-y-5"><Account user={user} userData={userData} t={t} isOwner={isOwner}/><Billing user={user} userData={userData} t={t}/></div>}
    {tab==="support"&&<Support t={t}/>}
   </div>
  </main>
  <nav className="tx-bottom-nav lg:hidden" aria-label="Navegação rápida">{mainItems.map(([id,Icon,label])=><button key={id} onClick={()=>selectTab(id)} className={tab===id?"is-active":""} aria-current={tab===id?"page":undefined}><Icon size={19}/><span>{label}</span></button>)}</nav>
 </div>
}

function MetricCompact({label,value,icon}:any){const formatted=value===undefined||value===null?"—":new Intl.NumberFormat("pt-BR",{notation:"compact",maximumFractionDigits:1}).format(Number(value)||0);return <div className="min-w-0 rounded-lg bg-[var(--tx-surface-2)]/75 px-2 py-1.5"><div className="flex items-center gap-1 text-[var(--tx-muted)]">{icon}<span className="truncate text-[9px]">{label}</span></div><p className="mt-0.5 truncate text-[13px] font-black tabular-nums sm:text-sm">{formatted}</p></div>}
function MiniViewsChart({history=[]}:any){const rows=[...history].filter((item:any)=>Number.isFinite(Number(item.total_views))).slice(0,14).reverse();if(rows.length<2)return <div className="flex h-full items-end justify-center border-b border-l border-[var(--tx-border)] pb-1 text-center text-[8px] text-[var(--tx-muted)]">Histórico em formação</div>;const values=rows.map((item:any)=>Number(item.total_views));const min=Math.min(...values),max=Math.max(...values),range=Math.max(1,max-min);const coords=values.map((v:number,i:number)=>`${(i/(values.length-1))*108},${37-((v-min)/range)*29}`).join(" ");const lastY=37-((values[values.length-1]-min)/range)*29;return <svg viewBox="0 0 108 42" className="h-full w-full overflow-visible" role="img" aria-label="Evolução histórica de visualizações"><defs><linearGradient id="tx-mini-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--tx-accent)" stopOpacity=".28"/><stop offset="100%" stopColor="var(--tx-accent)" stopOpacity="0"/></linearGradient></defs>{[9,23,37].map(y=><path key={y} d={`M0 ${y}H108`} stroke="var(--tx-border)" strokeDasharray="2 4" strokeWidth=".7"/>)}<polygon points={`0,40 ${coords} 108,40`} fill="url(#tx-mini-area)"/><polyline points={coords} fill="none" stroke="var(--tx-accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="108" cy={lastY} r="3.2" fill="var(--tx-accent)" stroke="var(--tx-surface)" strokeWidth="1.5"/></svg>}

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
   <Stat title={t.status} value={["inactive","canceled","incomplete_expired","unpaid"].includes(String(userData?.status||""))?"Inactive":t.active} icon={<Check size={17}/>}/>
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
function Billing({user,userData,t}:any){return <div className="max-w-4xl"><section className="tx-surface rounded-[22px] p-7"><p className="tx-kicker">{t.billing}</p><h1 className="mt-2 text-3xl font-black">{t.subscription}</h1><p className="mt-2 text-sm text-[var(--tx-muted)]">Plano atual: {String(userData?.plan==="owner" ? "OWNER" : (userData?.plan||"free")).toUpperCase()}</p><div className="mt-7 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-[var(--tx-border)] p-5"><p className="text-xs font-bold">Start</p><p className="mt-2 text-2xl font-black">R$19,90<span className="text-xs text-[var(--tx-muted)]">/mês</span></p><a target="_blank" rel="noreferrer" href="https://tubex-backend.vercel.app/api/checkout?plan=start" className="tx-btn tx-btn-secondary mt-5 w-full">{t.upgrade}</a><p className="mt-4 text-xl font-black">R$199,00<span className="text-xs text-[var(--tx-muted)]">/ano</span></p><a target="_blank" rel="noreferrer" href="https://tubex-backend.vercel.app/api/checkout?plan=start&cycle=annual" className="tx-btn tx-btn-secondary mt-3 w-full">Start anual</a></div><div className="rounded-2xl border border-[var(--tx-border)] p-5"><p className="text-xs font-bold">Pro</p><p className="mt-2 text-2xl font-black">R$29,90<span className="text-xs text-[var(--tx-muted)]">/mês</span></p><a target="_blank" rel="noreferrer" href="https://tubex-backend.vercel.app/api/checkout?plan=pro" className="tx-btn tx-btn-secondary mt-5 w-full">{t.upgrade}</a><p className="mt-4 text-xl font-black">R$299,00<span className="text-xs text-[var(--tx-muted)]">/ano</span></p><a target="_blank" rel="noreferrer" href="https://tubex-backend.vercel.app/api/checkout?plan=pro&cycle=annual" className="tx-btn tx-btn-secondary mt-3 w-full">Pro anual</a></div><div className="rounded-2xl border border-[var(--tx-accent)] p-5"><p className="tx-kicker">EXPERT · MAIS POPULAR</p><p className="mt-2 text-2xl font-black">R$49,90<span className="text-xs text-[var(--tx-muted)]">/mês</span></p><a target="_blank" rel="noreferrer" href="https://tubex-backend.vercel.app/api/checkout?plan=expert" className="tx-btn tx-btn-primary mt-5 w-full">{t.upgrade}</a><p className="mt-4 text-xl font-black">R$499,00<span className="text-xs text-[var(--tx-muted)]">/ano</span></p><a target="_blank" rel="noreferrer" href="https://tubex-backend.vercel.app/api/checkout?plan=expert&cycle=annual" className="tx-btn tx-btn-primary mt-3 w-full">Expert anual</a></div></div></section><CancellationForm user={user} userData={userData}/></div>}
function Support({t}:any){return <section className="tx-surface max-w-3xl rounded-[22px] p-7"><p className="tx-kicker">{t.support}</p><h1 className="mt-2 text-3xl font-black">{t.supportText}</h1><p className="mt-3 text-sm leading-6 text-[var(--tx-muted)]">gabrielbzago@gmail.com</p><a className="tx-btn tx-btn-primary mt-6" href="mailto:gabrielbzago@gmail.com">{t.contact}</a></section>}
