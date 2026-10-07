import "server-only";
import { DAILY_SHEET, getStore, type SheetData } from "./store";
import { isLoggedRow, rowToRecord } from "./daily";
import { addDays, todayISO } from "./dates";
import type { Count, Range, Tile } from "./metrics";

export interface CalendarView { key: string; title: string; kind: "bool" | "color"; values: Record<string, string> }
export interface FitPoint { x: number; y: number; date: string }
export interface Fit { slope: number; intercept: number; r: number; n: number }
export interface HrMonth { month: string; resting: number | null; peak: number | null }
export interface Friend { name: string; days: number; avgFun: number | null; avgDrinks: number | null }
export interface Heat { rows: string[]; cols: string[]; cells: number[][] }
/** Diverging heatmap: log2 lift per cell, null where the pair never happened. */
export interface LiftHeat { rows: string[]; cols: string[]; cells: (number | null)[][]; rowTotals: number[]; colTotals: number[] }
/** Grouped bars: one row per category label, one numeric key per series. */
export interface GroupRow { label: string; n?: number; [key: string]: number | string | null | undefined }
export interface Ratings { tv: Count[]; movies: Count[]; broadway: Count[]; games: Count[] }

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
  /* ── Figures beyond the notebook ── */
  /** Averages per weekday (Sun → Sat): fun, productivity, hours slept, steps, naps. */
  weekday: GroupRow[];
  /** Nights by bedtime hour and mornings by wake-up hour. */
  hours: GroupRow[];
  /** Morning phone battery in 10% bins (a notebook histogram that /insights never had). */
  battery: { bin: string; days: number }[];
  /** The notebook's "Which candies spoiled my appetite for vegetables" lift heatmap. */
  candyVeg: LiftHeat;
  sleepFun: FitPoint[]; sleepFunFit: Fit | null;
  /** Average fun meter by sky condition (3+ days). */
  funBySky: Count[];
  drinkTypes: Count[];
  /** Days per project and average productivity per project. */
  projects: Count[]; projectProd: Count[];
  /** Longest / current streaks of good habits in the range. */
  streaks: Tile[];
  /** Share of days with a jacket / hat / two layers, by high-temperature bin. */
  jacketByTemp: GroupRow[];
  /** Average food rating per cuisine (2+ visits). */
  cuisineRatings: Count[];
  /** Ratings from the Year Rankings and Video Game Rankings sheets (whole year, not range-filtered). */
  ratings: Ratings;
  /** Shows and streaming services at mealtimes, board games, days per sport. */
  shows: Count[]; services: Count[]; boardGames: Count[]; sportDays: Count[];
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
    cal("Injured", "injured", "bool", (r) => r["Injured?"] ?? ""),
    cal("Hat", "hat", "bool", (r) => r["Hat?"] ?? ""),
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

  // ── Beyond the notebook ──
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
  const weekday: GroupRow[] = DOW.map((label, i) => {
    const rs = rows.filter((r) => dow(r.Date) === i);
    return {
      label, n: rs.length,
      fun: r1(avg(rs.map((r) => num(r["Fun Meter (1-10)"])))), productivity: r1(avg(rs.map((r) => num(r["Productivity (1-10)"])))),
      sleep: r1(avg(rs.map((r) => num(r["Hours slept"])))), steps: avg(rs.map((r) => num(r["Steps Taken"]))) == null ? null : Math.round(avg(rs.map((r) => num(r["Steps Taken"])))!),
      naps: r1(avg(rs.map((r) => num(r["Naps taken"])))),
    };
  }).filter((w) => w.n);

  // Clock hours from 6 pm round to 1 pm so bedtimes (around midnight) and wake-ups (morning) each sit together.
  const hourOf = (t?: string) => { const m = (t ?? "").match(/^(\d{1,2}):/); return m ? +m[1] % 24 : null; };
  const wake = rows.map((r) => hourOf(r["Wake Up Time"])), bed = rows.map((r) => hourOf(r["Bedtime"]));
  const clock = Array.from({ length: 20 }, (_, i) => (18 + i) % 24);
  const hourLabel = (h: number) => (h === 0 ? "12am" : h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`);
  const hoursAll: GroupRow[] = clock.map((h) => ({ label: hourLabel(h), wake: wake.filter((x) => x === h).length, bed: bed.filter((x) => x === h).length }));
  const firstH = hoursAll.findIndex((r) => (r.wake as number) + (r.bed as number) > 0), lastH = hoursAll.length - 1 - [...hoursAll].reverse().findIndex((r) => (r.wake as number) + (r.bed as number) > 0);
  const hours = firstH < 0 ? [] : hoursAll.slice(firstH, lastH + 1);

  const batt = rows.map((r) => num(r["Morning Phone Battery (%)"])).filter((v): v is number => v != null);
  const battery = batt.length ? Array.from({ length: 10 }, (_, i) => ({ bin: i === 9 ? "90–100%" : `${i * 10}–${i * 10 + 9}%`, days: batt.filter((v) => (i === 9 ? v >= 90 : v >= i * 10 && v < i * 10 + 10)).length })) : [];

  const candyVeg = lift(rows, "Vegetables Eaten", "Candy Eaten", 10, 10);

  const sleepFun: FitPoint[] = rows.map((r) => ({ x: num(r["Hours slept"]) ?? NaN, y: num(r["Fun Meter (1-10)"]) ?? NaN, date: r.Date })).filter((p) => p.x > 0 && p.x <= 16 && p.y >= 1);
  const sleepFunFit = fit(sleepFun);

  const funBySky = avgBy(rows, (r) => r.Sky, (r) => num(r["Fun Meter (1-10)"]), 3);
  const drinkTypes = countTop(rows.flatMap((r) => tokens(r["Drink Type"])), 10);
  const proj = (r: Record<string, string>) => tokens(r["Things I worked on"]).map((p) => (p.toLowerCase() === "nextplay" ? "Nextplay" : p));
  const projects = countTop(rows.flatMap(proj), 8);
  const projectProd = avgByMulti(rows, proj, (r) => num(r["Productivity (1-10)"]), 3);

  const streakOf = (test: (r: Record<string, string>) => boolean | null) => {
    let best = 0, cur = 0, run = 0;
    for (const r of rows) { const t = test(r); if (t == null) continue; run = t ? run + 1 : 0; best = Math.max(best, run); }
    for (let i = rows.length - 1; i >= 0; i--) { const t = test(rows[i]); if (t == null) continue; if (!t) break; cur++; }
    return { best, cur };
  };
  const flag = (k: string) => (r: Record<string, string>) => (r[k] === "TRUE" ? true : r[k] === "FALSE" ? false : null);
  const not = (f: (r: Record<string, string>) => boolean | null) => (r: Record<string, string>) => { const v = f(r); return v == null ? null : !v; };
  const atLeast = (k: string, n: number) => (r: Record<string, string>) => { const v = num(r[k]); return v == null ? null : v >= n; };
  const streakTile = (label: string, s: { best: number; cur: number }): Tile => ({ label, value: `${s.best} d`, sub: s.cur ? `now ${s.cur} d` : "not running" });
  const streaks: Tile[] = [
    streakTile("Gym streak", streakOf(flag("Gym?"))),
    streakTile("Outside streak", streakOf(flag("Went Outside?"))),
    streakTile("Dry streak", streakOf(not(flag("Alcohol?")))),
    streakTile("10k-step streak", streakOf(atLeast("Steps Taken", 10000))),
    streakTile("7h-sleep streak", streakOf(atLeast("Hours slept", 7))),
    streakTile("Dinner streak", streakOf((r) => (r["Cooked Dinner?"] === "TRUE" ? true : r["Cooked Dinner?"] === "FALSE" ? false : null))),
  ];

  const tempBin = (t: number) => Math.floor(t / 10) * 10;
  const temps = rows.map((r) => num(r["High Temperature (F)"])).filter((v): v is number => v != null);
  const bins = [...new Set(temps.map(tempBin))].sort((a, b) => a - b);
  const pctOf = (rs: Record<string, string>[], f: (r: Record<string, string>) => boolean) => (rs.length ? Math.round((rs.filter(f).length / rs.length) * 100) : null);
  const jacketByTemp: GroupRow[] = bins.map((b) => {
    const rs = rows.filter((r) => { const t = num(r["High Temperature (F)"]); return t != null && tempBin(t) === b; });
    return { label: `${b}s°F`, n: rs.length, jacket: pctOf(rs, (r) => r["Jacket?"] === "TRUE"), hat: pctOf(rs, (r) => r["Hat?"] === "TRUE"), layers: pctOf(rs, (r) => (num(r["Clothes Layers"]) ?? 1) >= 2) };
  }).filter((r) => (r.n as number) >= 3);

  const restaurant = await safeRead("Restaurant");
  const rr = restaurant.rows.map((r) => rowToRecord(restaurant, r)).filter((r) => r.Date >= start && r.Date <= end);
  const cuisineRatings = avgBy(rr, (r) => r["Restaurant Type"], (r) => num(r["Food Rating"]), 2);

  const [yearRank, gameRank] = await Promise.all([safeRead("Year Rankings"), safeRead("Video Game Rankings")]);
  const rated = (sheet: SheetData, nameCol: string, ratingCol: string): Count[] => sheet.rows.map((r) => rowToRecord(sheet, r))
    .filter((r) => (r[nameCol] ?? "").trim() && num(r[ratingCol]) != null)
    .map((r) => ({ name: r[nameCol].trim(), value: num(r[ratingCol])! }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 15);
  const ratings: Ratings = {
    tv: rated(yearRank, "TV Shows Watched", "TV Rating"), movies: rated(yearRank, "Movies Watched", "Movie Rating"),
    broadway: rated(yearRank, "Broadway Watched", "Broadway Rating"), games: rated(gameRank, "Game", "Rating"),
  };
  const meals = ["Breakfast", "Lunch", "Dinner"];
  const shows = countTop(rows.flatMap((r) => meals.map((m) => (r[`Show Watched During ${m}`] ?? "").trim())), 10);
  const services = countTop(rows.flatMap((r) => meals.map((m) => (r[`Streaming Service ${m}`] ?? "").trim())), 8);
  const boardGames = countTop(rows.flatMap((r) => tokens(r["Board games played"])), 8);
  const sportDays = countTop(rows.flatMap((r) => [...new Set(tokens(r["Sports Played"]))]), 10);

  // ── Favorite shirt + pants combos ──
  const outfits = countTop(rows.map((r) => (r["Shirt ID"] && r["Pants ID"] ? `${r["Shirt Color Primary"]} ${r["Shirt Type"]} #${r["Shirt ID"]} + ${r["Pants Color Primary"]} ${r["Pants Type"]} #${r["Pants ID"]}` : "")), 8);

  return {
    range, start, end, year, daysLogged: rows.length, calendars, greenShades, brands, sleepHist, calFun, calFunFit, hrByMonth, friends,
    fruits, veggies, meats, candy, snacks, candySeason, sportHours, transit, states, golfOutcomes, golfPutts, golfNote, climbGrades, skiRuns, outfits,
    weekday, hours, battery, candyVeg, sleepFun, sleepFunFit, funBySky, drinkTypes, projects, projectProd, streaks, jacketByTemp, cuisineRatings, ratings,
    shows, services, boardGames, sportDays,
  };
}

/** Average of `pick` per group label (groups with fewer than `min` values dropped), rounded to 1 decimal, highest first. */
function avgBy(rows: Record<string, string>[], group: (r: Record<string, string>) => string, pick: (r: Record<string, string>) => number | null, min = 1): Count[] {
  return avgByMulti(rows, (r) => [group(r)], pick, min);
}
function avgByMulti(rows: Record<string, string>[], groups: (r: Record<string, string>) => string[], pick: (r: Record<string, string>) => number | null, min = 1): Count[] {
  const m = new Map<string, number[]>();
  for (const r of rows) { const v = pick(r); if (v == null) continue; for (const g of groups(r)) if (g.trim()) (m.get(g) ?? m.set(g, []).get(g)!).push(v); }
  return [...m.entries()].filter(([, v]) => v.length >= min).map(([name, v]) => ({ name, value: Math.round((avg(v) ?? 0) * 10) / 10 }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 12);
}

/**
 * The notebook's plot_veggie_deterrence_heatmap: for the top vegetables (columns) and top candies (rows),
 * lift = P(candy | vegetable that day) ÷ P(candy), as log2 so 0 is neutral, negative means the vegetable
 * "deterred" the candy. Pairs that never co-occurred are null (the notebook leaves them blank).
 */
function lift(rows: Record<string, string>[], colKey: string, rowKey: string, nCols: number, nRows: number): LiftHeat {
  const days = rows.length;
  const colSets = rows.map((r) => new Set(tokens(r[colKey]))), rowSets = rows.map((r) => new Set(tokens(r[rowKey])));
  const cols = countTop(colSets.flatMap((s) => [...s]), nCols).map((c) => c.name);
  const rws = countTop(rowSets.flatMap((s) => [...s]), nRows).map((c) => c.name);
  const colTotals = cols.map((c) => colSets.filter((s) => s.has(c)).length);
  const rowTotals = rws.map((c) => rowSets.filter((s) => s.has(c)).length);
  const cells = rws.map((candy, i) => cols.map((veg, j) => {
    const joint = rows.filter((_, k) => colSets[k].has(veg) && rowSets[k].has(candy)).length;
    if (!joint || !days) return null;
    return Math.round(Math.log2((joint / colTotals[j]) / (rowTotals[i] / days)) * 100) / 100;
  }));
  return { rows: rws, cols, cells, rowTotals, colTotals };
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
