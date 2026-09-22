import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Spreadsheet Diary", template: "%s · Spreadsheet Diary" },
  description: "Log the day and see the year at a glance.",
  applicationName: "Spreadsheet Diary",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Diary", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f9f9f7" }, { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
