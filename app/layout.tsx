import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "TubeX — YouTube Growth Workspace",
  description:
    "TubeX: extensão de crescimento no YouTube com SEO, IA, tendências e ferramentas para creators.",
  applicationName: "TubeX",
  icons: { icon: "/icon.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="system" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(() => { try { const saved = localStorage.getItem("tubex-theme"); const mode = saved === "light" || saved === "dark" ? saved : "system"; const root = document.documentElement; root.dataset.theme = mode; root.classList.toggle("light", mode === "light"); root.classList.toggle("dark", mode === "dark"); root.style.colorScheme = mode === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode; root.dataset.themeResolved = root.style.colorScheme; } catch (_) {} })();` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
