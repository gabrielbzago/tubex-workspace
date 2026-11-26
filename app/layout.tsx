import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// Fontes via Google Fonts (link) em vez de next/font: o next/font/google quebrava o build na Vercel (Turbopack).
const FONTS_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap";

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS_URL} />
        <script dangerouslySetInnerHTML={{ __html: `(() => { try { const saved = localStorage.getItem("tubex-theme"); const mode = saved === "light" || saved === "dark" ? saved : "system"; const root = document.documentElement; root.dataset.theme = mode; root.classList.toggle("light", mode === "light"); root.classList.toggle("dark", mode === "dark"); root.style.colorScheme = mode === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode; root.dataset.themeResolved = root.style.colorScheme; } catch (_) {} })();` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
