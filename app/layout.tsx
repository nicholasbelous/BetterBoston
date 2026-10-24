import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import BottomNav from "@/components/shell/BottomNav";
import HeaderFallback from "@/components/shell/HeaderFallback";
import SiteHeader from "@/components/shell/SiteHeader";
import "./globals.css";

// System fonts only: no network fetch at build time (hackathon wifi).
export const metadata: Metadata = {
  title: "BetterBoston",
  description:
    "A plain-language climate report for your Boston block, from satellite and aerial imagery.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#060f16",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-mint focus:px-4 focus:py-2 focus:text-navy-950"
        >
          Skip to content
        </a>
        {/* Header and nav read the URL (?lat&lng&q) to keep the chosen place between screens. */}
        <Suspense fallback={<HeaderFallback />}>
          <SiteHeader />
        </Suspense>
        <main id="main" className="flex-1 pb-24 md:pb-12">
          {children}
        </main>
        <footer className="hidden border-t border-line py-6 text-center text-xs text-ink-mute md:block">
          Scores compare blocks with each other and are not an official assessment.{" "}
          <Link href="/about" className="underline underline-offset-2 hover:text-ink-dim">
            About the data
          </Link>
        </footer>
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}
