"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACTIVITIES } from "@/lib/schema/activities";

const primary = [
  { href: "/", label: "Home" },
  { href: "/log", label: "Log today" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/insights", label: "Insights" },
  { href: "/friends", label: "Friends" },
  { href: "/compare", label: "Compare" },
];

const link = (active: boolean) =>
  `shrink-0 rounded-md px-3 py-1.5 text-sm transition ${active ? "bg-accent-soft font-semibold text-neon" : "font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"}`;

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 sm:px-6">
        <Link href="/" className="mr-2 flex items-center gap-2 font-bold tracking-tight">
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md border border-frame bg-surface text-sm">📓</span>
          <span className="hidden sm:inline">Diary</span>
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          {primary.map((l) => (
            <Link key={l.href} href={l.href} className={link(active(l.href))}>{l.label}</Link>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-border" />
          {ACTIVITIES.map((a) => (
            <Link key={a.slug} href={`/activities/${a.slug}`} title={a.title} className={link(active(`/activities/${a.slug}`)).replace("px-3", "px-2.5")}>
              <span aria-hidden>{a.icon}</span> <span className="hidden md:inline">{a.title}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
