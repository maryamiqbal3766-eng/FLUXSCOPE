import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "FLUXSCOPE — Where Economic Change Meets Business Reality.", description: "FLUXSCOPE helps Pakistani SMEs understand economic changes, quantify business impact, simulate responses, and monitor results." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
