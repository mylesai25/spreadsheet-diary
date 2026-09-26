import type { Metadata } from "next";
import Link from "next/link";
import { buildInsights } from "@/lib/insights";
import { RANGES, type Range } from "@/lib/metrics";
import { formatShortDate } from "@/lib/dates";
import { ChartCard, RankBars, VerticalBars } from "@/components/charts/Charts";
import { Dumbbell, FriendBars, Heatmap, Histogram, RankList, ScatterFit, YearCalendar } from "@/components/charts/Insights";

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
          <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
          <p className="text-sm text-ink-2">{formatShortDate(d.start)} – {formatShortDate(d.end)} · {d.daysLogged} days · the Diary_Graphs figures, live</p>
        </div>
        <div className="seg overflow-x-auto [scrollbar-width:none]">
          {RANGES.map((r) => (
            <Link key={r.key} href={`/insights?range=${r.key}`} aria-pressed={r.key === range} role="button">{r.label}</Link>
          ))}
        </div>
      </div>

      <ChartCard title={`${d.year} Calendars`} sub="Every day of the year, colored by what you logged (Sunday-start weeks)">
        <YearCalendar views={d.calendars} year={d.year} />
      </ChartCard>

      <h2 className="section-title mt-2">Wardrobe</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={`My Top Shades of Green Worn in ${d.year}`} sub="Wears across shirt, pants, shoes, socks, hat and jacket"><VerticalBars data={d.greenShades} unit="Wears" colorByName /></ChartCard>
        <ChartCard title={`My Most-Worn Brands in ${d.year}`} sub="All clothing columns pooled"><VerticalBars data={d.brands} unit="Wears" /></ChartCard>
        <ChartCard title="Favorite outfits" sub="Shirt + pants pairings worn most" className="lg:col-span-2"><RankList data={d.outfits} /></ChartCard>
      </div>

      <h2 className="section-title mt-2">Body</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Sleep distribution" sub="Nights by hours slept · dashed line = 8-hour target"><Histogram data={d.sleepHist} target="8h" /></ChartCard>
        <ChartCard title={`Calories Burned vs Fun Meter ${d.year}`} sub="Does a big day make a fun day?"><ScatterFit data={d.calFun} fit={d.calFunFit} xLabel="Calories" yLabel="Fun" /></ChartCard>
        <ChartCard title={`My Heart Rate Spread in ${d.year}`} sub="Resting → peak, monthly average"><Dumbbell data={d.hrByMonth} /></ChartCard>
      </div>

      <h2 className="section-title mt-2">People</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Fun with friends" sub="Average fun meter on days you saw each person (most-seen first)"><FriendBars data={d.friends} /></ChartCard>
        <ChartCard title="Days seen" sub="Days together"><RankBars data={d.friends.map((f) => ({ name: f.name, value: f.days }))} /></ChartCard>
      </div>

      <h2 className="section-title mt-2">Food</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ChartCard title="Fruits" sub="Days eaten"><RankBars data={d.fruits} /></ChartCard>
        <ChartCard title="Vegetables" sub="Days eaten"><RankBars data={d.veggies} /></ChartCard>
        <ChartCard title="Meats" sub="Days eaten"><RankBars data={d.meats} /></ChartCard>
        <ChartCard title="Snacks" sub="Days eaten"><RankBars data={d.snacks} /></ChartCard>
        <ChartCard title="Candy Eaten by Season" sub="Days each candy showed up" className="sm:col-span-2"><Heatmap data={d.candySeason} /></ChartCard>
        <ChartCard title="Candy" sub="Days eaten" className="sm:col-span-2"><RankBars data={d.candy} /></ChartCard>
      </div>

      <h2 className="section-title mt-2">Out and about</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ChartCard title="Hours by sport" sub="From Sports Played × Duration"><RankBars data={d.sportHours} unit="Hours" /></ChartCard>
        <ChartCard title="Public transit" sub="Rides"><RankBars data={d.transit} unit="Rides" /></ChartCard>
        <ChartCard title="States visited" sub="Days"><RankBars data={d.states} /></ChartCard>
      </div>

      <h2 className="section-title mt-2">Scorecards</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ChartCard title="Golf hole outcomes" sub={d.golfNote}><RankBars data={d.golfOutcomes} unit="Holes" /></ChartCard>
        <ChartCard title="Putting" sub="Holes by putt count (solo rounds)"><RankBars data={d.golfPutts} unit="Holes" /></ChartCard>
        <ChartCard title="Climbs completed" sub="By V-grade"><RankBars data={d.climbGrades} unit="Climbs" /></ChartCard>
        <ChartCard title="Ski runs" sub="By difficulty"><RankBars data={d.skiRuns} unit="Runs" /></ChartCard>
      </div>
    </div>
  );
}
