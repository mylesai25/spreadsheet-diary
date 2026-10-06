import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { buildDashboard, RANGES, type Range } from "@/lib/metrics";
import { buildInsights } from "@/lib/insights";
import { buildActivityStats } from "@/lib/activityStats";
import { CHARTS_COOKIE, DEFAULT_CHARTS, decodeSelection } from "@/lib/chartCatalog";
import { formatShortDate } from "@/lib/dates";
import { buildClosetStats } from "@/lib/closetStats";
import { ClosetStatsView } from "@/components/ClosetStatsView";
import { DashboardPicker } from "@/components/DashboardPicker";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * The dashboard is a pick-your-own gallery of the Diary_Graphs figures. Which ones show comes from
 * `?charts=a,b,c` (shareable), else the `dash_charts` cookie the picker writes, else the default set.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string; view?: string; charts?: string }> }) {
  const { range: q, view, charts } = await searchParams;
  const range: Range = RANGES.some((r) => r.key === q) ? (q as Range) : "30d";
  if (view === "closet") return <ClosetPage />;

  const jar = await cookies();
  const initial = decodeSelection(charts) ?? decodeSelection(jar.get(CHARTS_COOKIE)?.value) ?? DEFAULT_CHARTS;
  const [d, ins, act] = await Promise.all([buildDashboard(range), buildInsights(range), buildActivityStats(range)]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-ink-2">
            {formatShortDate(d.start)} – {formatShortDate(d.end)} · {d.daysLogged} days logged
            {d.missingDays > 0 && <> · <Link href="/log" className="text-warn underline-offset-2 hover:underline">{d.missingDays} missing</Link></>}
            {d.storeKind === "csv" && " · local CSV mode"}
          </p>
        </div>
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <RangeTabs range={range} />
          <Link href="/log" className="btn-primary ml-auto shrink-0 sm:ml-0">Log today</Link>
        </div>
      </div>

      <DashboardPicker data={{ d, ins, act }} initial={initial} />
    </div>
  );
}

/** Time-range pills plus the Closet tab (which isn't a time range: it's the whole Virtual Closet). */
function RangeTabs({ range }: { range: Range | "closet" }) {
  return (
    <div className="seg overflow-x-auto [scrollbar-width:none]">
      {RANGES.map((r) => (
        <Link key={r.key} href={`/dashboard?range=${r.key}`} aria-pressed={r.key === range} role="button">{r.label}</Link>
      ))}
      <Link href="/dashboard?view=closet" aria-pressed={range === "closet"} role="button">👕 Closet</Link>
    </div>
  );
}

async function ClosetPage() {
  const s = await buildClosetStats();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Virtual Closet</h1>
          <p className="text-sm text-ink-2">{s.total} pieces · {s.greenPct}% green · {s.anyGreenPct}% with some green{s.storeKind === "csv" && " · local CSV mode"}</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <RangeTabs range="closet" />
          <Link href="/log" className="btn-primary ml-auto shrink-0 sm:ml-0">Log today</Link>
        </div>
      </div>
      <ClosetStatsView s={s} />
    </div>
  );
}
