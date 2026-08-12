"use client";
import { useEffect,useState } from "react";
import { supabase } from "@/lib/supabase";
import DashboardLayout from "@/components/dashboard-layout";
import LoginPage from "@/components/login-page";

export default function AuthProvider(){
  const [session,setSession]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let mounted=true;
    supabase.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setLoading(false)}});
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>{if(mounted)setSession(next)});
    return()=>{mounted=false;data.subscription.unsubscribe()};
  },[]);
  if(loading) return <div className="grid min-h-screen place-items-center bg-[var(--tx-bg)]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--tx-border)] border-t-[var(--tx-accent)]"/></div>;
  return session?.user ? <DashboardLayout user={session.user}/> : <LoginPage/>;
}