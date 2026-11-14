"use client";
import { useEffect } from "react";
import AuthProvider from "@/components/auth-provider";
export default function Home(){
  useEffect(()=>{
    const ref=(new URLSearchParams(window.location.search).get("ref")||"").trim().toUpperCase();
    const now=Date.now();
    const storedAt=Number(localStorage.getItem("affiliate_ref_at")||0);
    const existing=(localStorage.getItem("affiliate_ref")||"").trim().toUpperCase();
    const validExisting=existing && storedAt && now-storedAt < 90*24*60*60*1000;
    if(ref && /^[A-Z0-9_-]{4,40}$/.test(ref) && !validExisting){
      localStorage.setItem("affiliate_ref",ref);
      localStorage.setItem("affiliate_ref_at",String(now));
    } else if(existing && !validExisting){
      localStorage.removeItem("affiliate_ref");
      localStorage.removeItem("affiliate_ref_at");
    }
  },[]);
  return <AuthProvider/>;
}
