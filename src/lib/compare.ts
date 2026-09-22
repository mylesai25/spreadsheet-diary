import "server-only";
import { DAILY_SHEET, getStore, type Book, type SheetData } from "./store";
import { isLoggedRow, rowToRecord } from "./daily";
import { todayISO } from "./dates";

export const PRIOR_YEARS = [2025, 2024];
export type Period = "same" | "full";

export interface Metric {
  key: string;
  label: string;
  /** "avg" metrics compare directly; "total" metrics are also shown per logged day when periods differ. */
  kind: "avg" | "total" | "pct" | "count";
  a: number | null;
  b: number | null;
  unit?: string;
  /** Whether a higher number is the good direction (null = neutral). */
  higherIsBetter: boolean | null;
  decimals?: number;
}

export interface MonthPoint { month: string; a: number | null; b: number | null }
export interface CumPoint { doy: number; a: number | null; b: number | null }
export interface RankRow { name: string; a: number; b: number }
export interface RankCompare { title: string; sub: string; rows: RankRow[] }

export interface Comparison {
  yearA: number; yearB: number; period: Period;
  cutoff: string; // "MM-DD" end of the compared window
  daysA: number; daysB: number;
  metrics: Metric[];
  monthly: { key: string; title: string; unit?: string; data: MonthPoint[] }[];
  cumulative: { key: string; title: string; unit?: string; data: CumPoint[] }[];
  ranks: RankCompare[];
  years: number[];
}

type Rec = Record<string, string>;
const num = (v?: string) => { if (v == null || v.trim() === "") return null; const n = Number(v.replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
const bool = (v?: string) => v === "TRUE";
const tokens = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((p, c) => p + c, 0) / v.length : null; };
const sum = (xs: (number | null)[]) => xs.reduce<number>((p, c) => p + (c ?? 0), 0);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const doy = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1; };

/** Column aliases so 2025/2024 sheets map onto 2026 names. */
const ALIASES: Record<string, string[]> = {
  "Shirt Company": ["Shirt Brand"], "Sock Company": ["Sock Brand"], "Hat Company": ["Hat Brand"], "Jacket Company": ["Jacket Brand"],
};
function get(r: Rec, key: string): string | undefined {
  if (r[key] !== undefined && r[key] !== "") return r[key];
  for (const a of ALIASES[key] ?? []) if (r[a]) return r[a];
  return r[key];
}

async function loadYear(year: number, current: number): Promise<Rec[]> {
  const book: Book = year === current ? "journal" : `journal-${year}`;
  let data: SheetData;
  try { data = await getStore().read(book, DAILY_SHEET); } catch { return []; }
  const dc = data.header.indexOf("Date");
  return data.rows.filter((r) => r[dc] && isLoggedRow(data, r)).map((r) => rowToRecord(data, r)).sort((x, y) => (x.Date < y.Date ? -1 : 1));
}

async function loadSheet(year: number, current: number, names: string[]): Promise<Rec[]> {
  const book: Book = year === current ? "journal" : `journal-${year}`;
  for (const n of names) {
    try { const d = await getStore().read(book, n); if (d.header.length) return d.rows.map((r) => rowToRecord(d, r)); } catch { /* try next name */ }
  }
  return [];
}

export async function buildComparison(yearB: number, period: Period): Promise<Comparison> {
  const today = todayISO();
  const yearA = +today.slice(0, 4);
  const [allA, allB] = await Promise.all([loadYear(yearA, yearA), loadYear(yearB, yearA)]);
  const cutoff = period === "same" ? (allA.at(-1)?.Date ?? today).slice(5) : "12-31";
  const A = allA.filter((r) => r.Date.slice(5) <= cutoff);
  const B = allB.filter((r) => r.Date.slice(5) <= cutoff);
  const [restA, restB, golfA, golfB] = await Promise.all([
    loadSheet(yearA, yearA, ["Restaurant", "Restuarant"]), loadSheet(yearB, yearA, ["Restaurant", "Restuarant"]),
    loadSheet(yearA, yearA, ["Golf"]), loadSheet(yearB, yearA, ["Golf"]),
  ]);
  const inWin = (r: Rec) => (r.Date ?? "").slice(5) <= cutoff && r.Date;
  const rA = restA.filter(inWin), rB = restB.filter(inWin), gA = golfA.filter(inWin), gB = golfB.filter(inWin);

  // ── Headline metrics ──
  const m = (key: string, label: string, kind: Metric["kind"], f: (rows: Rec[]) => number | null, higherIsBetter: boolean | null, unit?: string, decimals = 1): Metric =>
    ({ key, label, kind, a: f(A), b: f(B), higherIsBetter, unit, decimals });
  const pctDays = (k: string) => (rows: Rec[]) => rows.length ? (rows.filter((r) => bool(get(r, k))).length / rows.length) * 100 : null;
  const full18 = (rows: Rec[]) => rows.filter((r) => num(r["Holes Played"]) === 18 && (!r.Game || /^(Regular|Wolf)$/i.test(r.Game)));
  const allMetrics: Metric[] = [
    m("days", "Days logged", "count", (rows) => rows.length, null, undefined, 0),
    m("sleep", "Sleep", "avg", (rows) => avg(rows.map((r) => num(get(r, "Hours slept")))), true, "h"),
    m("fun", "Fun meter", "avg", (rows) => avg(rows.map((r) => num(get(r, "Fun Meter (1-10)")))), true, "/10"),
    m("steps", "Steps / day", "avg", (rows) => avg(rows.map((r) => num(get(r, "Steps Taken")))), true, undefined, 0),
    m("miles", "Miles walked", "total", (rows) => sum(rows.map((r) => num(get(r, "Distance Traveled (miles)")))), true, "mi", 0),
    m("gym", "Gym days", "pct", pctDays("Gym?"), true, "%", 0),
    m("outside", "Went outside", "pct", pctDays("Went Outside?"), true, "%", 0),
    m("cooked", "Cooked dinner", "pct", pctDays("Cooked Dinner?"), true, "%", 0),
    m("ateout", "Restaurant meals", "total", (rows) => rows.reduce((p, r) => p + ["Breakfast", "Lunch", "Dinner"].filter((x) => (get(r, `Restaurant ${x}`) ?? "").trim() !== "").length, 0), null, undefined, 0),
    m("drinks", "Drinks", "total", (rows) => sum(rows.map((r) => num(get(r, "# of Drinks")))), false, undefined, 0),
    m("alcdays", "Drinking days", "pct", pctDays("Alcohol?"), false, "%", 0),
    m("naps", "Naps", "total", (rows) => sum(rows.map((r) => num(get(r, "Naps taken")))), null, undefined, 0),
    m("sick", "Sick days", "total", (rows) => rows.filter((r) => bool(get(r, "Sick?"))).length, false, undefined, 0),
    m("rhr", "Resting HR", "avg", (rows) => avg(rows.map((r) => num(get(r, "Resting Heart Rate")))), false, "bpm", 0),
    m("cal", "Calories / day", "avg", (rows) => avg(rows.map((r) => num(get(r, "Calories Burned")))), true, undefined, 0),
    m("battery", "Morning battery", "avg", (rows) => avg(rows.map((r) => num(get(r, "Morning Phone Battery (%)")))), true, "%", 0),
    m("people", "People seen", "count", (rows) => new Set(rows.flatMap((r) => tokens(get(r, "People seen in person")))).size, true, "unique", 0),
    m("social", "Days with company", "pct", (rows) => rows.length ? (rows.filter((r) => tokens(get(r, "People seen in person")).length > 0).length / rows.length) * 100 : null, true, "%", 0),
    m("cities", "Cities visited", "count", (rows) => new Set(rows.flatMap((r) => tokens(get(r, "Cities Visited")))).size, true, "unique", 0),
    m("states", "States visited", "count", (rows) => new Set(rows.flatMap((r) => tokens(get(r, "States Visited")))).size, true, "unique", 0),
    m("tv", "TV at meals", "total", (rows) => sum(rows.map((r) => num(get(r, "Times watched TV")))), null, "meals", 0),
    m("games", "Video-game days", "pct", (rows) => rows.length ? (rows.filter((r) => tokens(get(r, "Video games played")).length > 0).length / rows.length) * 100 : null, null, "%", 0),
    { key: "restaurants", label: "Restaurants visited", kind: "count", a: new Set(rA.map((r) => r.Restaurant)).size, b: new Set(rB.map((r) => r.Restaurant)).size, higherIsBetter: null, unit: "unique", decimals: 0 },
    { key: "rounds", label: "Golf rounds", kind: "count", a: gA.length, b: gB.length, higherIsBetter: true, decimals: 0 },
    { key: "score", label: "18-hole score", kind: "avg", a: avg(full18(gA).map((r) => num(r.Score))), b: avg(full18(gB).map((r) => num(r.Score))), higherIsBetter: false, decimals: 1 },
  ];
  const metrics = allMetrics.filter((x) => x.a != null || x.b != null);

  // ── Monthly small multiples ──
  const monthsShown = period === "same" ? +cutoff.slice(0, 2) : 12;
  const monthly = (title: string, key: string, f: (rows: Rec[]) => number | null, unit?: string) => ({
    key, title, unit,
    data: MONTHS.slice(0, monthsShown).map((mo, i) => {
      const pick = (rows: Rec[]) => rows.filter((r) => +r.Date.slice(5, 7) === i + 1);
      return { month: mo, a: f(pick(A)), b: f(pick(B)) };
    }),
  });
  const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
  const monthlyCharts = [
    monthly("Hours slept (avg)", "sleep", (rows) => r1(avg(rows.map((r) => num(get(r, "Hours slept"))))), "h"),
    monthly("Fun meter (avg)", "fun", (rows) => r1(avg(rows.map((r) => num(get(r, "Fun Meter (1-10)")))))),
    monthly("Steps per day (avg)", "steps", (rows) => { const v = avg(rows.map((r) => num(get(r, "Steps Taken")))); return v == null ? null : Math.round(v); }),
    monthly("Gym days", "gym", (rows) => (rows.length ? rows.filter((r) => bool(get(r, "Gym?"))).length : null)),
    monthly("Drinks", "drinks", (rows) => (rows.length ? sum(rows.map((r) => num(get(r, "# of Drinks")))) : null)),
    monthly("Restaurant meals", "ateout", (rows) => (rows.length ? rows.reduce((p, r) => p + ["Breakfast", "Lunch", "Dinner"].filter((x) => (get(r, `Restaurant ${x}`) ?? "").trim() !== "").length, 0) : null)),
    monthly("Cooked meals", "cooked", (rows) => (rows.length ? rows.reduce((p, r) => p + ["Breakfast", "Lunch", "Dinner"].filter((x) => bool(get(r, `Cooked ${x}?`))).length, 0) : null)),
    monthly("Resting HR (avg)", "rhr", (rows) => r1(avg(rows.map((r) => num(get(r, "Resting Heart Rate"))))), "bpm"),
  ].filter((c) => c.data.some((p) => p.a != null || p.b != null));

  // ── Cumulative races by day of year ──
  const cumulative = (title: string, key: string, f: (r: Rec) => number, unit?: string) => {
    const lastDoy = period === "same" ? doy(`${yearA}-${cutoff}`) : 366;
    const build = (rows: Rec[]) => { const map = new Map<number, number>(); let acc = 0; for (const r of rows) { acc += f(r); map.set(doy(r.Date), acc); } return map; };
    const ma = build(A), mb = build(B);
    const data: CumPoint[] = [];
    let la: number | null = null, lb: number | null = null;
    const maxA = Math.max(0, ...ma.keys()), maxB = Math.max(0, ...mb.keys());
    for (let d = 1; d <= lastDoy; d++) {
      if (ma.has(d)) la = ma.get(d)!;
      if (mb.has(d)) lb = mb.get(d)!;
      data.push({ doy: d, a: d <= maxA ? la : null, b: d <= maxB ? lb : null });
    }
    return { key, title, unit, data };
  };
  const cumulativeCharts = [
    cumulative("Miles walked", "miles", (r) => num(get(r, "Distance Traveled (miles)")) ?? 0, "mi"),
    cumulative("Gym visits", "gym", (r) => (bool(get(r, "Gym?")) ? 1 : 0)),
    cumulative("Drinks", "drinks", (r) => num(get(r, "# of Drinks")) ?? 0),
    cumulative("Restaurant meals", "ateout", (r) => ["Breakfast", "Lunch", "Dinner"].filter((x) => (get(r, `Restaurant ${x}`) ?? "").trim() !== "").length),
  ].filter((c) => c.data.some((p) => (p.a ?? 0) > 0 || (p.b ?? 0) > 0));

  // ── Ranked comparisons ──
  const rank = (title: string, sub: string, fa: string[], fb: string[], top = 10): RankCompare => {
    const ca = new Map<string, number>(), cb = new Map<string, number>();
    for (const v of fa) if (v) ca.set(v, (ca.get(v) ?? 0) + 1);
    for (const v of fb) if (v) cb.set(v, (cb.get(v) ?? 0) + 1);
    const names = [...new Set([...ca.keys(), ...cb.keys()])].map((name) => ({ name, a: ca.get(name) ?? 0, b: cb.get(name) ?? 0 }))
      .sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b) || y.a - x.a).slice(0, top);
    return { title, sub, rows: names };
  };
  const tok = (rows: Rec[], k: string) => rows.flatMap((r) => tokens(get(r, k)));
  const one = (rows: Rec[], k: string) => rows.map((r) => (get(r, k) ?? "").trim());
  const ranks: RankCompare[] = [
    rank("People seen", "days together", tok(A, "People seen in person"), tok(B, "People seen in person")),
    rank("Woke up in", "days per city", one(A, "Wake Up City"), one(B, "Wake Up City"), 8),
    rank("Shirt colors", "days worn", one(A, "Shirt Color Short"), one(B, "Shirt Color Short"), 6),
    rank("Shirt shades", "days worn", one(A, "Shirt Color Primary"), one(B, "Shirt Color Primary"), 10),
    rank("Restaurants", "visits", rA.map((r) => r.Restaurant ?? ""), rB.map((r) => r.Restaurant ?? ""), 10),
    rank("Cuisines", "visits", rA.map((r) => r["Restaurant Type"] ?? ""), rB.map((r) => r["Restaurant Type"] ?? ""), 8),
    rank("Meats", "days eaten", tok(A, "Meat Eaten"), tok(B, "Meat Eaten"), 8),
    rank("Fruits", "days eaten", tok(A, "Fruit Eaten"), tok(B, "Fruit Eaten"), 8),
    rank("Sports", "days played", tok(A, "Sports Played"), tok(B, "Sports Played"), 8),
    rank("Video games", "days played", tok(A, "Video games played"), tok(B, "Video games played"), 8),
    rank("Sky", "days", one(A, "Sky"), one(B, "Sky"), 8),
    rank("Transit", "rides", tok(A, "Public Transportation Used"), tok(B, "Public Transportation Used"), 8),
  ].filter((r) => r.rows.length);

  return { yearA, yearB, period, cutoff, daysA: A.length, daysB: B.length, metrics, monthly: monthlyCharts, cumulative: cumulativeCharts, ranks, years: PRIOR_YEARS };
}
