import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

// System fonts only: no network fetch at build time (hackathon wifi).
export const metadata: Metadata = {
  title: "ClimateCheck MA",
  description:
    "A plain-language climate report for your Massachusetts block, from satellite and aerial imagery.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* TODO (task 6): real header styling. Mobile first: max-w-md content column. */}
        <header className="flex items-center justify-between px-4 py-3 border-b">
          <Link href="/" className="font-semibold">
            ClimateCheck MA
          </Link>
          <Link href="/about" className="text-sm underline">
            About the data
          </Link>
        </header>
        <main className="flex-1 w-full max-w-md mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
