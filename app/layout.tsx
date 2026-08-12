import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "TubeX — YouTube Growth Workspace",
  description:
    "TubeX: extensão de crescimento no YouTube com SEO, IA, tendências e ferramentas para creators.",
  applicationName: "TubeX",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
