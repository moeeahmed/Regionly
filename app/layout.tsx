import type { Metadata, Viewport } from "next";
import { Doto, Geist_Mono, Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const head = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-head" });
const dot = Doto({ subsets: ["latin"], weight: ["700", "900"], variable: "--font-dot" });

export const metadata: Metadata = {
  title: "Regionly: localise your best ads for every market",
  description: "Turn a winning video ad into native versions for any market, dubbed with ElevenLabs or recast with Higgsfield.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f7f8f5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${head.variable} ${dot.variable}`}>
      <body>{children}</body>
    </html>
  );
}
