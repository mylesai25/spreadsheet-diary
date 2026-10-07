import type { Metadata } from "next";
import Link from "next/link";
import { buildFriends, type FriendProfile } from "@/lib/friends";
import { RANGES, type Range } from "@/lib/metrics";
import { formatShortDate } from "@/lib/dates";
import { ChartCard, RankBars, ScoreLine, Tile, VerticalBars } from "@/components/charts/Charts";
import { YearCalendar } from "@/components/charts/Insights";
import { FriendPicker } from "@/components/FriendPicker";
import { ShowMoreRows } from "@/components/ShowMore";

export const metadata: Metadata = { title: "Friends" };
export const dynamic = "force-dynamic";

/** Leaderboard rows shown before the "show more" fold. */
const TOP = 12;

const SLOT_ICON: Record<string, string> = { Hat: "🧢", Shirt: "👕", Pants: "👖", Socks: "🧦", Shoes: "👟", Jacket: "🧥" };

export default async function FriendsPage({ searchParams }: { searchParams: Promise<{ range?: string; who?: string }> }) {
  const { range: q, who } = await searchParams;
  const range: Range = RANGES.some((r) => r.key === q) ? (q as Range) : "ytd";
  const d = await buildFriends(range);
  const names = d.friends.map((f) => f.name);
  const selected = d.friends.find((f) => f.name.toLowerCase() === (who ?? "").toLowerCase()) ?? d.friends[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Friends</h1>
          <p className="text-sm text-ink-2">{formatShortDate(d.start)} – {formatShortDate(d.end)} · {d.daysLogged} days · {d.friends.length} people seen in person{d.storeKind === "csv" && " · local CSV mode"}</p>
        </div>
        <div className="seg overflow-x-auto [scrollbar-width:none]">
          {RANGES.map((r) => (
            <Link key={r.key} href={`/friends?range=${r.key}${selected ? `&who=${encodeURIComponent(selected.name)}` : ""}`} aria-pressed={r.key === range} role="button">{r.label}</Link>
          ))}
        </div>
      </div>

      {d.friends.length === 0 ? (
        <div className="card p-6 text-sm text-ink-2">Nobody logged under “People seen in person” in this range.</div>
      ) : (
        <>
          <ChartCard title="Leaderboard" sub="Everyone you saw in person, most days first. Pick a row for the full profile.">
            <div className="-mx-4 overflow-x-auto">
              <table className="table-fig min-w-[52rem]">
                <thead>
                  <tr><th>#</th><th>Friend</th><th className="text-right">Days</th><th className="text-right">Share</th><th className="text-right">Fun</th><th className="text-right">Lift</th><th>Top sport</th><th>Top sky</th><th>Usual day</th><th className="text-right">Drinks/day</th><th className="text-right">Golf</th><th className="text-right">Meals out</th><th className="text-right">Last seen</th></tr>
                </thead>
                <tbody>
                  {d.friends.slice(0, TOP).map((f, i) => <Row key={f.name} f={f} i={i} range={range} selected={f.name === selected.name} />)}
                </tbody>
                {d.friends.length > TOP && (
                  <ShowMoreRows count={d.friends.length - TOP} colSpan={13}>
                    <tbody>
                      {d.friends.slice(TOP).map((f, i) => <Row key={f.name} f={f} i={TOP + i} range={range} selected={f.name === selected.name} />)}
                    </tbody>
                  </ShowMoreRows>
                )}
              </table>
            </div>
          </ChartCard>

          <div id="profile" className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">{selected.name}</h2>
            <FriendPicker names={names} value={selected.name} range={range} />
          </div>
          <Profile f={selected} year={d.year} />
        </>
      )}
    </div>
  );
}

function Row({ f, i, range, selected }: { f: FriendProfile; i: number; range: Range; selected: boolean }) {
  return (
    <tr className={selected ? "bg-accent-soft/60" : ""}>
      <td className="text-muted">{i + 1}</td>
      <td><Link href={`/friends?range=${range}&who=${encodeURIComponent(f.name)}#profile`} className="font-bold text-neon underline-offset-2 hover:underline">{f.name}</Link></td>
      <td className="text-right font-bold tabular-nums">{f.days}</td>
      <td className="text-right tabular-nums text-ink-2">{f.share}%</td>
      <td className="text-right tabular-nums">{f.avgFun ?? "—"}</td>
      <td className={`text-right tabular-nums ${f.funLift == null ? "text-muted" : f.funLift > 0 ? "text-neon" : f.funLift < 0 ? "text-danger" : "text-muted"}`}>{f.funLift == null ? "—" : `${f.funLift > 0 ? "+" : ""}${f.funLift}`}</td>
      <td className="text-ink-2">{f.topSport ?? "—"}</td>
      <td className="text-ink-2">{f.topSky ?? "—"}</td>
      <td className="text-ink-2">{f.topDay ?? "—"}</td>
      <td className="text-right tabular-nums text-ink-2">{f.avgDrinks ?? 0}</td>
      <td className="text-right tabular-nums text-ink-2">{f.golf.rounds ? `${f.golf.rounds}${f.golf.wins ? ` (${f.golf.wins}W)` : ""}` : "—"}</td>
      <td className="text-right tabular-nums text-ink-2">{f.mealsOut.count || "—"}</td>
      <td className="text-right tabular-nums text-ink-2">{f.daysSince === 0 ? "today" : `${f.daysSince}d ago`}</td>
    </tr>
  );
}

function Profile({ f, year }: { f: FriendProfile; year: string }) {
  const seen: Record<string, string> = Object.fromEntries(f.seenDates.map((d) => [d, "Together"]));
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {f.tiles.map((t) => <Tile key={t.label} {...t} />)}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Days together by month" sub={`Longest streak ${f.longestStreak} day${f.longestStreak === 1 ? "" : "s"} in a row`} className="lg:col-span-2">
          <VerticalBars data={f.byMonth} unit="Days" height={220} />
        </ChartCard>
        <ChartCard title="Day of the week" sub={f.topDay ? `Mostly ${f.topDay}s` : "Days together"}><RankBars data={f.weekdays} height={220} /></ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ChartCard title="Sports we play" sub="Days with a sport logged"><RankBars data={f.sports} /></ChartCard>
        <ChartCard title="Sky" sub="Weather on days together"><RankBars data={f.skies} /></ChartCard>
        <ChartCard title="Where we were" sub="Cities visited that day"><RankBars data={f.cities} /></ChartCard>
        <ChartCard title="Also there" sub="People seen the same days"><RankBars data={f.companions} /></ChartCard>
        <ChartCard title="Restaurants together" sub={`From the Restaurant sheet · ${f.mealsOut.count} meal${f.mealsOut.count === 1 ? "" : "s"}${f.foodRating != null ? ` · food ${f.foodRating}/10` : ""}`}><RankBars data={f.restaurants} unit="Meals" /></ChartCard>
        <ChartCard title="Cuisines together" sub="Restaurant type"><RankBars data={f.restaurantTypes} unit="Meals" /></ChartCard>
        <ChartCard title="Video games" sub="Played on days together"><RankBars data={f.videoGames} /></ChartCard>
        <ChartCard title={`What I wear around ${f.name}`} sub="Most common piece per slot">
          {f.fit.length === 0 ? <p className="text-sm text-muted">No outfit data.</p> : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {f.fit.map((p) => (
                <li key={p.slot} className="flex items-baseline gap-2">
                  <span aria-hidden>{SLOT_ICON[p.slot]}</span>
                  <span className="min-w-0 flex-1 truncate"><span className="text-neon">{p.color}</span> {p.type}</span>
                  <span className="text-xs text-muted">{p.days}d</span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
        <ChartCard title="Day in numbers" sub="Averages on days together">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-ink-2">Productivity</dt><dd className="font-bold tabular-nums">{f.avgProductivity ?? "—"}<span className="font-normal text-muted"> / 10</span></dd>
            <dt className="text-ink-2">Steps</dt><dd className="font-bold tabular-nums">{f.avgSteps == null ? "—" : Math.round(f.avgSteps).toLocaleString("en-US")}</dd>
            <dt className="text-ink-2">Calories</dt><dd className="font-bold tabular-nums">{f.avgCalories == null ? "—" : Math.round(f.avgCalories).toLocaleString("en-US")}</dd>
            <dt className="text-ink-2">Went outside</dt><dd className="font-bold tabular-nums">{f.outsidePct}%</dd>
            <dt className="text-ink-2">Gym</dt><dd className="font-bold tabular-nums">{f.gymPct}%</dd>
            <dt className="text-ink-2">Naps</dt><dd className="font-bold tabular-nums">{f.avgNaps ?? 0}<span className="font-normal text-muted"> / day</span></dd>
            <dt className="text-ink-2">Meat · fruit · veg</dt><dd className="truncate">{[f.food.meat, f.food.fruit, f.food.veg].map((x) => x ?? "—").join(" · ")}</dd>
            <dt className="text-ink-2">Mini golf</dt><dd className="tabular-nums">{f.miniGolf.rounds ? `${f.miniGolf.rounds} rounds · ${f.miniGolf.wins} wins` : "—"}</dd>
            <dt className="text-ink-2">Disc golf</dt><dd className="tabular-nums">{f.discGolf.rounds ? `${f.discGolf.rounds} rounds · ${f.discGolf.wins} wins` : "—"}</dd>
            <dt className="text-ink-2">Climbing</dt><dd className="tabular-nums">{f.climbs ? `${f.climbs} sessions` : "—"}</dd>
          </dl>
        </ChartCard>
      </div>

      {f.golf.rounds > 0 && <GolfSection f={f} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <ChartCard title={`${year} together`} sub="Every day this year you were in the same place" className="lg:col-span-3">
          <YearCalendar views={[{ key: "seen", title: f.name, kind: "color", values: seen }]} year={year} palette={{ Together: "#4ade80" }} emptyLabel="apart" />
        </ChartCard>
        <ChartCard title="By year" sub="Days together, all journals">
          <RankBars data={f.byYear.map((y) => ({ name: y.year, value: y.days }))} height={Math.max(120, f.byYear.length * 34 + 16)} />
        </ChartCard>
      </div>
    </>
  );
}

const hrs = (m: number) => `${Math.round(m / 6) / 10} h`;

/** The notebook's "Friendship Golf" block: rounds, scores, putts, GIR/FIR, hazards, courses, and the 18-hole score line. */
function GolfSection({ f }: { f: FriendProfile }) {
  const g = f.golf;
  const tiles = [
    { label: "Rounds together", value: String(g.rounds), sub: `${g.wins} win${g.wins === 1 ? "" : "s"} · ${hrs(g.minutes)} on the course` },
    { label: "18-hole score", value: g.score18 == null ? "—" : String(g.score18), sub: g.best18 != null ? `best ${g.best18}${g.score9 != null ? ` · 9-hole avg ${g.score9}` : ""}` : g.score9 != null ? `9-hole avg ${g.score9}` : "solo formats only" },
    { label: "Putts", value: g.putts18 == null ? (g.putts9 == null ? "—" : String(g.putts9)) : String(g.putts18), sub: g.putts18 != null ? `per 18 holes${g.putts9 != null ? ` · ${g.putts9} per 9` : ""}` : "per 9 holes" },
    { label: "GIR · FIR", value: g.gir == null && g.fir == null ? "—" : `${g.gir ?? "—"}% · ${g.fir ?? "—"}%`, sub: "greens · fairways in regulation" },
    { label: "Hazards", value: `${g.water} · ${g.bunkers}`, sub: "water balls · bunker shots" },
    { label: "Usual setup", value: g.teeBox ?? "—", sub: `${g.teeBox ? "tees" : ""}${g.cart ? ` · cart ${g.cart.toLowerCase()}` : ""}${g.topCourse ? ` · ${g.topCourse}` : ""}` },
  ];
  return (
    <>
      <h2 className="section-title mt-2">Golf with {f.name}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => <Tile key={t.label} {...t} />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title={`My 18-Hole Scores with ${f.name}`} sub="Solo formats (Regular / Wolf), in order played" className="lg:col-span-2"><ScoreLine data={g.scores} emptyText={g.scores.length ? "Only one 18-hole round together so far" : "No 18-hole rounds together"} /></ChartCard>
        <ChartCard title="Courses" sub="Rounds per course"><RankBars data={g.courses} unit="Rounds" /></ChartCard>
        <ChartCard title="Formats" sub="Games played"><RankBars data={g.games} unit="Rounds" /></ChartCard>
        {g.scramble && (
          <ChartCard title={`Scramble with ${f.name}`} sub={`${g.scramble.rounds} round${g.scramble.rounds === 1 ? "" : "s"} · ${hrs(g.scramble.minutes)}`} className="lg:col-span-2">
            <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-7">
              {[["Best 9", g.scramble.best9 ?? "—"], ["Eagles", g.scramble.eagles], ["Birdies", g.scramble.birdies], ["Pars", g.scramble.pars], ["Bogeys", g.scramble.bogeys], ["Doubles", g.scramble.doubles], ["Triple+", g.scramble.triples]].map(([k, v]) => (
                <div key={String(k)}><div className="text-2xl font-bold tabular-nums">{v}</div><div className="text-xs text-ink-2">{k}</div></div>
              ))}
            </div>
          </ChartCard>
        )}
      </div>
    </>
  );
}
