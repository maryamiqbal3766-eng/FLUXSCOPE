import type { Metadata } from "next";
import { Noto_Naskh_Arabic, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";

// Urdu fonts are self-hosted at build time and exposed only as CSS variables;
// they are applied exclusively by `.appUr` rules, so English is unaffected.
const urduText = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-urdu-text",
  display: "swap",
  preload: false,
});
const urduDisplay = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-urdu-display",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = { title: "FLUXSCOPE — Where Economic Change Meets Business Reality.", description: "FLUXSCOPE helps Pakistani SMEs understand economic changes, quantify business impact, simulate responses, and monitor results." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" className={`${urduText.variable} ${urduDisplay.variable}`}><body>{children}</body></html>; }
