import "server-only";
import { DAILY_SHEET, getStore, type SheetData } from "./store";
import { addDays, formatShortDate, todayISO, weekStart } from "./dates";
import { isLoggedRow, rowToRecord } from "./daily";

export type Range = "7d" | "30d" | "90d" | "ytd" | "all";
export const RANGES: { key: Range; label: string }[] = [
  { key: "7d", label: "7 days" }, { key: "30d", label: "30 days" }, { key: "90d", label: "90 days" }, { key: "ytd", label: "This year" }, { key: "all", label: "All" },
];

export interface DayPoint {
  date: string;
  hoursSlept: number | null;
  sleepQuality: number | null;
  fun: number | null;
  productivity: number | null;
  steps: number | null;
  restingHR: number | null;
  high: number | null;
  drinks: number;
  gym: boolean;
  cardio: boolean;
  lifting: boolean;
  cookedMeals: number;
  restaurantMeals: number;
  sleep7: number | null;
  steps7: number | null;
}

export interface WeekPoint {
  week: string;
  label: string;
  days: number;
  gymDays: number;
  drinks: number;
  cooked: number;
  restaurant: number;
  stepsAvg: number | null;
}

export interface Count { name: string; value: number }

export interface GolfRound { date: string; course: string; score: number; par: number; toPar: number; putts: number | null }

export interface Tile { label: string; value: string; sub?: string }

export interface Dashboard {
  range: Range;
  start: string;
  end: string;
  daysLogged: number;
  tiles: Tile[];
  days: DayPoint[];
  weeks: WeekPoint[];
  shirtColors: Count[];
  sky: Count[];
  wakeCities: Count[];
  people: Count[];
  cuisines: Count[];
  restaurants: Count[];
  mealRatings: Count[];
  videoGames: Count[];
  golf: GolfRound[];
  storeKind: "sheets" | "csv";
  missingDays: number;
}

const num = (v: string | undefined): number | null => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
const bool = (v: string | undefined) => v === "TRUE";
const tokens = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function rangeStart(range: Range, end: string, first: string): string {
  switch (range) {
    case "7d": return addDays(end, -6);
    case "30d": return addDays(end, -29);
    case "90d": return addDays(end, -89);
    case "ytd": return `${end.slice(0, 4)}-01-01`;
    default: return first;
  }
}

function avg(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function rolling(points: (number | null)[], n: number): (number | null)[] {
  return points.map((_, i) => avg(points.slice(Math.max(0, i - n + 1), i + 1)));
}

function countTop(values: string[], top = 8): Count[] {
  const m = new Map<string, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, top).map(([name, value]) => ({ name, value }));
}

const fmt1 = (n: number | null) => (n == null ? "—" : (Math.round(n * 10) / 10).toString());
const fmtInt = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));

export async function buildDashboard(range: Range): Promise<Dashboard> {
  const store = getStore();
  const daily = await store.read("journal", DAILY_SHEET);
  const dateCol = daily.header.indexOf("Date");
  const all = daily.rows.filter((r) => r[dateCol] && isLoggedRow(daily, r)).map((r) => rowToRecord(daily, r)).sort((a, b) => (a.Date < b.Date ? -1 : 1));

  const today = todayISO();
  const end = today;
  const first = all[0]?.Date ?? today;
  const start = rangeStart(range, end, first);
  const rows = all.filter((r) => r.Date >= start && r.Date <= end);

  const days: DayPoint[] = rows.map((r) => {
    const cooked = ["Breakfast", "Lunch", "Dinner"].filter((m) => bool(r[`Cooked ${m}?`])).length;
    const restaurant = ["Breakfast", "Lunch", "Dinner"].filter((m) => (r[`Restaurant ${m}`] ?? "").trim() !== "").length;
    return {
      date: r.Date,
      hoursSlept: num(r["Hours slept"]), sleepQuality: num(r["Sleep Quality (1-10)"]),
      fun: num(r["Fun Meter (1-10)"]), productivity: num(r["Productivity (1-10)"]),
      steps: num(r["Steps Taken"]), restingHR: num(r["Resting Heart Rate"]), high: num(r["High Temperature (F)"]),
      drinks: num(r["# of Drinks"]) ?? 0,
      gym: bool(r["Gym?"]), cardio: bool(r["Cardio?"]), lifting: bool(r["Lifting?"]),
      cookedMeals: cooked, restaurantMeals: restaurant, sleep7: null, steps7: null,
    };
  });
  const s7 = rolling(days.map((d) => d.hoursSlept), 7);
  const st7 = rolling(days.map((d) => d.steps), 7);
  days.forEach((d, i) => { d.sleep7 = s7[i]; d.steps7 = st7[i]; });

  // Weekly rollups (weeks start Sunday).
  const wk = new Map<string, DayPoint[]>();
  for (const d of days) { const k = weekStart(d.date); (wk.get(k) ?? wk.set(k, []).get(k)!).push(d); }
  const weeks: WeekPoint[] = [...wk.entries()].sort().map(([week, ds]) => ({
    week, label: formatShortDate(week), days: ds.length,
    gymDays: ds.filter((d) => d.gym).length,
    drinks: ds.reduce((a, d) => a + d.drinks, 0),
    cooked: ds.reduce((a, d) => a + d.cookedMeals, 0),
    restaurant: ds.reduce((a, d) => a + d.restaurantMeals, 0),
    stepsAvg: avg(ds.map((d) => d.steps)),
  }));

  // Streak: consecutive logged days ending today or yesterday.
  const logged = new Set(all.map((r) => r.Date));
  let streak = 0;
  for (let d = logged.has(today) ? today : addDays(today, -1); logged.has(d); d = addDays(d, -1)) streak++;
  let missingDays = 0;
  for (let d = start; d < today; d = addDays(d, 1)) if (d >= first && !logged.has(d)) missingDays++;

  const gymDays = days.filter((d) => d.gym).length;
  const drinksTotal = days.reduce((a, d) => a + d.drinks, 0);
  const tiles: Tile[] = [
    { label: "Days logged", value: String(days.length), sub: streak ? `${streak}-day streak` : "streak broken" },
    { label: "Sleep", value: `${fmt1(avg(days.map((d) => d.hoursSlept)))} h`, sub: `quality ${fmt1(avg(days.map((d) => d.sleepQuality)))}/10` },
    { label: "Fun meter", value: `${fmt1(avg(days.map((d) => d.fun)))}`, sub: "avg / 10" },
    { label: "Productivity", value: `${fmt1(avg(days.map((d) => d.productivity)))}`, sub: "avg / 10 on work days" },
    { label: "Steps", value: fmtInt(avg(days.map((d) => d.steps))), sub: "avg per day" },
    { label: "Gym days", value: String(gymDays), sub: days.length ? `${Math.round((gymDays / days.length) * 100)}% of days` : undefined },
    { label: "Drinks", value: String(drinksTotal), sub: `${days.filter((d) => d.drinks > 0).length} drinking days` },
    { label: "Ate out", value: String(days.reduce((a, d) => a + d.restaurantMeals, 0)), sub: `meals · cooked ${days.reduce((a, d) => a + d.cookedMeals, 0)}` },
  ];

  const mealRatings: Count[] = ["Breakfast", "Lunch", "Dinner", "Dessert"].map((m) => ({ name: m, value: Math.round((avg(rows.map((r) => num(r[`${m} Rating`]))) ?? 0) * 10) / 10 })).filter((c) => c.value > 0);

  const restaurantSheet = await safeRead(store, "Restaurant");
  const restRows = restaurantSheet.rows.map((r) => rowToRecord(restaurantSheet, r)).filter((r) => r.Date >= start && r.Date <= end);

  const golfSheet = await safeRead(store, "Golf");
  const golf: GolfRound[] = golfSheet.rows.map((r) => rowToRecord(golfSheet, r))
    .filter((r) => r.Date >= start && r.Date <= end && num(r.Score) != null && num(r.Par) != null)
    .map((r) => ({ date: r.Date, course: r.Course, score: num(r.Score)!, par: num(r.Par)!, toPar: num(r.Score)! - num(r.Par)!, putts: num(r.Putts) }));

  return {
    range, start, end, daysLogged: days.length, tiles, days, weeks,
    shirtColors: countTop(rows.map((r) => r["Shirt Color Short"]), 8),
    sky: countTop(rows.map((r) => r["Sky"]), 8),
    wakeCities: countTop(rows.map((r) => r["Wake Up City"]), 8),
    people: countTop(rows.flatMap((r) => tokens(r["People seen in person"])), 10),
    cuisines: countTop(restRows.map((r) => r["Restaurant Type"]), 8),
    restaurants: countTop(restRows.map((r) => r["Restaurant"]), 8),
    mealRatings,
    videoGames: countTop(rows.flatMap((r) => tokens(r["Video games played"])), 8),
    golf, storeKind: store.kind, missingDays,
  };
}

async function safeRead(store: ReturnType<typeof getStore>, sheet: string): Promise<SheetData> {
  try { return await store.read("journal", sheet); } catch { return { book: "journal", name: sheet, header: [], rows: [] }; }
}
