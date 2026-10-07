import "server-only";
import { getStore, type SheetData } from "./store";
import { rowToRecord } from "./daily";
import { addDays, todayISO } from "./dates";
import type { Count, Range, Tile } from "./metrics";

/**
 * The notebook's Activities section (cells "Golf", "Climbing", "Skiing"): solo-round golf
 * outcomes, climbs completed by grade, ski runs by difficulty — each as a share and as the
 * notebook's `cumulative_line_graph` (running count per session), plus headline tiles.
 * The Mini-Golf and Disc Golf sheets get the same treatment (the notebook never charted them).
 */

type Rec = Record<string, string>;

/** One row of a cumulative chart: session index (0 = before the first), its date, and a running total per series. */
export interface CumRow { i: number; date: string; label: string; [series: string]: number | string }
export interface Series { key: string; name: string; color: string }
export interface Cumulative { rows: CumRow[]; series: Series[]; xLabel: string }
export interface Slice { name: string; value: number; color: string }
export interface SendRate { grade: string; attempted: number; completed: number; rate: number | null; color: string }
export interface GolfScore { date: string; course: string; score: number; toPar: number; holes: number }

export interface ActivityStats {
  golf: {
    tiles: Tile[]; outcomes: Slice[]; cumulative: Cumulative; putts: Count[]; courses: Count[]; scores18: GolfScore[]; rounds: number; note: string;
    /** Average strokes over par per course (solo rounds). */
    byCourse: Count[];
    /** Median 18-hole score when riding vs walking. */
    cart: Count[];
    /** Fairways and greens hit, per solo round, in order played. */
    fairwaysGreens: Cumulative;
  };
  climb: {
    tiles: Tile[]; grades: Slice[]; cumulative: Cumulative; sendRate: SendRate[]; gyms: Count[]; sessions: number;
    /** The gym's color circuits (Green → Purple), completed and send rate. */
    colors: Slice[]; colorSendRate: SendRate[];
  };
  ski: { tiles: Tile[]; runs: Slice[]; cumulative: Cumulative; falls: Slice[]; days: number };
  miniGolf: { tiles: Tile[]; scores: GolfScore[]; putts: Slice[]; courses: Count[]; winners: Count[]; rounds: number };
  discGolf: { tiles: Tile[]; scores: GolfScore[]; outcomes: Slice[]; cumulative: Cumulative; courses: Count[]; winners: Count[]; rounds: number };
}

/* Series colors: the notebook's hue per category (grade colors, scorecard colors, trail-sign colors),
   re-stepped so adjacent pairs clear the CVD / normal-vision separation checks on the black surface. */
export const GRADE_COLORS: Record<string, string> = { V0: "#fde047", V1: "#fb923c", V2: "#f43f5e", V3: "#4ade80", V4: "#a78bfa", V5: "#cbd5e1", V6: "#38bdf8" };
export const OUTCOME_COLORS: Record<string, string> = { Eagles: "#38bdf8", Birdies: "#e2e8f0", Pars: "#4ade80", Bogeys: "#f97316", Doubles: "#e11d48", "Triple+": "#a78bfa" };
export const RUN_COLORS: Record<string, string> = { Green: "#4ade80", Blue: "#38bdf8", "Terrain park": "#f97316", Black: "#64748b", "Double black": "#e2e8f0" };
export const CIRCUIT_COLORS: Record<string, string> = { Green: "#4ade80", Yellow: "#fde047", Orange: "#fb923c", Red: "#f43f5e", Purple: "#a78bfa" };
export const PUTT_COLORS: Record<string, string> = { "Hole-in-one": "#e2e8f0", "2 putts": "#4ade80", "3 putts": "#f97316", "4+ putts": "#e11d48" };
export const DISC_COLORS: Record<string, string> = { Aces: "#38bdf8", Birdies: "#e2e8f0", Pars: "#4ade80", Bogeys: "#f97316", Doubles: "#e11d48", "Triple+": "#a78bfa" };

const num = (v?: string) => { if (v == null || v.trim() === "") return null; const n = Number(v.replace(/[,%]/g, "")); return Number.isFinite(n) ? n : null; };
const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const sum = (rs: Rec[], k: string) => rs.reduce((a, r) => a + (num(r[k]) ?? 0), 0);
const r1 = (n: number | null) => (n == null ? "—" : String(Math.round(n * 10) / 10));
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);
const fmtDate = (iso: string) => { const [, m, d] = iso.split("-"); return `${+m}/${+d}`; };
const median = (xs: number[]) => { if (!xs.length) return null; const v = [...xs].sort((a, b) => a - b); const h = v.length >> 1; return v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2; };
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
/** Average of `pick` per group (groups with fewer than `min` rows dropped), rounded to 1 decimal, best first. */
function avgBy(rows: Rec[], group: (r: Rec) => string, pick: (r: Rec) => number | null, min = 1, asc = false): Count[] {
  const m = new Map<string, (number | null)[]>();
  for (const r of rows) { const g = group(r); if (g) (m.get(g) ?? m.set(g, []).get(g)!).push(pick(r)); }
  return [...m.entries()].filter(([, v]) => v.filter((x) => x != null).length >= min)
    .map(([name, v]) => ({ name, value: Math.round((avg(v) ?? 0) * 10) / 10 }))
    .sort((a, b) => (asc ? a.value - b.value : b.value - a.value) || a.name.localeCompare(b.name));
}
/** Score lines for any golf-shaped sheet: every round with a score and a par. */
const toScores = (rows: Rec[]): GolfScore[] => rows.filter((r) => num(r.Score) != null && num(r.Par) != null)
  .map((r) => ({ date: r.Date, course: r.Course ?? "", score: num(r.Score)!, toPar: num(r.Score)! - num(r.Par)!, holes: num(r["Holes Played"]) ?? 18 }));
/** Who won: "Me" against everyone else, as the sheet records it. */
const winners = (rows: Rec[]) => countTop(rows.map((r) => r.Winner), 8);
const winRate = (rows: Rec[]) => { const w = rows.filter((r) => r.Winner).length; return w ? `${Math.round((rows.filter((r) => /^me$/i.test(r.Winner.trim())).length / w) * 100)}%` : "—"; };

function countTop(values: string[], top = 8): Count[] {
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

async function safeRead(sheet: string): Promise<SheetData> {
  try { return await getStore().read("journal", sheet); } catch { return { book: "journal", name: sheet, header: [], rows: [] }; }
}

/** The notebook's cumulative_line_graph: running sums per column, with a 0 row before the first session. */
function cumulative(rows: Rec[], series: { key: string; name: string; col: string; color: string }[], xLabel: string): Cumulative {
  const out: CumRow[] = [{ i: 0, date: "", label: "Start", ...Object.fromEntries(series.map((s) => [s.key, 0])) }];
  const tot = Object.fromEntries(series.map((s) => [s.key, 0])) as Record<string, number>;
  rows.forEach((r, i) => {
    for (const s of series) tot[s.key] += num(r[s.col]) ?? 0;
    out.push({ i: i + 1, date: r.Date, label: fmtDate(r.Date), ...tot });
  });
  const used = series.filter((s) => tot[s.key] > 0);
  return { rows: out, series: used.map(({ key, name, color }) => ({ key, name, color })), xLabel };
}

export async function buildActivityStats(range: Range): Promise<ActivityStats> {
  const end = todayISO();
  const [golfSheet, climbSheet, skiSheet, miniSheet, discSheet] = await Promise.all([safeRead("Golf"), safeRead("Climbing"), safeRead("Skiing"), safeRead("Mini-Golf"), safeRead("Disc Golf")]);
  const inRange = (sheet: SheetData) => {
    const rs = sheet.rows.map((r) => rowToRecord(sheet, r)).filter((r) => r.Date).sort((a, b) => (a.Date < b.Date ? -1 : 1));
    const start = rangeStart(range, end, rs[0]?.Date ?? end);
    return rs.filter((r) => r.Date >= start && r.Date <= end);
  };

  // ── Golf: solo formats only (Regular / Wolf / blank), like the notebook's solo_data ──
  const golfAll = inRange(golfSheet);
  const golf = golfAll.filter((r) => !r.Game || /^(Regular|Wolf)$/i.test(r.Game));
  const full = golf.filter((r) => num(r["Holes Played"]) === 18 && num(r.Score) != null);
  const outcomeCols: [string, string][] = [["Eagles", "Eagles"], ["Birdies", "Birdies"], ["Pars", "Pars"], ["Bogeys", "Bogeys"], ["Doubles", "Double Bogeys"], ["Triple+", "Triple Bogeys+"]];
  const outcomes: Slice[] = outcomeCols.map(([name, col]) => ({ name, value: sum(golf, col), color: OUTCOME_COLORS[name] })).filter((s) => s.value > 0);
  const hazards = sum(golf, "Bunker Shots") + sum(golf, "Water Hazard") + sum(golf, "Ball Lost");
  const best18 = full.length ? Math.min(...full.map((r) => num(r.Score)!)) : null;
  const golfTiles: Tile[] = [
    { label: "Solo rounds", value: String(golf.length), sub: `${sum(golf, "Holes Played")} holes · ${golfAll.length - golf.length} team rounds` },
    { label: "18-hole avg", value: r1(avg(full.map((r) => num(r.Score)))), sub: best18 != null ? `best ${best18}` : "no 18-hole rounds" },
    { label: "Putts / 18", value: r1(avg(full.map((r) => num(r.Putts)))), sub: `${sum(golf, "Putts")} putts total` },
    { label: "Fairways hit", value: pct(avg(golf.map((r) => num(r["FIR%"])))), sub: `greens ${pct(avg(golf.map((r) => num(r["GIR%"]))))}` },
    { label: "Birdies", value: String(sum(golf, "Birdies")), sub: `${sum(golf, "Birdie Looks")} looks · ${sum(golf, "Eagles")} eagles` },
    { label: "Trouble", value: String(hazards), sub: `${sum(golf, "Bunker Shots")} bunker · ${sum(golf, "Water Hazard")} water · ${sum(golf, "Ball Lost")} lost` },
  ];
  const golfCum = cumulative(golf, outcomeCols.map(([name, col]) => ({ key: name, name, col, color: OUTCOME_COLORS[name] })), "Round");
  const putts = [["0 putts", "0 Putts"], ["1 putt", "1 Putts"], ["2 putts", "2 Putts"], ["3+ putts", "3+ Putts"]].map(([name, k]) => ({ name, value: sum(golf, k) })).filter((c) => c.value > 0);
  const scores18: GolfScore[] = full.map((r) => ({ date: r.Date, course: r.Course ?? "", score: num(r.Score)!, toPar: num(r.Score)! - (num(r.Par) ?? 0), holes: 18 }));
  const note = golf.length ? `${golf.length} solo rounds · ${sum(golf, "Holes Played")} holes` : "No solo rounds in range";
  const byCourse = avgBy(golf.filter((r) => num(r.Score) != null && num(r.Par) != null), (r) => r.Course, (r) => num(r.Score)! - num(r.Par)!, 1, true);
  const cart: Count[] = [["Cart", /^yes$/i], ["Walked", /^no$/i]].map(([name, re]) => ({ name: name as string, value: median(full.filter((r) => (re as RegExp).test((r["Cart?"] ?? "").trim())).map((r) => num(r.Score)!)) ?? 0 })).filter((c) => c.value > 0);
  const fairwaysGreens: Cumulative = {
    xLabel: "Round",
    series: [{ key: "fir", name: "Fairways", color: OUTCOME_COLORS.Pars }, { key: "gir", name: "Greens", color: OUTCOME_COLORS.Birdies }],
    rows: golf.filter((r) => num(r["FIR%"]) != null || num(r["GIR%"]) != null).map((r, i) => ({ i: i + 1, date: r.Date, label: fmtDate(r.Date), fir: num(r["FIR%"]) ?? 0, gir: num(r["GIR%"]) ?? 0 })),
  };

  // ── Climbing ──
  const climb = inRange(climbSheet);
  const grades = ["V0", "V1", "V2", "V3", "V4", "V5", "V6"];
  const attemptedCol = (g: string) => (g === "V6" ? "V6 Attemped" : `${g} Attempted`); // sheet header typo preserved
  const gradeSlices: Slice[] = grades.map((g) => ({ name: g, value: sum(climb, `${g} Completed`), color: GRADE_COLORS[g] })).filter((s) => s.value > 0);
  const sendRate: SendRate[] = grades.map((g) => {
    const attempted = sum(climb, attemptedCol(g)), completed = sum(climb, `${g} Completed`);
    return { grade: g, attempted, completed, rate: attempted ? Math.round((completed / attempted) * 100) : null, color: GRADE_COLORS[g] };
  }).filter((s) => s.attempted > 0 || s.completed > 0);
  const sends = gradeSlices.reduce((a, s) => a + s.value, 0);
  const attempts = sendRate.reduce((a, s) => a + s.attempted, 0);
  const hardest = [...gradeSlices].reverse()[0]?.name ?? null;
  const climbMinutes = sum(climb, "Duration (minutes)");
  const climbTiles: Tile[] = [
    { label: "Sessions", value: String(climb.length), sub: climb.length ? `${countTop(climb.map((r) => r.Gym), 1)[0]?.name ?? ""}` : "none in range" },
    { label: "Time on the wall", value: `${Math.round(climbMinutes / 6) / 10} h`, sub: climb.length ? `${Math.round(climbMinutes / climb.length)} min per session` : undefined },
    { label: "Climbs sent", value: String(sends), sub: climb.length ? `${Math.round(sends / climb.length * 10) / 10} per session` : undefined },
    { label: "Send rate", value: attempts ? `${Math.round((sends / attempts) * 100)}%` : "—", sub: `${attempts} attempts` },
    { label: "Hardest sent", value: hardest ?? "—", sub: hardest ? `${gradeSlices.find((s) => s.name === hardest)?.value} sends` : undefined },
    { label: "Projecting", value: sendRate.filter((s) => s.attempted > 0 && s.completed === 0).map((s) => s.grade).join(", ") || "—", sub: "attempted, not yet sent" },
  ];
  const climbCum = cumulative(climb, grades.map((g) => ({ key: g, name: g, col: `${g} Completed`, color: GRADE_COLORS[g] })), "Gym visit");
  const circuits = Object.keys(CIRCUIT_COLORS);
  const colorSlices: Slice[] = circuits.map((c) => ({ name: c, value: sum(climb, `${c} Completed`), color: CIRCUIT_COLORS[c] })).filter((s) => s.value > 0);
  const colorSendRate: SendRate[] = circuits.map((c) => {
    const attempted = sum(climb, `${c} Attempted`), completed = sum(climb, `${c} Completed`);
    return { grade: c, attempted, completed, rate: attempted ? Math.round((completed / attempted) * 100) : null, color: CIRCUIT_COLORS[c] };
  }).filter((s) => s.attempted > 0 || s.completed > 0);

  // ── Skiing ──
  const ski = inRange(skiSheet);
  const runCols: [string, string, string][] = [["Green", "Green Runs", "Green Falls"], ["Blue", "Blue Runs", "Blue Falls"], ["Terrain park", "Terrain Runs", "Terrain Falls"], ["Black", "Black Diamond Runs", "Black Diamond Falls"], ["Double black", "Double Black Diamond Runs", "Double Black Diamond Falls"]];
  const runs: Slice[] = runCols.map(([name, col]) => ({ name, value: sum(ski, col), color: RUN_COLORS[name] })).filter((s) => s.value > 0);
  const falls: Slice[] = runCols.map(([name, , col]) => ({ name, value: sum(ski, col), color: RUN_COLORS[name] })).filter((s) => s.value > 0);
  const totalRuns = runs.reduce((a, s) => a + s.value, 0);
  const skiHours = sum(ski, "Duration (hrs)");
  const highest = ski.length ? Math.max(0, ...ski.map((r) => num(r["Heighest Lift (ft)"]) ?? 0)) : 0;
  const skiTiles: Tile[] = [
    { label: "Ski days", value: String(ski.length), sub: ski.length ? `${new Set(ski.map((r) => r.Resort)).size} resorts` : "none in range" },
    { label: "Hours", value: String(Math.round(skiHours * 10) / 10), sub: ski.length ? `${Math.round((skiHours / ski.length) * 10) / 10} per day` : undefined },
    { label: "Runs", value: String(totalRuns), sub: ski.length ? `${Math.round(totalRuns / ski.length)} per day` : undefined },
    { label: "Falls", value: String(sum(ski, "Total Falls")), sub: `${sum(ski, "Collisions")} collisions` },
    { label: "Highest lift", value: highest ? `${highest.toLocaleString("en-US")} ft` : "—" },
    { label: "Lifts ridden", value: String(sum(ski, "Lifts Ridden")) },
  ];
  const skiCum = cumulative(ski, runCols.map(([name, col]) => ({ key: name, name, col, color: RUN_COLORS[name] })), "Ski day");

  // ── Mini golf ──
  const mini = inRange(miniSheet);
  const miniScores = toScores(mini);
  const mini18 = miniScores.filter((r) => r.holes === 18);
  const miniBest = miniScores.length ? Math.min(...miniScores.map((r) => r.toPar)) : null;
  const miniPutts: Slice[] = ([["Hole-in-one", "Hole-In-One"], ["2 putts", "2 Putts"], ["3 putts", "3 Putts"], ["4+ putts", "4+ Putts"]] as const)
    .map(([name, col]) => ({ name, value: sum(mini, col), color: PUTT_COLORS[name] })).filter((s) => s.value > 0);
  const miniTiles: Tile[] = [
    { label: "Rounds", value: String(mini.length), sub: mini.length ? `${new Set(mini.map((r) => r.Course)).size} courses · ${sum(mini, "Holes Played")} holes` : "none in range" },
    { label: "18-hole avg", value: mini18.length ? signed(Math.round(avg(mini18.map((r) => r.toPar))! * 10) / 10) : "—", sub: mini18.length ? `${r1(avg(mini18.map((r) => r.score)))} strokes` : "no 18-hole rounds" },
    { label: "Best round", value: miniBest == null ? "—" : signed(miniBest), sub: miniBest == null ? undefined : miniScores.find((r) => r.toPar === miniBest)?.course },
    { label: "Hole-in-ones", value: String(sum(mini, "Hole-In-One")), sub: `${sum(mini, "4+ Putts")} four-putts` },
    { label: "Win rate", value: winRate(mini), sub: `${mini.filter((r) => /^me$/i.test((r.Winner ?? "").trim())).length} wins` },
    { label: "Indoors", value: String(mini.filter((r) => /indoor/i.test(r["Indoors/Outdoors"] ?? "")).length), sub: `${mini.filter((r) => /outdoor/i.test(r["Indoors/Outdoors"] ?? "")).length} outdoors` },
  ];

  // ── Disc golf ──
  const disc = inRange(discSheet);
  const discScores = toScores(disc);
  const disc18 = discScores.filter((r) => r.holes === 18);
  const discBest = discScores.length ? Math.min(...discScores.map((r) => r.toPar)) : null;
  const discCols: [string, string][] = [["Aces", "Aces"], ["Birdies", "Birdies"], ["Pars", "Pars"], ["Bogeys", "Bogeys"], ["Doubles", "Double Bogeys"], ["Triple+", "Triple Bogeys+"]];
  const discOutcomes: Slice[] = discCols.map(([name, col]) => ({ name, value: sum(disc, col), color: DISC_COLORS[name] })).filter((s) => s.value > 0);
  const discMiles = sum(disc, "Distance (miles)");
  const discTiles: Tile[] = [
    { label: "Rounds", value: String(disc.length), sub: disc.length ? `${new Set(disc.map((r) => r.Course)).size} courses · ${sum(disc, "Holes Played")} holes` : "none in range" },
    { label: "18-hole avg", value: disc18.length ? signed(Math.round(avg(disc18.map((r) => r.toPar))! * 10) / 10) : "—", sub: disc18.length ? `${r1(avg(disc18.map((r) => r.score)))} throws` : "no 18-hole rounds" },
    { label: "Best round", value: discBest == null ? "—" : signed(discBest), sub: discBest == null ? undefined : discScores.find((r) => r.toPar === discBest)?.course },
    { label: "Birdies", value: String(sum(disc, "Birdies")), sub: `${sum(disc, "Aces")} aces · ${sum(disc, "Pars")} pars` },
    { label: "Win rate", value: winRate(disc), sub: `${disc.filter((r) => /^me$/i.test((r.Winner ?? "").trim())).length} wins` },
    { label: "Miles walked", value: discMiles ? String(Math.round(discMiles * 10) / 10) : "—", sub: `${sum(disc, "Steps").toLocaleString("en-US")} steps` },
  ];
  const discCum = cumulative(disc, discCols.map(([name, col]) => ({ key: name, name, col, color: DISC_COLORS[name] })), "Round");

  return {
    golf: { tiles: golfTiles, outcomes, cumulative: golfCum, putts, courses: countTop(golfAll.map((r) => r.Course)), scores18, rounds: golf.length, note, byCourse, cart, fairwaysGreens },
    climb: { tiles: climbTiles, grades: gradeSlices, cumulative: climbCum, sendRate, gyms: countTop(climb.map((r) => r.Gym)), sessions: climb.length, colors: colorSlices, colorSendRate },
    ski: { tiles: skiTiles, runs, cumulative: skiCum, falls, days: ski.length },
    miniGolf: { tiles: miniTiles, scores: miniScores, putts: miniPutts, courses: countTop(mini.map((r) => r.Course)), winners: winners(mini), rounds: mini.length },
    discGolf: { tiles: discTiles, scores: discScores, outcomes: discOutcomes, cumulative: discCum, courses: countTop(disc.map((r) => r.Course)), winners: winners(disc), rounds: disc.length },
  };
}
