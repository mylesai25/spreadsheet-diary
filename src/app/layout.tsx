import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: { default: "Spreadsheet Diary", template: "%s · Spreadsheet Diary" },
  description: "Log the day and see the year at a glance.",
  applicationName: "Spreadsheet Diary",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Diary", statusBarStyle: "black" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
