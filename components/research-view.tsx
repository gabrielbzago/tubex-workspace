"use client";
import { useEffect, useState } from "react";
import { Search, Lightbulb } from "lucide-react";
import SeoWorkspace from "./seo-workspace";
import CreatorWorkspace from "./creator-workspace";

type Sub = "keywords" | "ideas";
export default function ResearchView({ user, plan, initial = "keywords" }: { user: any; plan: string; initial?: Sub }) {
  const [sub, setSub] = useState<Sub>(initial);
  useEffect(() => setSub(initial), [initial]);
  return (
    <div className="space-y-5">
      <header><p className="tx-kicker">Pesquisar</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Descubra o que <span className="tx-gold">seu público procura</span></h1></header>
      <nav className="tx-tabs" role="tablist">
        <button role="tab" aria-selected={sub === "keywords"} className={sub === "keywords" ? "is-active" : ""} onClick={() => setSub("keywords")}><Search size={15} />Palavras-chave</button>
        <button role="tab" aria-selected={sub === "ideas"} className={sub === "ideas" ? "is-active" : ""} onClick={() => setSub("ideas")}><Lightbulb size={15} />Ideias e tendências</button>
      </nav>
      <div className="tx-fade-in" key={sub}>{sub === "keywords" ? <SeoWorkspace user={user} plan={plan} /> : <CreatorWorkspace user={user} plan={plan} />}</div>
    </div>
  );
}
