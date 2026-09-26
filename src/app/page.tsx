import Link from "next/link";
import { buildDashboard, RANGES, type Range } from "@/lib/metrics";
import { formatShortDate, todayISO } from "@/lib/dates";
import { ChartCard, DayBars, GolfChart, RankBars, Tile, TimeLines, WeekBars } from "@/components/charts/Charts";
import { buildClosetStats } from "@/lib/closetStats";
import { ClosetStatsView } from "@/components/ClosetStatsView";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string; view?: string }> }) {
  const { range: q, view } = await searchParams;
  const range: Range = RANGES.some((r) => r.key === q) ? (q as Range) : "30d";
  if (view === "closet") return <ClosetPage />;
  const d = await buildDashboard(range);
  const today = todayISO();
  const weekly = d.days.length > 60;

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
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <RangeTabs range={range} />
          <Link href="/log" className="btn-primary ml-auto shrink-0 sm:ml-0">Log today</Link>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {d.tiles.map((t) => <Tile key={t.label} {...t} />)}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Sleep" sub="Hours slept per night with 7-day average">
          <TimeLines data={d.days} keys={["hoursSlept"]} names={["Hours slept"]} unit="h" domain={[0, 12]} area avgKey="sleep7" />
        </ChartCard>
        <ChartCard title="Fun & productivity" sub="Daily self-ratings, 1–10">
          <TimeLines data={d.days} keys={["fun", "productivity"]} names={["Fun meter", "Productivity"]} domain={[0, 10]} />
        </ChartCard>
        <ChartCard title="Steps" sub={weekly ? "Average steps per day, by week" : "Steps per day with 7-day average"}>
          {weekly
            ? <WeekBars data={d.weeks} keys={["stepsAvg"]} names={["Avg steps"]} />
            : <DayBars data={d.days} dataKey="steps" name="Steps" avgKey="steps7" />}
        </ChartCard>
        <ChartCard title="Gym days per week" sub="Days with a gym visit (Sunday-start weeks)">
          <WeekBars data={d.weeks} keys={["gymDays"]} names={["Gym days"]} />
        </ChartCard>
        <ChartCard title="Cooked vs. ate out" sub="Meals per week (breakfast, lunch, dinner)">
          <WeekBars data={d.weeks} keys={["cooked", "restaurant"]} names={["Cooked", "Restaurant"]} />
        </ChartCard>
        <ChartCard title="Drinks per week">
          <WeekBars data={d.weeks} keys={["drinks"]} names={["Drinks"]} />
        </ChartCard>
        <ChartCard title="Golf" sub="Score to par and putts per round">
          <GolfChart data={d.golf} />
        </ChartCard>
        <ChartCard title="Resting heart rate" sub="Beats per minute">
          <TimeLines data={d.days} keys={["restingHR"]} names={["Resting HR"]} domain={[40, "auto"] as unknown as [number, number]} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ChartCard title="Shirt colors" sub="Days worn"><RankBars data={d.shirtColors} colorByName /></ChartCard>
        <ChartCard title="Sky" sub="Days"><RankBars data={d.sky} /></ChartCard>
        <ChartCard title="Woke up in" sub="Days per city"><RankBars data={d.wakeCities} /></ChartCard>
        <ChartCard title="People seen most" sub="Days together"><RankBars data={d.people} /></ChartCard>
        <ChartCard title="Cuisines" sub="Restaurant visits by type"><RankBars data={d.cuisines} unit="Visits" /></ChartCard>
        <ChartCard title="Top restaurants" sub="Visits"><RankBars data={d.restaurants} unit="Visits" /></ChartCard>
        <ChartCard title="Meal ratings" sub="Average rating out of 10"><RankBars data={d.mealRatings} unit="Avg rating" max={10} /></ChartCard>
        <ChartCard title="Video games" sub="Days played"><RankBars data={d.videoGames} /></ChartCard>
        <div className="card flex flex-col justify-between p-4">
          <div>
            <h3 className="text-[15px] font-bold">Keep the streak</h3>
            <p className="mt-1 text-sm text-ink-2">Today is {formatShortDate(today)}. Entries save straight to your Google Sheet.</p>
          </div>
          <Link href="/log" className="btn-primary mt-3 self-start">Log today →</Link>
        </div>
      </div>
    </div>
  );
}

/** Time-range pills plus the Closet tab (which isn't a time range: it's the whole Virtual Closet). */
function RangeTabs({ range }: { range: Range | "closet" }) {
  return (
    <div className="seg overflow-x-auto [scrollbar-width:none]">
      {RANGES.map((r) => (
        <Link key={r.key} href={`/?range=${r.key}`} aria-pressed={r.key === range} role="button">{r.label}</Link>
      ))}
      <Link href="/?view=closet" aria-pressed={range === "closet"} role="button">👕 Closet</Link>
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
