import "server-only";
import { DAILY_SHEET, getStore } from "./store";
import { isLoggedRow, loadCloset, rowToRecord } from "./daily";
import { CLOSET, type ClosetItem } from "./schema/closet";
import type { ClosetKind } from "./schema/types";
import type { Count, Tile } from "./metrics";

/** Virtual Closet composition (how green is it?) plus how much of it actually gets worn this year. */

export interface ClosetKindStats {
  kind: ClosetKind;
  label: string;
  total: number;
  /** Items whose short color is Green. */
  green: number;
  greenPct: number;
  /** Items with green anywhere (primary or secondary color). */
  anyGreen: number;
  anyGreenPct: number;
  wornThisYear: number;
  wornPct: number;
  types: Count[];
}

export interface ClosetStats {
  year: string;
  total: number;
  green: number;
  greenPct: number;
  anyGreen: number;
  anyGreenPct: number;
  wornThisYear: number;
  wornPct: number;
  tiles: Tile[];
  kinds: ClosetKindStats[];
  /** Short color of every item (Green, Black, Blue…). */
  colorFamilies: Count[];
  /** Primary color of the green items (Lime Green, Forest Green…). */
  greenShades: Count[];
  /** Secondary colors that appear on green items — what green gets paired with. */
  greenAccents: Count[];
  brands: Count[];
  /** Pieces worn on the most days this year. */
  mostWorn: Count[];
  storeKind: "sheets" | "csv";
}

const KIND_LABEL: Record<ClosetKind, string> = { shirt: "Shirts", pants: "Pants", shoes: "Shoes", socks: "Socks", hat: "Hats", jacket: "Jackets" };
const GREEN = /green|lime|olive|eucalyptus|pistachio|mint|emerald|seafoam|nyanza|sage|fern|moss|teal|jungle|hunter|forest|kelly/i;

function col(it: ClosetItem, suffix: string): string {
  return (Object.entries(it.values).find(([k]) => k.endsWith(suffix))?.[1] ?? "").trim();
}
const isGreen = (it: ClosetItem) => col(it, "Color Short") === "Green";
const hasGreen = (it: ClosetItem) => isGreen(it) || GREEN.test(col(it, "Color Primary")) || GREEN.test(col(it, "Color Secondary"));
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

function top(values: string[], n: number): Count[] {
  const m = new Map<string, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([name, value]) => ({ name, value }));
}

export async function buildClosetStats(): Promise<ClosetStats> {
  const store = getStore();
  const [closet, daily] = await Promise.all([loadCloset(), store.read("journal", DAILY_SHEET)]);
  const year = String(new Date().getFullYear());

  // Days worn per piece this year.
  const days = new Map<string, number>();
  for (const r of daily.rows) {
    if (!isLoggedRow(daily, r)) continue;
    const rec = rowToRecord(daily, r);
    for (const kind of Object.keys(CLOSET) as ClosetKind[]) {
      const gate = kind === "hat" ? "Hat?" : kind === "jacket" ? "Jacket?" : null;
      if (gate && rec[gate] !== "TRUE") continue;
      const id = (rec[CLOSET[kind].idCol] ?? "").trim();
      if (id) days.set(`${kind}:${id}`, (days.get(`${kind}:${id}`) ?? 0) + 1);
    }
  }

  const kinds: ClosetKindStats[] = (Object.keys(CLOSET) as ClosetKind[]).map((kind) => {
    const items = closet[kind] ?? [];
    const green = items.filter(isGreen).length, anyGreen = items.filter(hasGreen).length;
    const worn = items.filter((it) => days.has(`${kind}:${it.id}`)).length;
    return {
      kind, label: KIND_LABEL[kind], total: items.length,
      green, greenPct: pct(green, items.length), anyGreen, anyGreenPct: pct(anyGreen, items.length),
      wornThisYear: worn, wornPct: pct(worn, items.length),
      types: top(items.map((it) => col(it, " Type")), 6),
    };
  });

  const all = (Object.keys(CLOSET) as ClosetKind[]).flatMap((k) => (closet[k] ?? []).map((it) => ({ kind: k, it })));
  const total = all.length;
  const green = all.filter((x) => isGreen(x.it)).length;
  const anyGreen = all.filter((x) => hasGreen(x.it)).length;
  const worn = all.filter((x) => days.has(`${x.kind}:${x.it.id}`)).length;
  const greenItems = all.filter((x) => isGreen(x.it)).map((x) => x.it);

  // Top two pieces per kind by days worn (otherwise daily-wear shoes fill the list and shirts never appear).
  const perKind = new Map<string, number>();
  const mostWorn = [...days.entries()].sort((a, b) => b[1] - a[1]).filter(([key]) => {
    const kind = key.split(":")[0];
    const n = perKind.get(kind) ?? 0;
    perKind.set(kind, n + 1);
    return n < 2;
  }).map(([key, value]) => {
    const [kind, id] = key.split(":") as [ClosetKind, string];
    const item = (closet[kind] ?? []).find((c) => c.id === id);
    return { name: `${KIND_LABEL[kind].replace(/s$/, "")} #${id}${item ? ` · ${item.label.split(" · ").slice(0, 2).join(" ")}` : ""}`, value };
  });

  const tiles: Tile[] = [
    { label: "Pieces in the closet", value: String(total), sub: kinds.map((k) => `${k.total} ${k.label.toLowerCase()}`).join(" · ") },
    { label: "Green pieces", value: `${pct(green, total)}%`, sub: `${green} of ${total} are green` },
    { label: "Have some green", value: `${pct(anyGreen, total)}%`, sub: `${anyGreen} with green as a main or accent color` },
    { label: `Worn in ${year}`, value: `${pct(worn, total)}%`, sub: `${worn} pieces · ${total - worn} untouched so far` },
  ];

  return {
    year, total, green, greenPct: pct(green, total), anyGreen, anyGreenPct: pct(anyGreen, total), wornThisYear: worn, wornPct: pct(worn, total),
    tiles, kinds,
    colorFamilies: top(all.map((x) => col(x.it, "Color Short")), 10),
    greenShades: top(greenItems.map((it) => col(it, "Color Primary")), 12),
    greenAccents: top(greenItems.map((it) => col(it, "Color Secondary")), 8),
    brands: top(all.map((x) => col(x.it, " Brand")), 12),
    mostWorn,
    storeKind: store.kind,
  };
}
