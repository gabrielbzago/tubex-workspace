"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";
const KEY = "tubex-theme";

function applyTheme(mode: Mode) {
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Mode | null) || "system";
    setMode(saved);
    applyTheme(saved);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = (localStorage.getItem(KEY) as Mode | null) || "system";
      if (current === "system") applyTheme("system");
    };

    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  function cycle() {
    const next: Mode =
      mode === "system" ? "light" : mode === "light" ? "dark" : "system";

    setMode(next);
    localStorage.setItem(KEY, next);
    applyTheme(next);
    window.dispatchEvent(
      new CustomEvent("tubex-theme-change", { detail: next })
    );
  }

  const Icon = mode === "system" ? Monitor : mode === "dark" ? Moon : Sun;
  const title =
    mode === "system"
      ? "Tema automático"
      : mode === "dark"
        ? "Tema escuro"
        : "Tema claro";

  return (
    <button
      type="button"
      onClick={cycle}
      title={title}
      aria-label={title}
      className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--tx-border)] bg-[var(--tx-surface)] text-[var(--tx-muted)] transition hover:border-[var(--tx-accent)] hover:text-[var(--tx-text)]"
    >
      <Icon size={15} />
    </button>
  );
}
