"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";
const KEY = "tubex-theme";

function resolveMode(mode: Mode): "light" | "dark" {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: Mode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
  root.setAttribute("data-theme", mode);
  root.style.colorScheme = resolveMode(mode);
  root.dataset.themeResolved = resolveMode(mode);
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    const initial: Mode = saved === "light" || saved === "dark" ? saved : "system";
    setMode(initial);
    applyTheme(initial);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if ((localStorage.getItem(KEY) || "system") === "system") applyTheme("system");
    };
    const onSync = (event: Event) => {
      const next = (event as CustomEvent<Mode>).detail;
      if (next === "system" || next === "light" || next === "dark") {
        setMode(next);
        applyTheme(next);
      }
    };
    media.addEventListener?.("change", onSystemChange);
    window.addEventListener("tubex-theme-change", onSync);
    return () => {
      media.removeEventListener?.("change", onSystemChange);
      window.removeEventListener("tubex-theme-change", onSync);
    };
  }, []);

  function cycleTheme() {
    const next: Mode = mode === "system" ? "dark" : mode === "dark" ? "light" : "system";
    setMode(next);
    localStorage.setItem(KEY, next);
    applyTheme(next);
    window.dispatchEvent(new CustomEvent("tubex-theme-change", { detail: next }));
  }

  const Icon = mode === "system" ? Monitor : mode === "dark" ? Moon : Sun;
  const title = mode === "system"
    ? "Tema automático: seguir aparência do dispositivo (clique para escuro)"
    : mode === "dark"
      ? "Tema escuro ativo (clique para claro)"
      : "Tema claro ativo (clique para automático)";

  return (
    <button type="button" onClick={cycleTheme} title={title} aria-label={title}
      className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] text-[var(--tx-muted)] transition hover:border-[var(--tx-blue)] hover:text-[var(--tx-text)]">
      <Icon size={15} />
    </button>
  );
}
