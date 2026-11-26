"use client";
import { useState } from "react";
import AdminAnalytics from "./admin-analytics";
import AdminSubscriberBehavior from "./admin-subscriber-behavior";
import AdminAffiliates from "./admin-affiliates";
import CancellationAdmin from "./cancellation-center";

type Sub = "analytics" | "subscribers" | "usage" | "cancellations" | "affiliates";
const TABS: [Sub, string][] = [["analytics", "Analytics"], ["subscribers", "Assinantes"], ["usage", "Uso (free)"], ["cancellations", "Cancelamentos"], ["affiliates", "Afiliados"]];
export default function AdminHub({ initial = "analytics", onChange }: { initial?: Sub; onChange?: (s: Sub) => void }) {
  const [sub, setSubState] = useState<Sub>(initial);
  const setSub = (s: Sub) => { setSubState(s); onChange?.(s); };
  return (
    <div className="space-y-5">
      <nav className="tx-tabs" role="tablist" aria-label="Administração">
        {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={sub === id} className={sub === id ? "is-active" : ""} onClick={() => setSub(id)}>{label}</button>)}
      </nav>
      <div className="tx-fade-in" key={sub}>
        {sub === "analytics" && <AdminAnalytics />}
        {sub === "subscribers" && <AdminSubscriberBehavior />}
        {sub === "usage" && <AdminSubscriberBehavior segment="free" />}
        {sub === "cancellations" && <CancellationAdmin />}
        {sub === "affiliates" && <AdminAffiliates />}
      </div>
    </div>
  );
}
