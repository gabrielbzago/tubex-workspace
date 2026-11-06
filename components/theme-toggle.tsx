"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Mode = "light" | "dark";
const KEY = "tubex-theme";
function applyTheme(mode: Mode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
  root.setAttribute("data-theme", mode);
  root.style.colorScheme = mode;
}
export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("light");
  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    const initial: Mode = saved === "dark" ? "dark" : "light";
    setMode(initial);
    applyTheme(initial);
    const onSync = (event: Event) => {
      const next = (event as CustomEvent<Mode>).detail;
      if (next === "light" || next === "dark") { setMode(next); applyTheme(next); }
    };
    window.addEventListener("tubex-theme-change", onSync);
    return () => window.removeEventListener("tubex-theme-change", onSync);
  }, []);
  function toggle() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    setMode(next); localStorage.setItem(KEY, next); applyTheme(next);
    window.dispatchEvent(new CustomEvent("tubex-theme-change", { detail: next }));
  }
  const title = mode === "dark" ? "Ativar tema claro" : "Ativar tema escuro";
  const Icon = mode === "dark" ? Sun : Moon;
  return <button type="button" onClick={toggle} title={title} aria-label={title} className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] text-[var(--tx-muted)] transition hover:border-[var(--tx-accent)] hover:text-[var(--tx-text)]"><Icon size={15}/></button>;
}
