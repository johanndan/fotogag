// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "server-only";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NextTopLoader from "nextjs-toploader";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/constants";
import { AgenticDevStudioStickyBanner } from "@/components/startup-studio-sticky-banner";
import Script from "next/script";

export const dynamic = "force-dynamic";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s - ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  keywords: ["PhotoGag", "FotoGag", "AI Photoeditor", "AI Photo-Tool", "AI Photoeffcts", "Edit Photos with AI"],
  authors: [{ name: "PhotoGag.AI" }],
  creator: "PhotoGag.AI",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    creator: "@LubomirGeorg",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function BaseLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cfBeaconToken = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <NuqsAdapter>
          <NextTopLoader initialPosition={0.15} shadow="0 0 10px #000, 0 0 5px #000" height={4} />
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <TooltipProvider delayDuration={100} skipDelayDuration={50}>
              {children}
            </TooltipProvider>
          </ThemeProvider>
          <Toaster richColors closeButton position="top-right" expand duration={7000} />
          <AgenticDevStudioStickyBanner />
        </NuqsAdapter>

        {cfBeaconToken ? (
          <Script
            id="cf-web-analytics"
            strategy="afterInteractive"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            crossOrigin="anonymous"
            data-cf-beacon={JSON.stringify({ token: cfBeaconToken })}
            onError={() => {
            }}
          />
        ) : null}
      </body>
    </html>
  );
}
