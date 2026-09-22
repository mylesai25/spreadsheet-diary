import "server-only";
import { DAILY_SHEET, getStore, type SheetData } from "./store";
import { isLoggedRow, rowToRecord } from "./daily";
import { addDays, todayISO } from "./dates";
import type { Count, Range } from "./metrics";

export interface CalendarView { key: string; title: string; kind: "bool" | "color"; values: Record<string, string> }
export interface FitPoint { x: number; y: number; date: string }
export interface Fit { slope: number; intercept: number; r: number; n: number }
export interface HrMonth { month: string; resting: number | null; peak: number | null }
export interface Friend { name: string; days: number; avgFun: number | null; avgDrinks: number | null }
export interface Heat { rows: string[]; cols: string[]; cells: number[][] }

export interface Insights {
  range: Range; start: string; end: string; year: string; daysLogged: number;
  calendars: CalendarView[];
  greenShades: Count[]; brands: Count[];
  sleepHist: { bin: string; days: number }[];
  calFun: FitPoint[]; calFunFit: Fit | null;
  hrByMonth: HrMonth[];
  friends: Friend[];
  fruits: Count[]; veggies: Count[]; meats: Count[]; candy: Count[]; snacks: Count[];
  candySeason: Heat;
  sportHours: Count[]; transit: Count[]; states: Count[];
  golfOutcomes: Count[]; golfPutts: Count[]; golfNote: string;
  climbGrades: Count[]; skiRuns: Count[];
  outfits: Count[];
}

const num = (v?: string) => { if (v == null || v.trim() === "") return null; const n = Number(v.replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
const tokens = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

function countTop(values: string[], top = 10): Count[] {
  const m = new Map<string, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, top).map(([name, value]) => ({ name, value }));
}

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
const season = (iso: string) => { const m = +iso.slice(5, 7); return m === 12 || m <= 2 ? "Winter" : m <= 5 ? "Spring" : m <= 8 ? "Summer" : "Fall"; };

async function safeRead(sheet: string): Promise<SheetData> {
  try { return await getStore().read("journal", sheet); } catch { return { book: "journal", name: sheet, header: [], rows: [] }; }
}

export async function buildInsights(range: Range): Promise<Insights> {
  const daily = await getStore().read("journal", DAILY_SHEET);
  const dateCol = daily.header.indexOf("Date");
  const all = daily.rows.filter((r) => r[dateCol] && isLoggedRow(daily, r)).map((r) => rowToRecord(daily, r)).sort((a, b) => (a.Date < b.Date ? -1 : 1));
  const end = todayISO();
  const first = all[0]?.Date ?? end;
  const start = rangeStart(range, end, first);
  const rows = all.filter((r) => r.Date >= start && r.Date <= end);
  const year = end.slice(0, 4);
  const yearRows = all.filter((r) => r.Date.startsWith(year));

  // ── Calendars (always the current year) ──
  const cal = (title: string, key: string, kind: CalendarView["kind"], pick: (r: Record<string, string>) => string): CalendarView => ({
    key, title, kind, values: Object.fromEntries(yearRows.map((r) => [r.Date, pick(r)]).filter(([, v]) => v !== "")),
  });
  const calendars: CalendarView[] = [
    cal("Shirt color", "shirt", "color", (r) => r["Shirt Color Short"] ?? ""),
    cal("Shirt shade", "shirtDetail", "color", (r) => r["Shirt Color Primary"] ?? ""),
    cal("Pants color", "pants", "color", (r) => r["Pants Color Short"] ?? ""),
    cal("Went outside", "outside", "bool", (r) => r["Went Outside?"] ?? ""),
    cal("Gym", "gym", "bool", (r) => r["Gym?"] ?? ""),
    cal("Cooked", "cooked", "bool", (r) => (r["Cooked Lunch?"] === "TRUE" || r["Cooked Dinner?"] === "TRUE" ? "TRUE" : r["Cooked Lunch?"] || r["Cooked Dinner?"] ? "FALSE" : "")),
    cal("Alcohol", "alcohol", "bool", (r) => r["Alcohol?"] ?? ""),
    cal("Sick", "sick", "bool", (r) => r["Sick?"] ?? ""),
    cal("Sky", "sky", "color", (r) => r["Sky"] ?? ""),
  ];

  // ── Wardrobe: every color / brand column pooled ──
  const colorCols = ["Shirt Color Primary", "Pants Color Primary", "Shoe Color Primary", "Sock Color Primary", "Hat Color Primary", "Jacket Color Primary"];
  const greenShades = countTop(rows.flatMap((r) => colorCols.map((c) => r[c] ?? "").filter((v) => /green|lime|olive|eucalyptus|pistachio|mint|emerald|seafoam|nyanza|sage|fern|moss/i.test(v))), 12);
  const brandCols = ["Shirt Company", "Pants Brand", "Shoe Brand", "Sock Company", "Hat Company", "Jacket Company"];
  const brands = countTop(rows.flatMap((r) => brandCols.map((c) => (r[c] ?? "").trim()).filter(Boolean).map((b) => (b.toLowerCase() === "mud" ? "MUD" : b))), 10);

  // ── Sleep histogram ──
  const hist = new Map<number, number>();
  for (const r of rows) { const h = num(r["Hours slept"]); if (h != null) hist.set(Math.round(h), (hist.get(Math.round(h)) ?? 0) + 1); }
  const hs = [...hist.keys()];
  const sleepHist = hs.length ? Array.from({ length: Math.max(...hs) - Math.min(...hs) + 1 }, (_, i) => { const b = Math.min(...hs) + i; return { bin: `${b}h`, days: hist.get(b) ?? 0 }; }) : [];

  // ── Calories vs fun (notebook window 1000–7000 kcal) ──
  const calFun: FitPoint[] = rows.map((r) => ({ x: num(r["Calories Burned"]) ?? NaN, y: num(r["Fun Meter (1-10)"]) ?? NaN, date: r.Date })).filter((p) => p.x >= 1000 && p.x <= 7000 && p.y >= 1);
  const calFunFit = fit(calFun);

  // ── Heart rate by month ──
  const hrByMonth: HrMonth[] = MONTHS.map((m, i) => {
    const mr = rows.filter((r) => +r.Date.slice(5, 7) === i + 1);
    return { month: m, resting: r1(avg(mr.map((r) => num(r["Resting Heart Rate"])))), peak: r1(avg(mr.map((r) => num(r["Peak Heart Rate"])))) };
  }).filter((m) => m.resting != null || m.peak != null);

  // ── Friends ──
  const byPerson = new Map<string, Record<string, string>[]>();
  for (const r of rows) for (const p of tokens(r["People seen in person"])) (byPerson.get(p) ?? byPerson.set(p, []).get(p)!).push(r);
  const friends: Friend[] = [...byPerson.entries()].map(([name, rs]) => ({
    name, days: rs.length, avgFun: r1(avg(rs.map((r) => num(r["Fun Meter (1-10)"])))), avgDrinks: r1(avg(rs.map((r) => num(r["# of Drinks"]) ?? 0))),
  })).sort((a, b) => b.days - a.days || a.name.localeCompare(b.name)).slice(0, 12);

  // ── Food ──
  const fruits = countTop(rows.flatMap((r) => tokens(r["Fruit Eaten"])), 10);
  const veggies = countTop(rows.flatMap((r) => tokens(r["Vegetables Eaten"])), 10);
  const meats = countTop(rows.flatMap((r) => tokens(r["Meat Eaten"])), 10);
  const candy = countTop(rows.flatMap((r) => tokens(r["Candy Eaten"])), 12);
  const snacks = countTop(rows.flatMap((r) => tokens(r["Snacks Eaten"])), 10);
  const seasons = ["Winter", "Spring", "Summer", "Fall"];
  const topCandy = candy.slice(0, 10).map((c) => c.name);
  const candySeason: Heat = {
    rows: topCandy, cols: seasons,
    cells: topCandy.map((c) => seasons.map((s) => rows.filter((r) => season(r.Date) === s && tokens(r["Candy Eaten"]).includes(c)).length)),
  };

  // ── Sports: minutes split in lockstep with the sports list ──
  const mins = new Map<string, number>();
  for (const r of rows) {
    const sports = tokens(r["Sports Played"]); const durs = tokens(r["Duration (minutes)"]).map((d) => num(d) ?? 0);
    if (!sports.length) continue;
    sports.forEach((s, i) => { const d = durs.length === sports.length ? durs[i] : durs.length ? durs.reduce((a, b) => a + b, 0) / sports.length : 0; mins.set(s, (mins.get(s) ?? 0) + d); });
  }
  const sportHours = [...mins.entries()].map(([name, m]) => ({ name, value: Math.round(m / 6) / 10 })).filter((c) => c.value > 0).sort((a, b) => b.value - a.value).slice(0, 10);

  const transit = countTop(rows.flatMap((r) => tokens(r["Public Transportation Used"])), 10);
  const states = countTop(rows.flatMap((r) => tokens(r["States Visited"])), 10);

  // ── Golf (solo formats only, like the notebook) ──
  const golf = await safeRead("Golf");
  const gr = golf.rows.map((r) => rowToRecord(golf, r)).filter((r) => r.Date >= start && r.Date <= end && (!r.Game || /^(Regular|Wolf)$/i.test(r.Game)));
  const sum = (rs: Record<string, string>[], k: string) => rs.reduce((a, r) => a + (num(r[k]) ?? 0), 0);
  const golfOutcomes = [["Eagles", "Eagles"], ["Birdies", "Birdies"], ["Pars", "Pars"], ["Bogeys", "Bogeys"], ["Doubles", "Double Bogeys"], ["Triple+", "Triple Bogeys+"]].map(([name, k]) => ({ name, value: sum(gr, k) })).filter((c) => c.value > 0);
  const golfPutts = [["0 putts", "0 Putts"], ["1 putt", "1 Putts"], ["2 putts", "2 Putts"], ["3+ putts", "3+ Putts"]].map(([name, k]) => ({ name, value: sum(gr, k) })).filter((c) => c.value > 0);
  const full = gr.filter((r) => num(r["Holes Played"]) === 18);
  const golfNote = gr.length ? `${gr.length} solo rounds · ${sum(gr, "Holes Played")} holes${full.length ? ` · 18-hole avg ${r1(avg(full.map((r) => num(r.Score))))} (${r1(avg(full.map((r) => num(r.Putts))))} putts)` : ""}` : "No solo rounds in range";

  const climb = await safeRead("Climbing");
  const cr = climb.rows.map((r) => rowToRecord(climb, r)).filter((r) => r.Date >= start && r.Date <= end);
  const climbGrades = ["V0", "V1", "V2", "V3", "V4", "V5", "V6"].map((g) => ({ name: g, value: sum(cr, `${g} Completed`) })).filter((c) => c.value > 0);
  const ski = await safeRead("Skiing");
  const sr = ski.rows.map((r) => rowToRecord(ski, r)).filter((r) => r.Date >= start && r.Date <= end);
  const skiRuns = [["Green", "Green Runs"], ["Blue", "Blue Runs"], ["Terrain park", "Terrain Runs"], ["Black", "Black Diamond Runs"], ["Double black", "Double Black Diamond Runs"]].map(([name, k]) => ({ name, value: sum(sr, k) })).filter((c) => c.value > 0);

  // ── Favorite shirt + pants combos ──
  const outfits = countTop(rows.map((r) => (r["Shirt ID"] && r["Pants ID"] ? `${r["Shirt Color Primary"]} ${r["Shirt Type"]} #${r["Shirt ID"]} + ${r["Pants Color Primary"]} ${r["Pants Type"]} #${r["Pants ID"]}` : "")), 8);

  return {
    range, start, end, year, daysLogged: rows.length, calendars, greenShades, brands, sleepHist, calFun, calFunFit, hrByMonth, friends,
    fruits, veggies, meats, candy, snacks, candySeason, sportHours, transit, states, golfOutcomes, golfPutts, golfNote, climbGrades, skiRuns, outfits,
  };
}

function fit(pts: FitPoint[]): Fit | null {
  const n = pts.length;
  if (n < 3) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of pts) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; }
  if (!sxx || !syy) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r: sxy / Math.sqrt(sxx * syy), n };
}
