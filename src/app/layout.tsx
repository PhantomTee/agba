import type { Metadata } from "next";
import { Suspense } from "react";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://agba.vercel.app"),
  title: {
    default: "Àgbà | Africa's prediction market",
    template: "%s — Àgbà",
  },
  description: "AI-powered prediction markets for Nigerian and pan-African news events. Bet USDC on politics, forex, sports, and economy.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  manifest: "/manifest.json",
  openGraph: {
    siteName: "Àgbà",
    type: "website",
    locale: "en_NG",
    url: "https://agba.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    site: "@agba_market",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background text-white">
        <Providers>
          <Suspense fallback={<div className="border-b border-white/10 bg-background px-4 py-4 text-[#f5a623]">Àgbà</div>}>
            <Header />
          </Suspense>
          {children}
        </Providers>
      </body>
    </html>
  );
}
