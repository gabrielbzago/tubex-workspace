import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const bodyFont = Inter({ subsets: ["latin"], variable: "--tx-font-body", display: "swap" });
const displayFont = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--tx-font-display", display: "swap" });

export const metadata: Metadata = {
  title: "TubeX — YouTube Growth Workspace",
  description:
    "TubeX: extensão de crescimento no YouTube com SEO, IA, tendências e ferramentas para creators.",
  applicationName: "TubeX",
  icons: { icon: "/icon.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="system" className={`${bodyFont.variable} ${displayFont.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(() => { try { const saved = localStorage.getItem("tubex-theme"); const mode = saved === "light" || saved === "dark" ? saved : "system"; const root = document.documentElement; root.dataset.theme = mode; root.classList.toggle("light", mode === "light"); root.classList.toggle("dark", mode === "dark"); root.style.colorScheme = mode === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode; root.dataset.themeResolved = root.style.colorScheme; } catch (_) {} })();` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
