"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "@/components/theme-toggle";

type Lang="pt-br"|"pt-pt"|"es"|"en";
const t={
 "pt-br":{title:"Nova senha",label:"Nova senha",save:"Salvar senha",saving:"Salvando...",ok:"Senha atualizada. Você já pode entrar no TubeX.",error:"Não foi possível atualizar a senha.",back:"Voltar ao login"},
 "pt-pt":{title:"Nova palavra-passe",label:"Nova palavra-passe",save:"Guardar palavra-passe",saving:"A guardar...",ok:"Palavra-passe atualizada. Já pode entrar no TubeX.",error:"Não foi possível atualizar a palavra-passe.",back:"Voltar ao início de sessão"},
 es:{title:"Nueva contraseña",label:"Nueva contraseña",save:"Guardar contraseña",saving:"Guardando...",ok:"Contraseña actualizada. Ya puedes entrar en TubeX.",error:"No se pudo actualizar la contraseña.",back:"Volver al inicio de sesión"},
 en:{title:"New password",label:"New password",save:"Save password",saving:"Saving...",ok:"Password updated. You can now sign in to TubeX.",error:"We couldn't update the password.",back:"Back to sign in"}
} as const;
const langs=[["pt-br","🇧🇷"],["pt-pt","🇵🇹"],["es","🇪🇸"],["en","🇺🇸"]] as const;

export default function Reset(){
 const [lang,setLang]=useState<Lang>("pt-br"),[open,setOpen]=useState(false),[password,setPassword]=useState(""),[show,setShow]=useState(false),[msg,setMsg]=useState(""),[err,setErr]=useState(""),[loading,setLoading]=useState(false);
 useEffect(()=>{const saved=localStorage.getItem("tubex-language") as Lang|null;if(saved&&t[saved])setLang(saved)},[]);
 const c=t[lang];
 function change(l:Lang){setLang(l);localStorage.setItem("tubex-language",l);setOpen(false);document.documentElement.lang=l}
 async function save(e:React.FormEvent){e.preventDefault();setLoading(true);setErr("");setMsg("");const{error}=await supabase.auth.updateUser({password});if(error)setErr(c.error);else setMsg(c.ok);setLoading(false)}
 return <main className="grid min-h-screen place-items-center bg-[var(--tx-bg)] p-5 text-[var(--tx-text)]"><div className="w-full max-w-md">
  <div className="mb-4 flex items-center justify-end gap-2"><ThemeToggle/><div className="relative"><button onClick={()=>setOpen(!open)} className="tx-mini-btn">{langs.find(x=>x[0]===lang)?.[1]}<ChevronDown size={11}/></button>{open&&<div className="tx-menu">{langs.map(([id,flag])=><button key={id} onClick={()=>change(id as Lang)}>{flag} {id.toUpperCase()}</button>)}</div>}</div></div>
  <form onSubmit={save} className="tx-surface w-full rounded-[22px] p-7"><a href="/" className="text-xl font-black">Tube<span className="text-[var(--tx-accent)]">X</span></a><h1 className="mt-8 text-3xl font-black">{c.title}</h1>{msg&&<p className="tx-success">{msg}</p>}{err&&<p className="tx-error">{err}</p>}<label className="mt-6 grid gap-2"><span className="tx-label">{c.label}</span><div className="tx-input-wrap"><input className="tx-input" type={show?"text":"password"} minLength={6} required autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" onClick={()=>setShow(!show)} className="text-[var(--tx-muted)]">{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label><button disabled={loading} className="tx-btn tx-btn-primary mt-5 w-full">{loading?c.saving:c.save}</button><a href="/" className="mt-4 block text-center text-xs font-bold text-[var(--tx-accent)]">{c.back}</a></form>
 </div></main>
}
