import "server-only";
import { getStore } from "./store";
import { rowToRecord } from "./daily";
import { CLOSET, type ClosetItem } from "./schema/closet";
import type { ClosetKind } from "./schema/types";

/** Adding pieces to the Virtual Closet from the app: the form spec (columns + suggestions) and the append. */

export interface ClosetColumn {
  /** Closet sheet column (e.g. "Shirt Color Primary"). */
  key: string;
  /** Short label without the kind prefix ("Color Primary"). */
  label: string;
  /** select = pick from the list (short color family); suggest = free text with suggestions. */
  type: "select" | "suggest";
  required: boolean;
  /** Existing values, most common first. */
  options: string[];
}

export interface ClosetKindForm { kind: ClosetKind; columns: ClosetColumn[]; nextId: string; }

const SHORT_FAMILIES: [RegExp, string][] = [
  [/green|lime|olive|eucalyptus|pistachio|mint|emerald|seafoam|nyanza|sage|fern|moss|teal|jungle|hunter|forest|kelly|army|cadmium/i, "Green"],
  [/blue|navy|cyan|cerulean|cornflour|royal/i, "Blue"],
  [/black/i, "Black"], [/white|cream|ivory/i, "White"], [/gr[ae]y|silver|charcoal/i, "Gray"],
  [/brown|tan|khaki|beige|camel/i, "Brown"], [/red|crimson|maroon|burgundy/i, "Red"],
  [/purple|violet|lavender|magenta/i, "Purple"], [/yellow|gold/i, "Yellow"], [/orange/i, "Orange"], [/pink/i, "Pink"],
];

/** Guess the short color family ("Green", "Blue"…) from a primary color name. */
export function shortColorFor(primary: string): string {
  for (const [re, fam] of SHORT_FAMILIES) if (re.test(primary)) return fam;
  return "";
}

function ranked(values: string[]): string[] {
  const m = new Map<string, number>();
  for (const v of values) { const t = v.trim(); if (t) m.set(t, (m.get(t) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
}

function nextId(ids: string[]): string {
  return String(ids.reduce((max, id) => Math.max(max, Number.parseInt(id, 10) || 0), 0) + 1);
}

/** Form specs for all six kinds in one round trip. */
export async function closetForms(): Promise<ClosetKindForm[]> {
  const store = getStore();
  const kinds = Object.keys(CLOSET) as ClosetKind[];
  const sheets = await store.readMany("closet", kinds.map((k) => CLOSET[k].sheet));
  return kinds.map((kind, i) => {
    const cfg = CLOSET[kind], data = sheets[i];
    const recs = data.rows.map((r) => rowToRecord(data, r)).filter((r) => (r[cfg.idCol] ?? "").trim());
    const columns: ClosetColumn[] = Object.values(cfg.map).map((key) => {
      const label = key.replace(/^\S+\s+/, "");
      const isShort = label === "Color Short";
      return { key, label, type: isShort ? "select" : "suggest", required: label === "Color Primary" || isShort, options: ranked(recs.map((r) => r[key] ?? "")) };
    });
    return { kind, columns, nextId: nextId(recs.map((r) => r[cfg.idCol])) };
  });
}

/** Append a piece to its closet tab; values are keyed by CLOSET sheet column. Returns the new picker item. */
export async function addClosetItem(kind: ClosetKind, values: Record<string, string>): Promise<ClosetItem> {
  const cfg = CLOSET[kind];
  const allowed = new Set(Object.values(cfg.map));
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) if (allowed.has(k) && typeof v === "string" && v.trim()) clean[k] = v.trim();

  const col = (suffix: string) => Object.keys(clean).find((k) => k.endsWith(suffix));
  const primaryKey = Object.values(cfg.map).find((k) => k.endsWith("Color Primary"))!;
  const shortKey = Object.values(cfg.map).find((k) => k.endsWith("Color Short"))!;
  if (!clean[primaryKey]) throw new Error(`${primaryKey} is required`);
  if (!col("Color Short")) {
    const guess = shortColorFor(clean[primaryKey]);
    if (!guess) throw new Error(`${shortKey} is required (couldn't guess a family for "${clean[primaryKey]}")`);
    clean[shortKey] = guess;
  }

  const store = getStore();
  const data = await store.read("closet", cfg.sheet);
  if (!data.header.includes(cfg.idCol)) throw new Error(`${cfg.sheet} sheet has no ${cfg.idCol} column`);
  const id = nextId(data.rows.map((r) => rowToRecord(data, r)[cfg.idCol] ?? ""));
  await store.append("closet", cfg.sheet, { [cfg.idCol]: id, ...clean });

  const dailyValues: Record<string, string> = {};
  for (const [dailyCol, closetCol] of Object.entries(cfg.map)) dailyValues[dailyCol] = clean[closetCol] ?? "";
  const label = cfg.labelCols.map((c) => clean[c]).filter(Boolean).join(" · ");
  return { id, label, values: dailyValues };
}
