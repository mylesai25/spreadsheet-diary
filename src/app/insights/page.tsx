import type { Metadata } from "next";
import Link from "next/link";
import { buildInsights } from "@/lib/insights";
import { RANGES, type Range } from "@/lib/metrics";
import { formatShortDate } from "@/lib/dates";
import { ChartCard, RankBars } from "@/components/charts/Charts";
import { ColorBars, Dumbbell, FriendBars, Heatmap, Histogram, RankList, ScatterFit, YearCalendar } from "@/components/charts/Insights";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: q } = await searchParams;
  const range: Range = RANGES.some((r) => r.key === q) ? (q as Range) : "ytd";
  const d = await buildInsights(range);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
          <p className="text-sm text-muted">{formatShortDate(d.start)} – {formatShortDate(d.end)} · {d.daysLogged} days · ported from the Diary_Graphs notebook</p>
        </div>
        <div className="seg overflow-x-auto [scrollbar-width:none]">
          {RANGES.map((r) => (
            <Link key={r.key} href={`/insights?range=${r.key}`} aria-pressed={r.key === range} role="button" style={{ padding: "0.375rem 0.75rem", fontSize: 13 }}>{r.label}</Link>
          ))}
        </div>
      </div>

      <ChartCard title={`${d.year} calendars`} sub="Every day of the year, colored by what you logged (Sunday-start weeks)">
        <YearCalendar views={d.calendars} year={d.year} />
      </ChartCard>

      <h2 className="mt-2 text-lg font-semibold">Wardrobe</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Shades of green worn" sub="Across shirt, pants, shoes, socks, hat and jacket"><ColorBars data={d.greenShades} unit="Wears" /></ChartCard>
        <ChartCard title="Most-worn brands" sub="All clothing columns pooled"><RankBars data={d.brands} unit="Wears" /></ChartCard>
        <ChartCard title="Favorite outfits" sub="Shirt + pants pairings worn most" className="lg:col-span-2"><RankList data={d.outfits} /></ChartCard>
      </div>

      <h2 className="mt-2 text-lg font-semibold">Body</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Sleep distribution" sub="Nights by hours slept · dashed line = 8-hour target"><Histogram data={d.sleepHist} target="8h" /></ChartCard>
        <ChartCard title="Calories burned vs. fun" sub="Does a big day make a fun day?"><ScatterFit data={d.calFun} fit={d.calFunFit} xLabel="Calories" yLabel="Fun" /></ChartCard>
        <ChartCard title="Heart-rate spread" sub="Resting → peak, by month"><Dumbbell data={d.hrByMonth} /></ChartCard>
      </div>

      <h2 className="mt-2 text-lg font-semibold">People</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Fun with friends" sub="Average fun meter on days you saw each person (most-seen first)"><FriendBars data={d.friends} /></ChartCard>
        <ChartCard title="Days seen" sub="Days together"><RankBars data={d.friends.map((f) => ({ name: f.name, value: f.days }))} /></ChartCard>
      </div>

      <h2 className="mt-2 text-lg font-semibold">Food</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ChartCard title="Fruits" sub="Days eaten"><RankBars data={d.fruits} /></ChartCard>
        <ChartCard title="Vegetables" sub="Days eaten"><RankBars data={d.veggies} /></ChartCard>
        <ChartCard title="Meats" sub="Days eaten"><RankBars data={d.meats} /></ChartCard>
        <ChartCard title="Snacks" sub="Days eaten"><RankBars data={d.snacks} /></ChartCard>
        <ChartCard title="Candy by season" sub="Days each candy showed up" className="sm:col-span-2"><Heatmap data={d.candySeason} /></ChartCard>
        <ChartCard title="Candy" sub="Days eaten" className="sm:col-span-2"><RankBars data={d.candy} /></ChartCard>
      </div>

      <h2 className="mt-2 text-lg font-semibold">Out and about</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ChartCard title="Hours by sport" sub="From Sports Played × Duration"><RankBars data={d.sportHours} unit="Hours" /></ChartCard>
        <ChartCard title="Public transit" sub="Rides"><RankBars data={d.transit} unit="Rides" /></ChartCard>
        <ChartCard title="States visited" sub="Days"><RankBars data={d.states} /></ChartCard>
      </div>

      <h2 className="mt-2 text-lg font-semibold">Scorecards</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ChartCard title="Golf hole outcomes" sub={d.golfNote}><RankBars data={d.golfOutcomes} unit="Holes" /></ChartCard>
        <ChartCard title="Putting" sub="Holes by putt count (solo rounds)"><RankBars data={d.golfPutts} unit="Holes" /></ChartCard>
        <ChartCard title="Climbs completed" sub="By V-grade"><RankBars data={d.climbGrades} unit="Climbs" /></ChartCard>
        <ChartCard title="Ski runs" sub="By difficulty"><RankBars data={d.skiRuns} unit="Runs" /></ChartCard>
      </div>
    </div>
  );
}
