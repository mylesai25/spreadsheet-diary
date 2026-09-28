import "server-only";
import { DAILY_SHEET, getStore, type SheetData } from "./store";
import type { Book } from "./store/types";
import { isLoggedRow, rowToRecord } from "./daily";
import { addDays, todayISO } from "./dates";
import type { Count, Range, Tile } from "./metrics";

/**
 * Friend stats: everything the diary knows about the days spent with each person
 * (the friend_stats.csv columns, plus activity sheets, streaks, lift and companions).
 */

type Rec = Record<string, string>;

export interface FitPiece { slot: string; type: string; color: string; days: number }
export interface YearCount { year: string; days: number }

export interface FriendProfile {
  name: string;
  days: number;
  /** Share of logged days in the range. */
  share: number;
  firstSeen: string;
  lastSeen: string;
  longestStreak: number;
  /** Days since last seen (0 = today). */
  daysSince: number;
  avgFun: number | null;
  /** Average fun on days together minus days apart, in the same range. */
  funLift: number | null;
  avgProductivity: number | null;
  avgSleep: number | null;
  totalSleep: number;
  avgNaps: number | null;
  totalNaps: number;
  avgBattery: number | null;
  avgDrinks: number | null;
  totalDrinks: number;
  drinkDayPct: number;
  avgSteps: number | null;
  avgCalories: number | null;
  outsidePct: number;
  gymPct: number;
  topSport: string | null;
  topSky: string | null;
  topMonth: string | null;
  topDay: string | null;
  sports: Count[];
  skies: Count[];
  weekdays: Count[];
  byMonth: Count[];
  cities: Count[];
  companions: Count[];
  restaurants: Count[];
  videoGames: Count[];
  fit: FitPiece[];
  food: { meat: string | null; fruit: string | null; veg: string | null };
  /** ISO dates seen this calendar year (for the calendar). */
  seenDates: string[];
  golf: { rounds: number; wins: number; topCourse: string | null };
  miniGolf: { rounds: number; wins: number };
  discGolf: { rounds: number; wins: number };
  climbs: number;
  mealsOut: { count: number; topSpot: string | null };
  byYear: YearCount[];
  tiles: Tile[];
}

export interface FriendsData {
  range: Range; start: string; end: string; year: string; daysLogged: number;
  friends: FriendProfile[];
  storeKind: "sheets" | "csv";
}

const num = (v?: string) => { if (v == null || v.trim() === "") return null; const n = Number(v.replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
const tokens = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const has = (list: string | undefined, name: string) => tokens(list).some((t) => t.toLowerCase() === name.toLowerCase());

function countTop(values: string[], top = 10): Count[] {
  const m = new Map<string, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, top).map(([name, value]) => ({ name, value }));
}
const mode = (values: string[]) => countTop(values, 1)[0]?.name ?? null;

function rangeStart(range: Range, end: string, first: string): string {
  switch (range) {
    case "7d": return addDays(end, -6);
    case "30d": return addDays(end, -29);
    case "90d": return addDays(end, -89);
    case "ytd": return `${end.slice(0, 4)}-01-01`;
    default: return first;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weekday = (iso: string) => DAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

async function safeRead(book: Book, sheet: string): Promise<SheetData> {
  try { return await getStore().read(book, sheet); } catch { return { book, name: sheet, header: [], rows: [] }; }
}
const records = (d: SheetData) => d.rows.map((r) => rowToRecord(d, r));

function longestStreak(dates: string[]): number {
  let best = 0, run = 0, prev: string | null = null;
  for (const d of dates) { run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}

const SLOTS: { slot: string; type: string; color: string; gate?: string }[] = [
  { slot: "Hat", type: "Hat Type", color: "Hat Color Primary", gate: "Hat?" },
  { slot: "Shirt", type: "Shirt Type", color: "Shirt Color Primary" },
  { slot: "Pants", type: "Pants Type", color: "Pants Color Primary" },
  { slot: "Socks", type: "Sock Design", color: "Sock Color Primary" },
  { slot: "Shoes", type: "Shoe Type", color: "Shoe Color Primary" },
  { slot: "Jacket", type: "Jacket Type", color: "Jacket Color Primary", gate: "Jacket?" },
];

export async function buildFriends(range: Range): Promise<FriendsData> {
  const store = getStore();
  const daily = await store.read("journal", DAILY_SHEET);
  const dateCol = daily.header.indexOf("Date");
  const all = daily.rows.filter((r) => r[dateCol] && isLoggedRow(daily, r)).map((r) => rowToRecord(daily, r)).sort((a, b) => (a.Date < b.Date ? -1 : 1));
  const end = todayISO();
  const first = all[0]?.Date ?? end;
  const start = rangeStart(range, end, first);
  const rows = all.filter((r) => r.Date >= start && r.Date <= end);
  const year = end.slice(0, 4);
  const yearRows = all.filter((r) => r.Date.startsWith(year));
  const inRange = (r: Rec) => r.Date >= start && r.Date <= end;

  // Activity sheets (this year's book) and prior-year journals for the all-time view.
  const [golf, mini, disc, climb, rest] = await Promise.all([safeRead("journal", "Golf"), safeRead("journal", "Mini-Golf"), safeRead("journal", "Disc Golf"), safeRead("journal", "Climbing"), safeRead("journal", "Restaurant")]);
  const golfR = records(golf).filter(inRange), miniR = records(mini).filter(inRange), discR = records(disc).filter(inRange), climbR = records(climb).filter(inRange), restR = records(rest).filter(inRange);
  const priorYears = [+year - 1, +year - 2];
  const priorRows = await Promise.all(priorYears.map(async (y) => { const d = await safeRead(`journal-${y}`, DAILY_SHEET); const dc = d.header.indexOf("Date"); return d.rows.filter((r) => r[dc] && isLoggedRow(d, r)).map((r) => rowToRecord(d, r)); }));

  const byPerson = new Map<string, Rec[]>();
  for (const r of rows) for (const p of tokens(r["People seen in person"])) (byPerson.get(p) ?? byPerson.set(p, []).get(p)!).push(r);
  const monthsInRange = [...new Set(rows.map((r) => r.Date.slice(0, 7)))].sort();

  const friends: FriendProfile[] = [...byPerson.entries()].map(([name, rs]) => {
    const apart = rows.filter((r) => !has(r["People seen in person"], name));
    const dates = rs.map((r) => r.Date);
    const avgFun = avg(rs.map((r) => num(r["Fun Meter (1-10)"])));
    const funApart = avg(apart.map((r) => num(r["Fun Meter (1-10)"])));
    const drinks = rs.map((r) => num(r["# of Drinks"]) ?? 0);
    const sleep = rs.map((r) => num(r["Hours slept"]));
    const naps = rs.map((r) => num(r["Naps taken"]) ?? 0);
    const sports = countTop(rs.flatMap((r) => tokens(r["Sports Played"])), 8);
    const skies = countTop(rs.map((r) => r.Sky ?? ""), 8);
    const weekdays = DAYS.map((d) => ({ name: d.slice(0, 3), value: dates.filter((x) => weekday(x) === d).length }));
    const months = countTop(dates.map((d) => MONTH_FULL[+d.slice(5, 7) - 1]), 12);
    const byMonth = (monthsInRange.length > 1 ? monthsInRange : [year + "-" + end.slice(5, 7)]).map((ym) => ({ name: `${MONTHS[+ym.slice(5, 7) - 1]}${monthsInRange.some((m) => m.slice(0, 4) !== ym.slice(0, 4)) ? ` ’${ym.slice(2, 4)}` : ""}`, value: dates.filter((d) => d.startsWith(ym)).length }));
    const fit: FitPiece[] = SLOTS.flatMap((s) => {
      const worn = rs.filter((r) => (!s.gate || r[s.gate] === "TRUE") && r[s.type]);
      const top = countTop(worn.map((r) => `${r[s.color] ?? ""}|${r[s.type]}`), 1)[0];
      if (!top) return [];
      const [color, type] = top.name.split("|");
      return [{ slot: s.slot, type, color, days: top.value }];
    });
    const golfMine = golfR.filter((r) => has(r.Players, name) || has(r["Scramble Team"], name) || has(r["Cart Partner"], name));
    const miniMine = miniR.filter((r) => has(r.Players, name)), discMine = discR.filter((r) => has(r.Players, name));
    const climbMine = climbR.filter((r) => has(r.Climbers, name));
    const restMine = restR.filter((r) => has(r.Group, name));
    const byYear: YearCount[] = [{ year, days: yearRows.filter((r) => has(r["People seen in person"], name)).length },
      ...priorYears.map((y, i) => ({ year: String(y), days: priorRows[i].filter((r) => has(r["People seen in person"], name)).length }))].filter((y) => y.days > 0 || y.year === year);
    const totalDrinks = drinks.reduce((a, b) => a + b, 0);
    const funLift = avgFun != null && funApart != null ? r1(avgFun - funApart) : null;
    const p: FriendProfile = {
      name, days: rs.length, share: pct(rs.length, rows.length),
      firstSeen: dates[0], lastSeen: dates[dates.length - 1], longestStreak: longestStreak(dates), daysSince: daysBetween(dates[dates.length - 1], end),
      avgFun: r1(avgFun), funLift, avgProductivity: r1(avg(rs.map((r) => num(r["Productivity (1-10)"])))),
      avgSleep: r1(avg(sleep)), totalSleep: Math.round(sleep.reduce<number>((a, b) => a + (b ?? 0), 0)),
      avgNaps: r1(avg(naps)), totalNaps: naps.reduce((a, b) => a + b, 0),
      avgBattery: r1(avg(rs.map((r) => num(r["Morning Phone Battery (%)"])))),
      avgDrinks: r1(avg(drinks)), totalDrinks, drinkDayPct: pct(rs.filter((r) => r["Alcohol?"] === "TRUE").length, rs.length),
      avgSteps: r1(avg(rs.map((r) => num(r["Steps Taken"])))), avgCalories: r1(avg(rs.map((r) => num(r["Calories Burned"])))),
      outsidePct: pct(rs.filter((r) => r["Went Outside?"] === "TRUE").length, rs.length), gymPct: pct(rs.filter((r) => r["Gym?"] === "TRUE").length, rs.length),
      topSport: sports[0]?.name ?? null, topSky: skies[0]?.name ?? null, topMonth: months[0]?.name ?? null, topDay: mode(dates.map(weekday)),
      sports, skies, weekdays, byMonth,
      cities: countTop(rs.flatMap((r) => tokens(r["Cities Visited"])), 8),
      companions: countTop(rs.flatMap((r) => tokens(r["People seen in person"]).filter((t) => t !== name)), 8),
      restaurants: countTop(rs.flatMap((r) => [r["Restaurant Breakfast"], r["Restaurant Lunch"], r["Restaurant Dinner"]].flatMap((v) => tokens(v))), 8),
      videoGames: countTop(rs.flatMap((r) => tokens(r["Video games played"])), 6),
      fit, food: { meat: mode(rs.flatMap((r) => tokens(r["Meat Eaten"]))), fruit: mode(rs.flatMap((r) => tokens(r["Fruit Eaten"]))), veg: mode(rs.flatMap((r) => tokens(r["Vegetables Eaten"]))) },
      seenDates: yearRows.filter((r) => has(r["People seen in person"], name)).map((r) => r.Date),
      golf: { rounds: golfMine.length, wins: golfMine.filter((r) => has(r["Game Winner"], name)).length, topCourse: mode(golfMine.map((r) => r.Course ?? "")) },
      miniGolf: { rounds: miniMine.length, wins: miniMine.filter((r) => has(r.Winner, name)).length },
      discGolf: { rounds: discMine.length, wins: discMine.filter((r) => has(r.Winner, name)).length },
      climbs: climbMine.length,
      mealsOut: { count: restMine.length, topSpot: mode(restMine.map((r) => r.Restaurant ?? "")) },
      byYear,
      tiles: [],
    };
    p.tiles = [
      { label: "Days together", value: String(p.days), sub: `${p.share}% of logged days · streak ${p.longestStreak}` },
      { label: "Fun meter", value: p.avgFun == null ? "—" : `${p.avgFun}`, sub: funLift == null ? "avg / 10" : `${funLift >= 0 ? "+" : ""}${funLift} vs. days apart` },
      { label: "Drinks", value: String(totalDrinks), sub: `${p.avgDrinks ?? 0} per day · drinking on ${p.drinkDayPct}% of days` },
      { label: "Last seen", value: p.daysSince === 0 ? "Today" : p.daysSince === 1 ? "Yesterday" : `${p.daysSince}d ago`, sub: `first ${p.firstSeen.slice(5).replace("-", "/")} · last ${p.lastSeen.slice(5).replace("-", "/")}` },
      { label: "Sleep", value: p.avgSleep == null ? "—" : `${p.avgSleep} h`, sub: `${p.totalSleep} h total · ${p.totalNaps} naps` },
      { label: "Phone battery", value: p.avgBattery == null ? "—" : `${Math.round(p.avgBattery)}%`, sub: "average in the morning" },
      { label: "Golf together", value: String(p.golf.rounds), sub: p.golf.rounds ? `${p.golf.wins} win${p.golf.wins === 1 ? "" : "s"}${p.golf.topCourse ? ` · ${p.golf.topCourse}` : ""}` : "no rounds in range" },
      { label: "Meals out", value: String(p.mealsOut.count), sub: p.mealsOut.topSpot ?? "no restaurant entries" },
    ];
    return p;
  }).sort((a, b) => b.days - a.days || a.name.localeCompare(b.name));

  return { range, start, end, year, daysLogged: rows.length, friends, storeKind: store.kind };
}
