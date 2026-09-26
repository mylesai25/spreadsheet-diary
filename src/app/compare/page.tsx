import type { Metadata } from "next";
import Link from "next/link";
import { buildComparison, PRIOR_YEARS, type Period } from "@/lib/compare";
import { ChartCard } from "@/components/charts/Charts";
import { CumulativeRace, DeltaTile, MonthCompare, RankTable } from "@/components/charts/Compare";

export const metadata: Metadata = { title: "Compare" };
export const dynamic = "force-dynamic";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ vs?: string; period?: string }> }) {
  const { vs, period: p } = await searchParams;
  const yearB = PRIOR_YEARS.includes(Number(vs)) ? Number(vs) : PRIOR_YEARS[0];
  const period: Period = p === "full" ? "full" : "same";
  const c = await buildComparison(yearB, period);
  const [mm, dd] = c.cutoff.split("-").map(Number);
  const windowLabel = period === "same" ? `Jan 1 – ${MONTH_NAMES[mm - 1].slice(0, 3)} ${dd} of each year` : `all of ${c.yearB} vs. ${c.yearA} so far`;
  const href = (q: Partial<{ vs: number; period: Period }>) => `/compare?vs=${q.vs ?? yearB}&period=${q.period ?? period}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{c.yearA} vs. {c.yearB}</h1>
          <p className="text-sm text-ink-2">{windowLabel} · {c.daysA} vs. {c.daysB} days logged</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg">
            {PRIOR_YEARS.map((y) => <Link key={y} href={href({ vs: y })} aria-pressed={y === yearB} role="button">vs {y}</Link>)}
          </div>
          <div className="seg">
            <Link href={href({ period: "same" })} aria-pressed={period === "same"} role="button">Same period</Link>
            <Link href={href({ period: "full" })} aria-pressed={period === "full"} role="button">Full {c.yearB}</Link>
          </div>
        </div>
      </div>

      {c.daysB === 0 ? (
        <div className="card p-6 text-sm text-ink-2">No {c.yearB} data available. Add the sheet id as <code>SHEET_ID_{c.yearB}</code> or export it to <code>data/csv-{c.yearB}/</code>.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {c.metrics.map((m) => <DeltaTile key={m.key} m={m} yearA={c.yearA} yearB={c.yearB} />)}
          </div>
          <p className="-mt-1 text-xs text-muted">Lime = moved in the good direction, red = the other way, gray = just different. Percent tiles show the change in points.</p>

          <h2 className="section-title mt-2">Month by month</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {c.monthly.map((ch) => (
              <ChartCard key={ch.key} title={ch.title}><MonthCompare data={ch.data} yearA={c.yearA} yearB={c.yearB} unit={ch.unit} /></ChartCard>
            ))}
          </div>

          <h2 className="section-title mt-2">Running totals</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {c.cumulative.map((ch) => (
              <ChartCard key={ch.key} title={ch.title} sub="Cumulative by day of year"><CumulativeRace data={ch.data} yearA={c.yearA} yearB={c.yearB} unit={ch.unit} /></ChartCard>
            ))}
          </div>

          <h2 className="section-title mt-2">Then vs. now</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.ranks.map((r) => (
              <ChartCard key={r.title} title={r.title} sub={r.sub}><RankTable data={r} yearA={c.yearA} yearB={c.yearB} /></ChartCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
