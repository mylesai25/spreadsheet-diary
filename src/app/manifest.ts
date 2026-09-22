import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spreadsheet Diary",
    short_name: "Diary",
    description: "Log the day and see the year at a glance.",
    start_url: "/log",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f9f9f7",
    theme_color: "#1a7f37",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
