import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "LendLoop — Borrow what you need. Lend what you don't.",
    template: "%s · LendLoop",
  },
  description:
    "A neighbourhood tool-lending board. Borrow what you need, lend what you don't, with automated reminders so nothing gets forgotten.",
  openGraph: {
    title: "LendLoop",
    description: "Borrow what you need. Lend what you don't.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5efe3",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${mono.variable} min-h-dvh antialiased`}
    >
      <body className="min-h-dvh bg-paper font-sans text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
