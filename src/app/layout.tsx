import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
export const metadata: Metadata = { title: "PolyCopy — Polymarket Copy Trading", description: "Discover, track, and auto-copy top Polymarket traders" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="bg-bg-1 text-zinc-100 font-sans antialiased"><Providers>{children}</Providers></body></html>;
}
