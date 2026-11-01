import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// next/font mengunduh font saat build; browser tidak memanggil Google Fonts saat runtime.
const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "EWS AI Agent", template: "%s · EWS AI Agent" },
  description: "Early Warning System pelatihan BPSDM Komdigi Yogyakarta",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// CSP bernonce (SH-HDR-01) hanya berlaku pada render dinamis; semua rute dirender per request.
export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  return (
    <html lang="id" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
