"use client";

import { useEffect,useState } from "react";
import { Home,Users,Settings,CreditCard,LifeBuoy,LogOut,ChevronDown,ExternalLink,ShieldCheck,Check,Menu,X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "./theme-toggle";
import AffiliatePage from "./affiliate-page";
import AdminAffiliates from "./admin-affiliates";

type Lang="pt-br"|"pt-pt"|"es"|"en";
const languages=[
 ["pt-br","🇧🇷","Português (Brasil)"],["pt-pt","🇵🇹","Português (Portugal)"],["es","🇪🇸","Español"],["en","🇺🇸","English"]
] as const;

const i18n={
 "pt-br":{dashboard:"Visão geral",affiliate:"Afiliados",account:"Conta",billing:"Assinatura",support:"Suporte",welcome:"Seu espaço TubeX",overview:"A extensão continua sendo seu centro de trabalho no YouTube.",connected:"Canal conectado",notConnected:"Nenhum canal conectado",plan:"Plano atual",status:"Status",active:"Ativo",free:"Free",openExtension:"Abrir extensão",manage:"Gerenciar conta",logout:"Sair",affiliateTitle:"Programa de Afiliados",affiliateText:"Compartilhe o TubeX e acompanhe suas vendas e comissões.",supportText:"Precisa de ajuda? Fale com o suporte.",contact:"Falar com suporte",subscription:"Sua assinatura",upgrade:"Ver planos",security:"Sessão protegida",language:"Idioma",admin:"Admin / Afiliados"},
 "pt-pt":{dashboard:"Visão geral",affiliate:"Afiliados",account:"Conta",billing:"Subscrição",support:"Suporte",welcome:"O seu espaço TubeX",overview:"A extensão continua a ser o seu centro de trabalho no YouTube.",connected:"Canal ligado",notConnected:"Nenhum canal ligado",plan:"Plano atual",status:"Estado",active:"Ativo",free:"Free",openExtension:"Abrir extensão",manage:"Gerir conta",logout:"Sair",affiliateTitle:"Programa de Afiliados",affiliateText:"Partilhe o TubeX e acompanhe vendas e comissões.",supportText:"Precisa de ajuda? Fale com o suporte.",contact:"Falar com suporte",subscription:"A sua subscrição",upgrade:"Ver planos",security:"Sessão protegida",language:"Idioma",admin:"Admin / Afiliados"},
 "es":{dashboard:"Resumen",affiliate:"Afiliados",account:"Cuenta",billing:"Suscripción",support:"Soporte",welcome:"Tu espacio TubeX",overview:"La extensión sigue siendo tu centro de trabajo en YouTube.",connected:"Canal conectado",notConnected:"Ningún canal conectado",plan:"Plan actual",status:"Estado",active:"Activo",free:"Free",openExtension:"Abrir extensión",manage:"Gestionar cuenta",logout:"Cerrar sesión",affiliateTitle:"Programa de Afiliados",affiliateText:"Comparte TubeX y controla ventas y comisiones.",supportText:"¿Necesitas ayuda? Habla con soporte.",contact:"Hablar con soporte",subscription:"Tu suscripción",upgrade:"Ver planes",security:"Sesión protegida",language:"Idioma",admin:"Admin / Afiliados"},
 "en":{dashboard:"Overview",affiliate:"Affiliates",account:"Account",billing:"Subscription",support:"Support",welcome:"Your TubeX workspace",overview:"The extension remains your main workspace inside YouTube.",connected:"Channel connected",notConnected:"No channel connected",plan:"Current plan",status:"Status",active:"Active",free:"Free",openExtension:"Open extension",manage:"Manage account",logout:"Sign out",affiliateTitle:"Affiliate Program",affiliateText:"Share TubeX and track sales and commissions.",supportText:"Need help? Contact support.",contact:"Contact support",subscription:"Your subscription",upgrade:"View plans",security:"Protected session",language:"Language",admin:"Admin / Affiliates"}
} as const;

function Logo(){return <a href="/dashboard" className="flex items-center gap-2 font-black tracking-[-.06em] text-[22px] text-[var(--tx-text)]"><span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--tx-accent)] text-[10px] text-[#11151a]">TX</span>Tube<span className="text-[var(--tx-accent)]">X</span></a>}

export default function DashboardLayout({user}:{user:any}){
 const [tab,setTab]=useState<"dashboard"|"affiliate"|"admin"|"account"|"billing"|"support">("dashboard");
 const [mobileOpen,setMobileOpen]=useState(false);
 const [lang,setLang]=useState<Lang>("pt-br"),[openLang,setOpenLang]=useState(false),[userData,setUserData]=useState<any>(null);
 const t=i18n[lang];
 const ownerEmail = (process.env.NEXT_PUBLIC_OWNER_EMAIL || "").trim().toLowerCase();
 const userEmail = String(user?.email || "").trim().toLowerCase();
 const role = String(userData?.role || userData?.user_role || user?.user_metadata?.role || "").toLowerCase();
 const planRaw = String(userData?.plan || user?.user_metadata?.plan || "").toLowerCase();
 const isOwner = role==="owner" || role==="admin" || role==="administrator" || planRaw==="owner" || planRaw==="admin" ||
   (!!ownerEmail && userEmail===ownerEmail) || String(userData?.name || "").trim().toLowerCase()==="gabriel zago";

 useEffect(()=>{const saved=localStorage.getItem("tubex-language") as Lang|null;const b=navigator.language.toLowerCase();const l=saved||(b.startsWith("pt-br")?"pt-br":b.startsWith("pt")?"pt-pt":b.startsWith("es")?"es":"en");setLang(l);document.documentElement.lang=l;
  (async()=>{if(!user?.email)return;const {data}=await supabase.from("users").select("*").eq("email",user.email).maybeSingle();setUserData(data)})();
 },[user?.email]);
 function changeLang(l:Lang){
  setLang(l);setOpenLang(false);localStorage.setItem("tubex-language",l);
  document.documentElement.lang=l;
  window.dispatchEvent(new CustomEvent("tubex-language-change",{detail:l}));
}
 async function logout(){await supabase.auth.signOut();window.location.href="/"}
 const plan=String(userData?.plan||"free").toLowerCase();
 const displayName=userData?.name||user?.user_metadata?.full_name||user?.email?.split("@")[0]||"Creator";
 const navItems:any[]=[
  ["dashboard",Home,t.dashboard],["affiliate",Users,t.affiliate],
  ...(isOwner?[["admin",ShieldCheck,t.admin]]:[]),
  ["account",Settings,t.account],["billing",CreditCard,t.billing],["support",LifeBuoy,t.support]
 ];
 function selectTab(next:any){setTab(next);setMobileOpen(false)}
 return <div className="min-h-screen bg-[var(--tx-bg)] text-[var(--tx-text)]">
  <aside className="fixed inset-y-0 left-0 hidden w-[232px] border-r border-[var(--tx-border)] bg-[var(--tx-surface)] p-4 lg:flex lg:flex-col">
   <Logo/>
   <div className="mt-8 rounded-2xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-4"><p className="text-[9px] font-black uppercase tracking-[.15em] text-[var(--tx-accent)]">TubeX</p><p className="mt-2 text-xs font-bold">YouTube growth workspace</p><p className="mt-1 text-[10px] leading-5 text-[var(--tx-muted)]">{t.overview}</p></div>
   <nav className="mt-7 grid gap-1">
    {navItems.map(([id,Icon,label]:any)=><button key={id} onClick={()=>selectTab(id)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[11px] font-extrabold transition ${tab===id?"bg-[var(--tx-accent-soft)] text-[var(--tx-text)]":"text-[var(--tx-muted)] hover:bg-[var(--tx-surface-2)]"}`}><Icon size={16}/><span>{label}</span>{id==="admin"&&<span className="ml-auto rounded-md bg-[var(--tx-accent)] px-1.5 py-0.5 text-[8px] font-black text-[#11151a]">OWNER</span>}</button>)}
   </nav>
   <div className="mt-auto">
    <div className="mb-3 flex items-center gap-2 rounded-xl border border-[var(--tx-border)] p-2"><div className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-[var(--tx-accent)] text-xs font-black text-[#11151a]">{displayName.slice(0,1).toUpperCase()}</div><div className="min-w-0"><div className="flex items-center gap-1"><p className="truncate text-[11px] font-bold">{displayName}</p>{isOwner&&<span className="rounded bg-[var(--tx-accent)] px-1 py-0.5 text-[7px] font-black text-[#11151a]">OWNER</span>}</div><p className="truncate text-[9px] text-[var(--tx-muted)]">{user?.email}</p></div></div>
    <button onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-[var(--tx-muted)] hover:bg-[var(--tx-surface-2)]"><LogOut size={15}/>{t.logout}</button>
   </div>
  </aside>
  <main className="min-h-screen lg:pl-[232px]">
   <header className="sticky top-0 z-40 border-b border-[var(--tx-border)] bg-[var(--tx-bg)]/90 backdrop-blur-xl">
    <div className="mx-auto flex h-[66px] w-[min(1180px,calc(100%-28px))] items-center gap-2">
     <div className="flex items-center gap-2 lg:hidden"><button onClick={()=>setMobileOpen(v=>!v)} aria-label="Menu" className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] text-[var(--tx-muted)]">{mobileOpen?<X size={15}/>:<Menu size={15}/>}</button><Logo/></div><div className="hidden lg:block"><p className="text-[11px] font-black">{tab==="dashboard"?t.dashboard:tab==="affiliate"?t.affiliate:tab==="admin"?t.admin:tab==="account"?t.account:tab==="billing"?t.billing:t.support}</p></div>
     <div className="ml-auto flex items-center gap-2">
      <ThemeToggle/>
      <div className="relative"><button onClick={()=>setOpenLang(!openLang)} className="tx-mini-btn">{languages.find(x=>x[0]===lang)?.[1]}<ChevronDown size={11}/></button>{openLang&&<div className="tx-menu">{languages.map(x=><button key={x[0]} onClick={()=>changeLang(x[0])}>{x[1]} {x[2]}</button>)}</div>}</div>
      <button onClick={logout} title={t.logout} className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] text-[var(--tx-muted)] hover:text-[var(--tx-text)]"><LogOut size={14}/></button>
     </div>
    </div>
   </header>
  {mobileOpen&&<div className="lg:hidden border-b border-[var(--tx-border)] bg-[var(--tx-surface)] px-3 py-3"><nav className="grid gap-1">{navItems.map(([id,Icon,label]:any)=><button key={id} onClick={()=>selectTab(id)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[11px] font-extrabold ${tab===id?"bg-[var(--tx-accent-soft)] text-[var(--tx-text)]":"text-[var(--tx-muted)]"}`}><Icon size={15}/><span>{label}</span>{id==="admin"&&<span className="ml-auto rounded-md bg-[var(--tx-accent)] px-1.5 py-0.5 text-[8px] font-black text-[#11151a]">OWNER</span>}</button>)}</nav></div>}
   <div className="mx-auto w-[min(1180px,calc(100%-28px))] py-8">
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
 return <div className="space-y-5">
  <section className="tx-surface relative overflow-hidden rounded-[22px] p-7 md:p-9"><div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[var(--tx-accent)] opacity-[.07] blur-3xl"/><div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between"><div><p className="tx-kicker">TUBEX WORKSPACE</p><h1 className="mt-2 text-3xl font-black tracking-[-.05em] md:text-4xl">{t.welcome}, {name.split(" ")[0]}.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--tx-muted)]">{t.overview}</p></div><a target="_blank" href="https://chromewebstore.google.com/detail/tubex-seo-analyzer-for-yo/lgddmmhnmkmkfhaodogcoecdecegemgk" className="tx-btn tx-btn-primary"><ExternalLink size={14}/>{t.openExtension}</a></div></section>
  <div className="grid gap-4 md:grid-cols-3"><Stat title={t.plan} value={plan} icon={<ShieldCheck size={17}/>}/><Stat title={t.status} value={userData?.status==="inactive"?"Inactive":t.active} icon={<Check size={17}/>}/><Stat title={t.connected} value={userData?.youtube_channel_name||t.notConnected} icon={<Users size={17}/>}/></div>
  <div className="grid gap-4 lg:grid-cols-2">
   <section className="tx-surface rounded-[20px] p-6"><div className="flex items-start justify-between"><div><p className="tx-kicker">{t.affiliate}</p><h2 className="mt-2 text-xl font-black">{t.affiliateTitle}</h2><p className="mt-2 text-sm leading-6 text-[var(--tx-muted)]">{t.affiliateText}</p></div><Users className="text-[var(--tx-accent)]" size={22}/></div><button onClick={()=>onTab("affiliate")} className="tx-btn tx-btn-secondary mt-5">{t.affiliate}</button></section>
   <section className="tx-surface rounded-[20px] p-6"><p className="tx-kicker">{t.billing}</p><h2 className="mt-2 text-xl font-black">{t.subscription}</h2><p className="mt-2 text-sm leading-6 text-[var(--tx-muted)]">TubeX {plan} · {userData?.status||"active"}</p><button onClick={()=>onTab("billing")} className="tx-btn tx-btn-primary mt-5">{t.upgrade}</button></section>
  </div>
 </div>
}
function Stat({title,value,icon}:any){return <div className="tx-surface rounded-[18px] p-5"><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[.13em] text-[var(--tx-muted)]">{title}</span><span className="text-[var(--tx-accent)]">{icon}</span></div><p className="mt-4 truncate text-xl font-black">{value}</p></div>}
function Account({user,userData,t,isOwner}:any){return <section className="tx-surface max-w-3xl rounded-[22px] p-7"><p className="tx-kicker">{t.account}</p><h1 className="mt-2 text-3xl font-black">{userData?.name||user?.user_metadata?.full_name||"Creator"}</h1><div className="mt-7 grid gap-4 sm:grid-cols-2"><Field label="E-mail" value={user?.email||"—"}/><Field label={t.plan} value={String(isOwner ? "OWNER" : (userData?.plan||"free")).toUpperCase()}/><Field label="Status" value={userData?.status||"active"}/><Field label="YouTube" value={userData?.youtube_channel_name||t.notConnected}/></div><p className="mt-6 text-xs text-[var(--tx-muted)]">{t.security}</p></section>}
function Field({label,value}:any){return <div className="rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface-2)] p-4"><p className="text-[10px] font-bold text-[var(--tx-muted)]">{label}</p><p className="mt-2 truncate text-sm font-bold">{value}</p></div>}
function Billing({userData,t}:any){return <section className="tx-surface max-w-4xl rounded-[22px] p-7"><p className="tx-kicker">{t.billing}</p><h1 className="mt-2 text-3xl font-black">{t.subscription}</h1><p className="mt-2 text-sm text-[var(--tx-muted)]">Plano atual: {String(userData?.plan==="owner" ? "OWNER" : (userData?.plan||"free")).toUpperCase()}</p><div className="mt-7 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-[var(--tx-border)] p-5"><p className="text-xs font-bold">Pro</p><p className="mt-2 text-2xl font-black">R$29,99<span className="text-xs text-[var(--tx-muted)]">/mês</span></p><a target="_blank" rel="noreferrer" href="https://buy.stripe.com/3cI7sK7058OtdzDaUegjC01" className="tx-btn tx-btn-secondary mt-5 w-full">{t.upgrade}</a><p className="mt-4 text-xl font-black">R$299,90<span className="text-xs text-[var(--tx-muted)]">/ano</span></p><a target="_blank" rel="noreferrer" href="https://buy.stripe.com/28E3cudote8NgLPd2mgjC03" className="tx-btn tx-btn-secondary mt-3 w-full">Pro anual</a></div><div className="rounded-2xl border border-[var(--tx-accent)] p-5"><p className="tx-kicker">EXPERT · MAIS POPULAR</p><p className="mt-2 text-2xl font-black">R$49,99<span className="text-xs text-[var(--tx-muted)]">/mês</span></p><a target="_blank" rel="noreferrer" href="https://buy.stripe.com/dRmaEW98dggV3Z3d2mgjC02" className="tx-btn tx-btn-primary mt-5 w-full">{t.upgrade}</a><p className="mt-4 text-xl font-black">R$499,90<span className="text-xs text-[var(--tx-muted)]">/ano</span></p><a target="_blank" rel="noreferrer" href="https://buy.stripe.com/28E8wO3NTe8N67b2nIgjC04" className="tx-btn tx-btn-primary mt-3 w-full">Expert anual</a></div></div></section>}
function Support({t}:any){return <section className="tx-surface max-w-3xl rounded-[22px] p-7"><p className="tx-kicker">{t.support}</p><h1 className="mt-2 text-3xl font-black">{t.supportText}</h1><p className="mt-3 text-sm leading-6 text-[var(--tx-muted)]">gabrielbzago@gmail.com</p><a className="tx-btn tx-btn-primary mt-6" href="mailto:gabrielbzago@gmail.com">{t.contact}</a></section>}
