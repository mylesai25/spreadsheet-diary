import "server-only";
import { getStore, type SheetData } from "./store";
import { todayISO } from "./dates";
import { ACTIVITY_BY_SLUG, inferType, ratingMax, type ActivityConfig } from "./schema/activities";
import type { Field } from "./schema/types";
import { rowToRecord } from "./daily";

export interface ActivityField extends Field { options?: string[] }

export interface ActivityPageData {
  config: ActivityConfig;
  header: string[];
  /** Field specs per column group (single group for plain sheets). */
  groups: { title: string; fields: ActivityField[] }[];
  /** Most recent entries first. */
  recent: Record<string, string>[];
  total: number;
  today: string;
  storeKind: "sheets" | "csv";
}

function buildField(h: string, values: string[], cfg: ActivityConfig): ActivityField {
  const type = cfg.types?.[h] ?? inferType(h, values);
  const f: ActivityField = { key: h, type };
  if (type === "rating") { f.min = 1; f.max = ratingMax(h); }
  if (type === "select" || type === "multi") {
    const counts = new Map<string, number>();
    for (const v of values) for (const t of type === "multi" ? v.split(",").map((s) => s.trim()) : [v]) if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    f.options = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
  }
  if (type === "number" && /minutes|hrs|hours/i.test(h)) f.min = 0;
  return f;
}

export async function loadActivity(slug: string): Promise<ActivityPageData | null> {
  const cfg = ACTIVITY_BY_SLUG[slug];
  if (!cfg) return null;
  const store = getStore();
  const data = await store.read("journal", cfg.sheet);
  const col = (h: string) => data.header.indexOf(h);
  const colValues = (h: string) => data.rows.map((r) => r[col(h)] ?? "").filter((v) => v.trim() !== "");

  const groups = (cfg.columnGroups ?? [{ title: cfg.title, cols: data.header }]).map((g) => ({
    title: g.title,
    fields: g.cols.filter((h) => col(h) >= 0).map((h) => buildField(h, colValues(h), cfg)),
  }));

  let recs = data.rows.map((r) => rowToRecord(data, r)).filter((r) => Object.values(r).some((v) => v !== ""));
  if (cfg.dateKey) recs = recs.sort((a, b) => (a[cfg.dateKey!] > b[cfg.dateKey!] ? -1 : 1));
  else recs = recs.reverse();

  return { config: cfg, header: data.header, groups, recent: recs.slice(0, 20), total: recs.length, today: todayISO(), storeKind: store.kind };
}

/** Append an entry. For column-group sheets, writes into the first empty row of that group. */
export async function saveActivity(slug: string, values: Record<string, string>, groupIndex = 0): Promise<void> {
  const cfg = ACTIVITY_BY_SLUG[slug];
  if (!cfg) throw new Error(`Unknown activity ${slug}`);
  const store = getStore();
  const data = await store.read("journal", cfg.sheet);
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) if (data.header.includes(k) && v != null) clean[k] = v;
  if (!Object.values(clean).some((v) => v.trim() !== "")) throw new Error("Nothing to save");
  if (cfg.dateKey && !clean[cfg.dateKey]) throw new Error("Date is required");

  if (cfg.columnGroups) {
    const group = cfg.columnGroups[groupIndex];
    if (!group) throw new Error("Unknown group");
    const first = data.header.indexOf(group.cols[0]);
    const idx = data.rows.findIndex((r) => (r[first] ?? "") === "");
    const rowNumber = (idx < 0 ? data.rows.length : idx) + 2;
    const scoped: Record<string, string> = {};
    for (const c of group.cols) if (clean[c] !== undefined) scoped[c] = clean[c];
    await store.updateCells("journal", cfg.sheet, rowNumber, scoped);
  } else {
    await store.append("journal", cfg.sheet, clean);
  }
}

export type { SheetData };
