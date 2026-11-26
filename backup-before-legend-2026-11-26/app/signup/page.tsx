"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "@/components/theme-toggle";

type Lang="pt-br"|"pt-pt"|"es"|"en";
const t={
 "pt-br":{title:"Criar conta",sub:"Comece no plano Free.",email:"E-mail",password:"Senha",create:"Criar conta",creating:"Criando...",back:"Voltar ao login",ok:"Conta criada. Verifique seu e-mail para confirmar o acesso.",error:"Não foi possível criar a conta."},
 "pt-pt":{title:"Criar conta",sub:"Comece no plano Free.",email:"E-mail",password:"Palavra-passe",create:"Criar conta",creating:"A criar...",back:"Voltar ao início de sessão",ok:"Conta criada. Verifique o seu e-mail para confirmar o acesso.",error:"Não foi possível criar a conta."},
 es:{title:"Crear cuenta",sub:"Empieza con el plan Free.",email:"Correo",password:"Contraseña",create:"Crear cuenta",creating:"Creando...",back:"Volver al inicio de sesión",ok:"Cuenta creada. Revisa tu correo para confirmar el acceso.",error:"No se pudo crear la cuenta."},
 en:{title:"Create account",sub:"Start with the Free plan.",email:"Email",password:"Password",create:"Create account",creating:"Creating...",back:"Back to sign in",ok:"Account created. Check your email to confirm access.",error:"We couldn't create the account."}
} as const;
const langs=[["pt-br","🇧🇷"],["pt-pt","🇵🇹"],["es","🇪🇸"],["en","🇺🇸"]] as const;

export default function Signup(){
 const [lang,setLang]=useState<Lang>("pt-br"),[open,setOpen]=useState(false),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[show,setShow]=useState(false),[msg,setMsg]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false);
 useEffect(()=>{const saved=localStorage.getItem("tubex-language") as Lang|null;if(saved&&t[saved])setLang(saved)},[]);
 const c=t[lang];
 function change(l:Lang){setLang(l);localStorage.setItem("tubex-language",l);setOpen(false);document.documentElement.lang=l}
 async function submit(e:React.FormEvent){e.preventDefault();setLoading(true);setError("");setMsg("");const{error}=await supabase.auth.signUp({email:email.trim().toLowerCase(),password,options:{emailRedirectTo:`${location.origin}/dashboard`}});if(error)setError(c.error);else setMsg(c.ok);setLoading(false)}
 return <main className="grid min-h-screen place-items-center bg-[var(--tx-bg)] p-5 text-[var(--tx-text)]"><div className="w-full max-w-md">
  <div className="mb-4 flex items-center justify-end gap-2"><ThemeToggle/><div className="relative"><button onClick={()=>setOpen(!open)} className="tx-mini-btn">{langs.find(x=>x[0]===lang)?.[1]}<ChevronDown size={11}/></button>{open&&<div className="tx-menu">{langs.map(([id,flag])=><button key={id} onClick={()=>change(id as Lang)}>{flag} {id.toUpperCase()}</button>)}</div>}</div></div>
  <form onSubmit={submit} className="tx-surface w-full rounded-[22px] p-7"><a href="/" className="text-xl font-black">Tube<span className="text-[var(--tx-accent)]">X</span></a><h1 className="mt-8 text-3xl font-black">{c.title}</h1><p className="mt-2 text-sm text-[var(--tx-muted)]">{c.sub}</p>{msg&&<p className="tx-success">{msg}</p>}{error&&<p className="tx-error">{error}</p>}<label className="mt-6 grid gap-2"><span className="tx-label">{c.email}</span><input className="tx-input-wrap tx-input" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="mt-4 grid gap-2"><span className="tx-label">{c.password}</span><div className="tx-input-wrap"><input className="tx-input" type={show?"text":"password"} required minLength={6} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" onClick={()=>setShow(!show)} className="text-[var(--tx-muted)]">{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label><button disabled={loading} className="tx-btn tx-btn-primary mt-6 w-full">{loading?c.creating:c.create}</button><a href="/" className="mt-4 block text-center text-xs font-bold text-[var(--tx-accent)]">{c.back}</a></form>
 </div></main>
}
