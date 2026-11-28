"use client";
import { useEffect,useRef,useState } from "react";
import { supabase } from "@/lib/supabase";
import DashboardLayout from "@/components/dashboard-layout";
import LoginPage from "@/components/login-page";
import SessionRelogin from "@/components/session-relogin";
import { rememberGoogleTokens } from "@/lib/tubex-google-token-client";
import { RELOGIN_EVENT, resetReloginRequest, type ReloginReason } from "@/lib/tubex-session";
import { recordInitialDashboardOpen, recordWebLogin } from "@/lib/tubex-client-analytics";

/**
 * Sessão persistente: o Supabase renova o token sozinho e o Google é renovado no servidor.
 * Se a sessão cair sem a pessoa clicar em "Sair" (refresh token inválido), o dashboard (e o chat)
 * continua na tela e aparece só um aviso para entrar de novo, em vez de trocar tudo pelo login.
 */
export default function AuthProvider(){
  const [session,setSession]=useState<any>(null);
  const [lastUser,setLastUser]=useState<any>(null);
  const [relogin,setRelogin]=useState<ReloginReason|null>(null);
  const [loading,setLoading]=useState(true);
  const hadSession=useRef(false);
  useEffect(()=>{
    let mounted=true;
    supabase.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);if(data.session){hadSession.current=true;setLastUser(data.session.user)}setLoading(false);if(data.session){void rememberGoogleTokens(data.session);if(sessionStorage.getItem("tubex-pending-google-login")==="1"){sessionStorage.removeItem("tubex-pending-google-login");void recordWebLogin(data.session)}void recordInitialDashboardOpen(data.session)}}});
    const {data}=supabase.auth.onAuthStateChange((event,next)=>{
      if(!mounted)return;
      if(next){hadSession.current=true;setSession(next);setLastUser(next.user);setRelogin(null);resetReloginRequest();void rememberGoogleTokens(next);return}
      let intentional=false;try{intentional=sessionStorage.getItem("tubex-logging-out")==="1";sessionStorage.removeItem("tubex-logging-out")}catch{}
      setSession(null);
      // Caiu sozinho (refresh token inválido/revogado): mantém a tela e pede novo login.
      if(event==="SIGNED_OUT"&&hadSession.current&&!intentional)setRelogin("session");
      else{hadSession.current=false;setLastUser(null)}
    });
    const onRelogin=(e:Event)=>setRelogin(((e as CustomEvent).detail as ReloginReason)||"session");
    window.addEventListener(RELOGIN_EVENT,onRelogin);
    return()=>{mounted=false;data.subscription.unsubscribe();window.removeEventListener(RELOGIN_EVENT,onRelogin)};
  },[]);
  if(loading) return <div className="grid min-h-screen place-items-center bg-[var(--tx-bg)]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--tx-border)] border-t-[var(--tx-accent)]"/></div>;
  const user=session?.user||(relogin?lastUser:null);
  if(!user) return <LoginPage/>;
  return <>
    <DashboardLayout user={user}/>
    {relogin&&<SessionRelogin email={String(user?.email||"")} reason={relogin} onEmailLogin={()=>{hadSession.current=false;setRelogin(null);setLastUser(null);setSession(null)}} onClose={session?.user?()=>{setRelogin(null);resetReloginRequest()}:undefined}/>}
  </>;
}
