import "server-only";
import { DAILY_SHEET, getStore, type SheetData } from "./store";
import { addDays, isoToSerial, isValidISODate } from "./dates";
import { DAILY_AUTO_COLUMNS, DAILY_FIELDS } from "./schema/daily";
import { CLOSET, type ClosetItem, type ClosetItems } from "./schema/closet";
import { claudeOutfitsEnabled, suggestOutfitsWithClaude } from "./outfitsClaude";
import type { ClosetKind } from "./schema/types";
import { getDayWeather, weatherToColumns } from "./weather";
import { suggestOutfits, type OutfitOptions, type OutfitSuggestions } from "./outfits";

export interface DailyPageData {
  date: string;
  /** Sheet row number for this date, or null if the sheet has no row yet. */
  rowNumber: number | null;
  /** Current cell values keyed by header (all columns, including auto ones). */
  values: Record<string, string>;
  /** Suggested values for empty fields, keyed by header. */
  defaults: Record<string, string>;
  /** Most recent logged day's values (for "copy yesterday"). */
  prev: Record<string, string>;
  prevDate: string | null;
  /** Suggestion lists for select / multi fields. */
  options: Record<string, string[]>;
  /** Closet pickers, or null when the caller fetches them separately from /api/closet. */
  closet: ClosetItems | null;
  isLogged: boolean;
  /** ISO dates that have an entry, ascending. */
  loggedDates: string[];
  storeKind: "sheets" | "csv";
  /** Where the prefilled weather came from (or why it couldn't be fetched). */
  weatherNote: string | null;
  /** Weather-aware outfit ideas from your own history. */
  outfits: OutfitSuggestions;
}

const LOGGED_IGNORE = new Set([...DAILY_AUTO_COLUMNS]);

export function rowToRecord(data: SheetData, row: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  data.header.forEach((h, i) => { out[h] = row[i] ?? ""; });
  return out;
}

/** A pre-created date row counts as logged once anything beyond the auto columns (and default-FALSE checkboxes) is filled. */
export function isLoggedRow(data: SheetData, row: string[]): boolean {
  return data.header.some((h, i) => !LOGGED_IGNORE.has(h) && row[i] !== "" && row[i] !== "FALSE" && row[i] !== undefined);
}

export function findDateRow(data: SheetData, date: string): number | null {
  const c = data.header.indexOf("Date");
  if (c < 0) return null;
  const i = data.rows.findIndex((r) => r[c] === date);
  return i < 0 ? null : i + 2;
}

function mode(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) if (v !== "") counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = "", n = 0;
  for (const [v, c] of counts) if (c > n) { best = v; n = c; }
  return best;
}

function splitMulti(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function loadDaily(date: string, { closet: includeCloset = true }: { closet?: boolean } = {}): Promise<DailyPageData> {
  const store = getStore();
  const closetP = loadCloset();                       // runs alongside the journal read and the weather lookup
  const data = await store.read("journal", DAILY_SHEET);
  const dateCol = data.header.indexOf("Date");

  const rowNumber = findDateRow(data, date);
  const row = rowNumber ? data.rows[rowNumber - 2] : data.header.map(() => "");
  const values = rowToRecord(data, row);
  if (!rowNumber) Object.assign(values, autoColumns(date));

  const logged = data.rows
    .map((r, i) => ({ r, date: r[dateCol], n: i + 2 }))
    .filter((x) => x.date && isLoggedRow(data, x.r));
  const loggedDates = logged.map((x) => x.date).sort();

  const before = logged.filter((x) => x.date < date).sort((a, b) => (a.date < b.date ? -1 : 1));
  const recent = before.slice(-30).map((x) => rowToRecord(data, x.r));
  const prevRec = before.length ? rowToRecord(data, before[before.length - 1].r) : {};

  const defaults: Record<string, string> = {};
  for (const f of DAILY_FIELDS) {
    if (f.default === "prev") defaults[f.key] = prevRec[f.key] ?? "";
    else if (f.default === "mode") defaults[f.key] = mode(recent.map((r) => r[f.key] ?? ""));
    else if (f.default !== undefined) defaults[f.key] = f.default;
    else if (f.type === "bool") defaults[f.key] = "FALSE";
  }

  // Weather for an unlogged day: where you slept last night (= where you woke up today).
  let weatherNote: string | null = null;
  const loggedToday = rowNumber ? isLoggedRow(data, row) : false;
  if (!loggedToday) {
    const city = prevRec["Sleep City"] ?? "", state = prevRec["Sleep State"], country = prevRec["Sleep Country"];
    if (city) {
      try {
        const w = await getDayWeather(date, city, state, country, defaults["Wake Up Time"] || "08:00");
        if (w) { Object.assign(defaults, weatherToColumns(w)); weatherNote = `Weather for ${w.place} from Open-Meteo`; }
        else weatherNote = `Couldn't find weather for ${city}`;
      } catch (e) {
        weatherNote = `Weather unavailable (${e instanceof Error ? e.message : "network"})`;
      }
    }
  }

  const options: Record<string, string[]> = {};
  const allLogged = logged.map((x) => rowToRecord(data, x.r));
  for (const f of DAILY_FIELDS) {
    if (f.type !== "select" && f.type !== "multi") continue;
    const counts = new Map<string, number>();
    for (const r of allLogged) {
      const v = r[f.key] ?? "";
      for (const t of f.type === "multi" ? splitMulti(v) : v ? [v] : []) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    options[f.key] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
  }

  const closet = await closetP;
  const eff = (k: string) => values[k] || defaults[k] || "";
  const toNum = (v: string) => (v === "" || Number.isNaN(Number(v)) ? null : Number(v));
  // Instant history-based picks; when Claude is configured the clients ask for its ideas right after rendering.
  const outfits = { ...suggestOutfits(date, { feelsLike: toNum(eff("Feels Like (F)")), high: toNum(eff("High Temperature (F)")), sky: eff("Sky") }, allLogged, closet), claudeAvailable: claudeOutfitsEnabled() };

  return {
    date, rowNumber, values, defaults, prev: prevRec,
    prevDate: before.length ? before[before.length - 1].date : null,
    options, closet: includeCloset ? closet : null, isLogged: loggedToday,
    loggedDates, storeKind: store.kind, weatherNote, outfits,
  };
}

export async function loadCloset(): Promise<ClosetItems> {
  const store = getStore();
  const out = {} as ClosetItems;
  const kinds = Object.keys(CLOSET) as ClosetKind[];
  const sheets = await store.readMany("closet", kinds.map((k) => CLOSET[k].sheet));   // one Sheets round trip for all six tabs
  kinds.forEach((kind, i) => {
    const cfg = CLOSET[kind];
    const data = sheets[i];
    const items: ClosetItem[] = [];
    for (const row of data.rows) {
      const rec = rowToRecord(data, row);
      const id = rec[cfg.idCol];
      if (!id) continue;
      const values: Record<string, string> = {};
      for (const [dailyCol, closetCol] of Object.entries(cfg.map)) values[dailyCol] = rec[closetCol] ?? "";
      const label = cfg.labelCols.map((c) => rec[c]).filter(Boolean).join(" · ");
      items.push({ id, label, values });
    }
    out[kind] = items;
  });
  return out;
}

function autoColumns(date: string): Record<string, string> {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const jan1 = `${y}-01-01`;
  const week = Math.floor((isoToSerial(date) - isoToSerial(jan1) + new Date(Date.UTC(y, 0, 1)).getUTCDay()) / 7) + 1;
  return {
    Date: date,
    Day: dt.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
    Week: String(week),
    Month: dt.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }),
  };
}

/** Recompute outfit ideas for a date with explicit weather (after the user edits/refreshes it). */
export async function outfitsFor(date: string, weather: { feelsLike: number | null; high: number | null; sky: string }, opts: OutfitOptions = {}): Promise<OutfitSuggestions> {
  const store = getStore();
  const data = await store.read("journal", DAILY_SHEET);
  const dateCol = data.header.indexOf("Date");
  const logged = data.rows.filter((r) => r[dateCol] && isLoggedRow(data, r)).map((r) => rowToRecord(data, r));
  const closet = await loadCloset();
  return claudeOutfitsEnabled() ? suggestOutfitsWithClaude(date, weather, logged, closet, opts) : suggestOutfits(date, weather, logged, closet, opts);
}

/** Persist changed cells for a date. Creates the date row if the sheet lacks one. */
export async function saveDaily(date: string, changes: Record<string, string>): Promise<void> {
  if (!isValidISODate(date)) throw new Error(`Bad date: ${date}`);
  const store = getStore();
  const data = await store.read("journal", DAILY_SHEET);
  const allowed = new Set(data.header.filter((h) => !DAILY_AUTO_COLUMNS.includes(h)));
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(changes)) if (allowed.has(k)) clean[k] = v ?? "";

  const rowNumber = findDateRow(data, date);
  if (rowNumber) {
    await store.updateCells("journal", DAILY_SHEET, rowNumber, clean);
  } else {
    await store.append("journal", DAILY_SHEET, { ...autoColumns(date), ...clean });
  }
}

export { addDays };
