"use client";

import { useMemo, useState } from "react";
import type { Dashboard } from "@/lib/metrics";
import type { Insights } from "@/lib/insights";
import type { ActivityStats } from "@/lib/activityStats";
import { CATEGORIES, CHARTS, CHARTS_COOKIE, DEFAULT_CHARTS, encodeSelection, type Category, type ChartDef } from "@/lib/chartCatalog";
import { ChartCard, DayBars, GolfChart, RankBars, ScoreLine, Tile, TimeLines, VerticalBars, WeekBars } from "@/components/charts/Charts";
import { Dumbbell, FriendBars, Heatmap, Histogram, RankList, ScatterFit, YearCalendar } from "@/components/charts/Insights";
import { BubblePack, CumulativeLines, Donut, SendRateBars, TileRow } from "@/components/charts/Activity";
import { GroupBars, LiftHeatmap } from "@/components/charts/Extras";

export interface DashData { d: Dashboard; ins: Insights; act: ActivityStats }

const ORDER = new Map(CHARTS.map((c, i) => [c.id, i]));
const sortIds = (ids: Iterable<string>) => [...new Set(ids)].filter((id) => ORDER.has(id)).sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);

function saveCookie(ids: string[]) {
  try { document.cookie = `${CHARTS_COOKIE}=${encodeURIComponent(encodeSelection(ids))}; path=/; max-age=31536000; SameSite=Lax`; } catch { /* private mode */ }
}

/** Draws one catalogue entry from the merged data. Returns null when the data has nothing to show for it. */
function render(id: string, { d, ins, act }: DashData): React.ReactNode {
  const weekly = d.days.length > 60;
  switch (id) {
    case "tiles": return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{d.tiles.map((t) => <Tile key={t.label} {...t} />)}</div>;
    case "habitCalendars": return <YearCalendar views={ins.calendars} year={ins.year} />;
    case "streaks": return <TileRow tiles={ins.streaks} />;
    case "weekday": return <GroupBars data={ins.weekday} keys={["fun", "productivity", "sleep"]} names={["Fun meter", "Productivity", "Hours slept"]} max={10} />;
    case "sleep": return <TimeLines data={d.days} keys={["hoursSlept"]} names={["Hours slept"]} unit="h" domain={[0, 12]} area avgKey="sleep7" />;
    case "sleepHist": return <Histogram data={ins.sleepHist} target="8h" />;
    case "funProd": return <TimeLines data={d.days} keys={["fun", "productivity"]} names={["Fun meter", "Productivity"]} domain={[0, 10]} />;
    case "calFun": return <ScatterFit data={ins.calFun} fit={ins.calFunFit} xLabel="Calories" yLabel="Fun" />;
    case "sleepFun": return <ScatterFit data={ins.sleepFun} fit={ins.sleepFunFit} xLabel="Hours slept" yLabel="Fun" />;
    case "hours": return <GroupBars data={ins.hours} keys={["bed", "wake"]} names={["Bedtime", "Wake-up"]} unit="" fmt={(v) => String(Math.round(v))} />;
    case "battery": return <Histogram data={ins.battery} subject="battery" noun="mornings" />;
    case "funSky": return <RankBars data={ins.funBySky} unit="Avg fun" max={10} />;
    case "steps": return weekly ? <WeekBars data={d.weeks} keys={["stepsAvg"]} names={["Avg steps"]} /> : <DayBars data={d.days} dataKey="steps" name="Steps" avgKey="steps7" />;
    case "gymWeeks": return <WeekBars data={d.weeks} keys={["gymDays"]} names={["Gym days"]} />;
    case "hrSpread": return <Dumbbell data={ins.hrByMonth} />;
    case "restingHR": return <TimeLines data={d.days} keys={["restingHR"]} names={["Resting HR"]} domain={[40, "auto"] as unknown as [number, number]} />;
    case "sportBubbles": return <BubblePack data={ins.sportHours} />;
    case "sportDays": return <RankBars data={ins.sportDays} />;
    case "stepsWeekday": return <GroupBars data={ins.weekday} keys={["steps"]} names={["Avg steps"]} labels fmt={(v) => Math.round(v).toLocaleString("en-US")} />;
    case "golfTiles": return <TileRow tiles={act.golf.tiles} />;
    case "golfScores18": return <ScoreLine data={act.golf.scores18} />;
    case "golfToPar": return <GolfChart data={d.golf} />;
    case "golfOutcomes": return <Donut data={act.golf.outcomes} unit="holes" />;
    case "golfCumulative": return <CumulativeLines data={act.golf.cumulative} />;
    case "golfPutts": return <RankBars data={act.golf.putts} unit="Holes" />;
    case "golfCourses": return <RankBars data={act.golf.courses} unit="Rounds" labelWidth={150} />;
    case "golfFairways": return <CumulativeLines data={act.golf.fairwaysGreens} yMax={100} unit="%" />;
    case "golfByCourse": return <RankBars data={act.golf.byCourse} unit="Over par" labelWidth={150} />;
    case "golfCart": return <RankBars data={act.golf.cart} unit="Median score" />;
    case "miniTiles": return <TileRow tiles={act.miniGolf.tiles} />;
    case "miniScores": return <ScoreLine data={act.miniGolf.scores} yKey="toPar" />;
    case "miniPutts": return <Donut data={act.miniGolf.putts} unit="holes" />;
    case "miniCourses": return <RankBars data={act.miniGolf.courses} unit="Rounds" labelWidth={150} />;
    case "miniWinners": return <RankBars data={act.miniGolf.winners} unit="Wins" />;
    case "discTiles": return <TileRow tiles={act.discGolf.tiles} />;
    case "discScores": return <ScoreLine data={act.discGolf.scores} yKey="toPar" />;
    case "discOutcomes": return <Donut data={act.discGolf.outcomes} unit="holes" />;
    case "discCumulative": return <CumulativeLines data={act.discGolf.cumulative} />;
    case "discCourses": return <RankBars data={act.discGolf.courses} unit="Rounds" labelWidth={150} />;
    case "discWinners": return <RankBars data={act.discGolf.winners} unit="Wins" />;
    case "climbTiles": return <TileRow tiles={act.climb.tiles} />;
    case "climbGrades": return <Donut data={act.climb.grades} unit="climbs" />;
    case "climbCumulative": return <CumulativeLines data={act.climb.cumulative} />;
    case "climbSendRate": return <SendRateBars data={act.climb.sendRate} />;
    case "climbGyms": return <RankBars data={act.climb.gyms} unit="Sessions" />;
    case "climbColors": return <Donut data={act.climb.colors} unit="climbs" />;
    case "climbColorRate": return <SendRateBars data={act.climb.colorSendRate} />;
    case "skiTiles": return <TileRow tiles={act.ski.tiles} />;
    case "skiRuns": return <Donut data={act.ski.runs} unit="runs" />;
    case "skiCumulative": return <CumulativeLines data={act.ski.cumulative} />;
    case "skiFalls": return <Donut data={act.ski.falls} unit="falls" />;
    case "meals": return <WeekBars data={d.weeks} keys={["cooked", "restaurant"]} names={["Cooked", "Restaurant"]} />;
    case "drinks": return <WeekBars data={d.weeks} keys={["drinks"]} names={["Drinks"]} />;
    case "cuisines": return <RankBars data={d.cuisines} unit="Visits" />;
    case "restaurants": return <RankBars data={d.restaurants} unit="Visits" />;
    case "mealRatings": return <RankBars data={d.mealRatings} unit="Avg rating" max={10} />;
    case "fruits": return <RankBars data={ins.fruits} />;
    case "veggies": return <RankBars data={ins.veggies} />;
    case "meats": return <RankBars data={ins.meats} />;
    case "snacks": return <RankBars data={ins.snacks} />;
    case "candy": return <RankBars data={ins.candy} />;
    case "candySeason": return <Heatmap data={ins.candySeason} />;
    case "candyVeg": return <LiftHeatmap data={ins.candyVeg} />;
    case "drinkTypes": return <RankBars data={ins.drinkTypes} />;
    case "cuisineRatings": return <RankBars data={ins.cuisineRatings} unit="Avg rating" max={10} />;
    case "shirtColors": return <RankBars data={d.shirtColors} colorByName />;
    case "greenShades": return <VerticalBars data={ins.greenShades} unit="Wears" colorByName />;
    case "brands": return <VerticalBars data={ins.brands} unit="Wears" />;
    case "outfits": return <RankList data={ins.outfits} />;
    case "jacketTemp": return <GroupBars data={ins.jacketByTemp} keys={["jacket", "hat", "layers"]} names={["Jacket", "Hat", "2 layers"]} unit="%" max={100} fmt={(v) => String(Math.round(v))} />;
    case "people": return <RankBars data={d.people} />;
    case "friendFun": return <FriendBars data={ins.friends} />;
    case "sky": return <RankBars data={d.sky} />;
    case "wakeCities": return <RankBars data={d.wakeCities} />;
    case "transit": return <RankBars data={ins.transit} unit="Rides" />;
    case "states": return <RankBars data={ins.states} />;
    case "temps": return <TimeLines data={d.days} keys={["high", "low"]} names={["High", "Low"]} unit="°" />;
    case "projects": return <RankBars data={ins.projects} />;
    case "projectProd": return <RankBars data={ins.projectProd} unit="Avg productivity" max={10} />;
    case "videoGames": return <RankBars data={d.videoGames} />;
    case "gameRatings": return <RankBars data={ins.ratings.games} unit="Rating" max={10} labelWidth={150} />;
    case "boardGames": return <RankBars data={ins.boardGames} />;
    case "tvRatings": return <RankBars data={ins.ratings.tv} unit="Rating" max={10} labelWidth={190} />;
    case "movieRatings": return <RankBars data={ins.ratings.movies} unit="Rating" max={10} labelWidth={150} />;
    case "broadwayRatings": return <RankBars data={ins.ratings.broadway} unit="Rating" max={10} labelWidth={150} />;
    case "shows": return <RankBars data={ins.shows} unit="Meals" labelWidth={170} />;
    case "services": return <RankBars data={ins.services} unit="Meals" />;
    default: return null;
  }
}

/** Per-chart subtitle overrides that depend on the data (e.g. the golf note). */
function subFor(c: ChartDef, data: DashData): string | undefined {
  if (c.id === "golfOutcomes" || c.id === "golfPutts") return data.act.golf.note;
  if (c.id === "steps" && data.d.days.length > 60) return "Average steps per day, by week";
  if (c.id === "miniTiles" || c.id === "miniScores") return data.act.miniGolf.rounds ? `${data.act.miniGolf.rounds} rounds in range` : "No mini golf in range";
  if (c.id === "discTiles" || c.id === "discScores") return data.act.discGolf.rounds ? `${data.act.discGolf.rounds} rounds in range` : "No disc golf in range";
  return c.sub;
}

const span: Record<ChartDef["size"], string> = { sm: "lg:col-span-2", md: "sm:col-span-2 lg:col-span-3", lg: "sm:col-span-2 lg:col-span-6" };

export function DashboardPicker({ data, initial }: { data: DashData; initial: string[] }) {
  const [selected, setSelected] = useState<string[]>(() => sortIds(initial));
  const [open, setOpen] = useState(false);
  const chosen = useMemo(() => new Set(selected), [selected]);

  const update = (next: Iterable<string>) => { const ids = sortIds(next); setSelected(ids); saveCookie(ids); };
  const toggle = (id: string) => update(chosen.has(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  const byCat = (cat: Category) => CHARTS.filter((c) => c.category === cat);
  const catCount = (cat: Category) => byCat(cat).filter((c) => chosen.has(c.id)).length;
  const toggleCat = (cat: Category) => {
    const ids = byCat(cat).map((c) => c.id);
    update(catCount(cat) ? selected.filter((s) => !ids.includes(s)) : [...selected, ...ids]);
  };
  const only = (cat: Category) => update(byCat(cat).map((c) => c.id));

  const sections = CATEGORIES.map((cat) => ({ cat, charts: byCat(cat.key).filter((c) => chosen.has(c.id)) })).filter((s) => s.charts.length);

  return (
    <div className="flex flex-col gap-4">
      {/* Category chips: tap to show or hide a whole section; the count shows how many of its figures are on. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {CATEGORIES.map((cat) => {
          const n = catCount(cat.key), total = byCat(cat.key).length;
          return (
            <button key={cat.key} type="button" className="tab" aria-pressed={n > 0} onClick={() => toggleCat(cat.key)} title={n ? `Hide ${cat.label}` : `Show all ${cat.label} charts`}>
              <span aria-hidden>{cat.icon}</span> {cat.label}
              <span className={`ml-0.5 text-[10px] tabular-nums ${n ? "text-accent-ink/80" : "text-muted"}`}>{n}/{total}</span>
            </button>
          );
        })}
        <span className="mx-1 hidden h-5 w-px bg-border sm:inline-block" />
        <button type="button" className="btn-ghost !py-1 !text-xs" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Done" : "Customize…"}</button>
      </div>

      {open && (
        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-bold">Choose your charts</h2>
              <p className="text-xs text-ink-2">{selected.length} of {CHARTS.length} on · saved on this device</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="btn-ghost !py-1 !text-xs" onClick={() => update(CHARTS.map((c) => c.id))}>Show all</button>
              <button type="button" className="btn-ghost !py-1 !text-xs" onClick={() => update([])}>Hide all</button>
              <button type="button" className="btn-ghost !py-1 !text-xs" onClick={() => update(DEFAULT_CHARTS)}>Reset to default</button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((cat) => (
              <fieldset key={cat.key} className="min-w-0">
                <legend className="mb-1.5 flex w-full items-center gap-2 text-sm font-bold">
                  <span aria-hidden>{cat.icon}</span> {cat.label}
                  <button type="button" className="ml-auto text-[11px] font-semibold text-neon hover:underline" onClick={() => only(cat.key)}>only</button>
                  <button type="button" className="text-[11px] font-semibold text-ink-2 hover:underline" onClick={() => toggleCat(cat.key)}>{catCount(cat.key) ? "none" : "all"}</button>
                </legend>
                <ul className="flex flex-col gap-1">
                  {byCat(cat.key).map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-surface-2">
                        <input type="checkbox" className="mt-0.5 accent-[var(--neon)]" checked={chosen.has(c.id)} onChange={() => toggle(c.id)} />
                        <span className="min-w-0"><span className="text-ink">{c.title}</span>{c.sub && <span className="block truncate text-[11px] text-muted">{c.sub}</span>}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ))}
          </div>
        </div>
      )}

      {!sections.length && (
        <div className="card grid place-items-center gap-2 p-10 text-center">
          <p className="text-sm text-ink-2">No charts selected. Tap a category above, or</p>
          <button type="button" className="btn-primary" onClick={() => update(DEFAULT_CHARTS)}>Show the default set</button>
        </div>
      )}

      {sections.map(({ cat, charts }) => (
        <section key={cat.key} className="flex flex-col gap-3">
          <h2 className="section-title mt-1"><span aria-hidden>{cat.icon}</span> {cat.label}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {charts.map((c) => (
              <ChartCard
                key={c.id} title={c.title} sub={subFor(c, data)} className={span[c.size]}
                action={<button type="button" onClick={() => toggle(c.id)} title="Hide this chart" aria-label={`Hide ${c.title}`} className="-mr-1 -mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink">×</button>}
              >
                {render(c.id, data)}
              </ChartCard>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
