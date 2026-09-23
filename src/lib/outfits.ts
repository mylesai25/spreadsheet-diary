import type { ClosetItems } from "./schema/closet";
import type { ClosetKind } from "./schema/types";
import { isoToSerial } from "./dates";

/** Weather-aware outfit suggestions built purely from the diary's own history. */

export interface OutfitWeather { feelsLike: number | null; high: number | null; sky: string }

export interface OutfitPiece {
  slot: ClosetKind;
  id: string;
  label: string;
  /** Values keyed by Daily Overview column, ready to write into the form. */
  values: Record<string, string>;
  /** Short reason, e.g. "worn 6× on days like this · last worn 38 days ago". */
  why: string;
}

export interface OutfitSuggestion { title: string; tagline: string; pieces: OutfitPiece[] }

export interface SimilarDay { date: string; feelsLike: number | null; sky: string; summary: string }

export interface OutfitOptions {
  /** slot:id keys already shown — pushed down so the next round looks different. */
  seen?: string[];
  /** Round number; drives a deterministic shuffle. 0 = plain ranking. */
  seed?: number;
}

export interface OutfitSuggestions {
  weather: OutfitWeather;
  /** Weekday for the date, e.g. "Tuesday". */
  weekday: string;
  /** Detected weekday habits, e.g. "Blue shirts on Tuesdays (89%)". */
  habits: string[];
  /** slot:id keys of every piece in these outfits (feed back as `seen` for the next round). */
  shownKeys: string[];
  round: number;
  similarDays: number;
  jacketShare: number;
  hatShare: number;
  outfits: OutfitSuggestion[];
  examples: SimilarDay[];
  note: string | null;
}

type Rec = Record<string, string>;

const SLOTS: { kind: ClosetKind; idCol: string; colorCol: string; noun: string; cols: string[]; gate?: string }[] = [
  { kind: "shirt", idCol: "Shirt ID", colorCol: "Shirt Color Short", noun: "shirts", cols: ["Shirt Type", "Shirt Color Primary", "Shirt Color Secondary", "Shirt Company", "Shirt Design", "Shirt Color Short"] },
  { kind: "pants", idCol: "Pants ID", colorCol: "Pants Color Short", noun: "pants", cols: ["Pants Type", "Pants Color Primary", "Pants Color Secondary", "Pants Brand", "Pants Design", "Pants Color Short"] },
  { kind: "shoes", idCol: "Shoe ID", colorCol: "Shoe Color Short", noun: "shoes", cols: ["Shoe Type", "Shoe Color Primary", "Shoe Color Secondary", "Shoe Brand", "Shoe Design", "Shoe Color Short"] },
  { kind: "socks", idCol: "Sock ID", colorCol: "Sock Color Short", noun: "socks", cols: ["Sock Color Primary", "Sock Color Secondary", "Sock Company", "Sock Design", "Sock Color Short"] },
  { kind: "hat", idCol: "Hat ID", colorCol: "Hat Color Short", noun: "hats", cols: ["Hat Type", "Hat Color Primary", "Hat Color Secondary", "Hat Company", "Hat Design", "Hat Color Short"], gate: "Hat?" },
  { kind: "jacket", idCol: "Jacket ID", colorCol: "Jacket Color Short", noun: "jackets", cols: ["Jacket Type", "Jacket Color Primary", "Jacket Color Secondary", "Jacket Company", "Jacket Design", "Jacket Color Short"], gate: "Jacket?" },
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** How much more (or less) likely each color is on this weekday vs. overall, per slot: P(color | weekday) / P(color). */
function weekdayColorLift(history: Rec[], weekday: string) {
  const out = new Map<ClosetKind, { lift: Map<string, number>; top: { color: string; share: number; lift: number } | null }>();
  for (const s of SLOTS) {
    const all = new Map<string, number>(), day = new Map<string, number>();
    let nAll = 0, nDay = 0;
    for (const r of history) {
      const c = (r[s.colorCol] ?? "").trim();
      if (!c) continue;
      all.set(c, (all.get(c) ?? 0) + 1); nAll++;
      if (r.Day === weekday) { day.set(c, (day.get(c) ?? 0) + 1); nDay++; }
    }
    const lift = new Map<string, number>();
    let top: { color: string; share: number; lift: number } | null = null;
    if (nDay >= 8) {
      for (const [c, n] of all) {
        const pAll = n / nAll, pDay = (day.get(c) ?? 0) / nDay;
        const l = pAll ? pDay / pAll : 1;
        lift.set(c, l);
        if (!top || pDay > top.share) top = { color: c, share: pDay, lift: l };
      }
    }
    out.set(s.kind, { lift, top });
  }
  return out;
}

const WET = new Set(["Rain", "Snow", "Sleet", "Hail"]);
const num = (v?: string) => { const n = Number(v); return v != null && v !== "" && Number.isFinite(n) ? n : null; };

function dayOfYear(iso: string) { return isoToSerial(iso) - isoToSerial(`${iso.slice(0, 4)}-01-01`); }

/** Freshness multiplier: strongly avoid things worn in the last week, mildly avoid the last month. */
function freshness(daysSince: number | null): number {
  if (daysSince == null) return 0.9;              // never worn (this year): worth a try
  if (daysSince < 4) return 0.05;
  if (daysSince < 10) return 0.25;
  if (daysSince < 21) return 0.55;
  if (daysSince < 45) return 0.85;
  return 1.1;
}

/** Small deterministic hash → [0, 1). */
function jitter(seed: number, key: string): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

export function suggestOutfits(date: string, weather: OutfitWeather, rows: Rec[], closet: ClosetItems, opts: OutfitOptions = {}): OutfitSuggestions {
  const seen = new Set(opts.seen ?? []);
  const seed = opts.seed ?? 0;
  const history = rows.filter((r) => r.Date && r.Date < date && (r["Shirt ID"] || r["Pants ID"]));
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  const colorLift = weekdayColorLift(history, weekday);
  const habits = SLOTS.flatMap((s) => {
    const t = colorLift.get(s.kind)?.top;
    return t && t.share >= 0.6 && t.lift >= 1.25 ? [`${t.color} ${s.noun} on ${weekday}s (${Math.round(t.share * 100)}%)`] : [];
  });
  const feels = weather.feelsLike ?? (weather.high != null ? weather.high - 8 : null);
  const wet = WET.has(weather.sky);
  const today = isoToSerial(date);
  const doy = dayOfYear(date);

  if (!history.length || feels == null) {
    return { weather, weekday, habits, shownKeys: [], round: seed, similarDays: 0, jacketShare: 0, hatShare: 0, outfits: [], examples: [], note: feels == null ? "Fill in the weather (or tap Get weather) to get outfit ideas." : "Not enough outfit history yet." };
  }

  // Similar days: tighten the temperature band until we have a reasonable sample.
  let band = 5, similar: { r: Rec; w: number }[] = [];
  for (; band <= 20 && similar.length < 20; band += 5) {
    similar = history.flatMap((r) => {
      const f = num(r["Feels Like (F)"]) ?? (num(r["High Temperature (F)"]) != null ? num(r["High Temperature (F)"])! - 8 : null);
      if (f == null || Math.abs(f - feels) > band) return [];
      let w = 1 - Math.abs(f - feels) / (band + 5);                 // closer temperature → more weight
      if (WET.has(r.Sky) === wet) w *= 1.5;                          // same wet/dry class
      const dd = Math.abs(dayOfYear(r.Date) - doy);
      if (Math.min(dd, 366 - dd) <= 45) w *= 1.3;                    // same season
      return [{ r, w }];
    });
  }
  const totalW = similar.reduce((a, s) => a + s.w, 0) || 1;
  const share = (gate: string) => similar.reduce((a, s) => a + (s.r[gate] === "TRUE" ? s.w : 0), 0) / totalW;
  const jacketShare = share("Jacket?"), hatShare = share("Hat?");

  // How often socks go with each shoe type (sandals/slippers → usually none).
  const sockByShoe = new Map<string, { n: number; socks: number }>();
  let sockAllN = 0, sockAllYes = 0;
  for (const r of history) {
    const t = (r["Shoe Type"] ?? "").trim();
    const hasSocks = Boolean((r["Sock ID"] ?? "").trim() || (r["Sock Color Primary"] ?? "").trim());
    sockAllN++; if (hasSocks) sockAllYes++;
    if (!t) continue;
    const e = sockByShoe.get(t) ?? { n: 0, socks: 0 };
    e.n++; if (hasSocks) e.socks++; sockByShoe.set(t, e);
  }
  const sockShareFor = (shoeType: string) => { const e = sockByShoe.get(shoeType); return e && e.n >= 5 ? e.socks / e.n : sockAllN ? sockAllYes / sockAllN : 1; };

  // Last-worn lookup per slot/id (across all history, not just similar days).
  const lastWorn = new Map<string, number>();
  for (const r of history) for (const s of SLOTS) { const id = r[s.idCol]; if (id) { const k = `${s.kind}:${id}`; const d = isoToSerial(r.Date); if ((lastWorn.get(k) ?? -1) < d) lastWorn.set(k, d); } }

  // Score candidates per slot.
  type Cand = { piece: OutfitPiece; score: number; timesSimilar: number; daysSince: number | null };
  const perSlot = new Map<ClosetKind, Cand[]>();
  for (const s of SLOTS) {
    const scores = new Map<string, { w: number; n: number; sample: Rec }>();
    for (const { r, w } of similar) {
      if (s.gate && r[s.gate] !== "TRUE") continue;
      const id = r[s.idCol];
      if (!id) continue;
      const e = scores.get(id) ?? { w: 0, n: 0, sample: r };
      e.w += w; e.n += 1; scores.set(id, e);
    }
    // Closet items never worn on similar days still get a small exploration score when the slot is thin —
    // or when they match a strong weekday color habit (so "blue shirts on Tuesdays" has enough blue shirts to pick from).
    const closetItems = closet[s.kind] ?? [];
    const habitTop = colorLift.get(s.kind)?.top;
    const habitColor = habitTop && habitTop.share >= 0.6 && habitTop.lift >= 1.25 ? habitTop.color : null;
    for (const it of closetItems) {
      if (scores.has(it.id)) continue;
      const matchesHabit = habitColor != null && (it.values[s.colorCol] ?? "").trim() === habitColor;
      if (scores.size < 6 || matchesHabit) scores.set(it.id, { w: matchesHabit ? 0.3 : 0.15, n: 0, sample: {} });
    }

    const cands: Cand[] = [];
    for (const [id, e] of scores) {
      const last = lastWorn.get(`${s.kind}:${id}`);
      const daysSince = last == null ? null : today - last;
      const item = closetItems.find((c) => c.id === id);
      const values: Record<string, string> = item ? { ...item.values } : Object.fromEntries(s.cols.map((c) => [c, e.sample[c] ?? ""]));
      values[s.idCol] = id;
      const label = item?.label ?? s.cols.slice(0, 2).map((c) => e.sample[c]).filter(Boolean).join(" ") ?? `#${id}`;
      const whyParts = [e.n ? `worn ${e.n}× on days like this` : "not tried in this weather yet", daysSince == null ? "not worn this year" : daysSince === 0 ? "worn today" : `last worn ${daysSince}d ago`];
      const key = `${s.kind}:${id}`;
      let score = e.w * freshness(daysSince);
      const color = (values[s.colorCol] ?? "").trim();
      const lift = color ? colorLift.get(s.kind)?.lift.get(color) : undefined;
      if (lift != null) {
        score *= Math.min(3, Math.max(0.15, lift));                  // weekday color habit (e.g. blue shirts on Tuesdays)
        if (lift >= 1.25) whyParts.push(`your ${weekday} color`);
        else if (lift <= 0.4) whyParts.push(`rare for a ${weekday}`);
      }
      if (seen.has(key)) score *= 0.2;                              // already suggested this session
      if (seed) score *= 0.7 + 0.6 * jitter(seed, key);            // reshuffle among the plausible picks
      cands.push({ piece: { slot: s.kind, id, label, values, why: whyParts.join(" · ") }, score, timesSimilar: e.n, daysSince });
    }
    cands.sort((a, b) => b.score - a.score);
    perSlot.set(s.kind, cands);
  }

  // Optional layers only when you usually wear them in this situation — never by default.
  const includeJacket = jacketShare >= 0.6 || feels < 45;
  const includeHat = hatShare >= 0.6;
  const core: ClosetKind[] = ["shirt", "pants", "shoes", ...(includeHat ? ["hat" as const] : []), ...(includeJacket ? ["jacket" as const] : [])];

  const pick = (kind: ClosetKind, rank: number, used: Set<string>, prefer?: (c: Cand) => number): OutfitPiece | null => {
    const list = perSlot.get(kind) ?? [];
    const ordered = prefer ? [...list].sort((a, b) => prefer(b) - prefer(a)) : list;
    const avail = ordered.filter((c) => !used.has(`${kind}:${c.piece.id}`));
    const c = avail[Math.min(rank, avail.length - 1)];
    if (!c) return null;
    used.add(`${kind}:${c.piece.id}`);
    return c.piece;
  };

  const used = new Set<string>();
  const build = (title: string, tagline: string, rank: number, prefer?: (c: Cand) => number): OutfitSuggestion | null => {
    const pieces = core.map((k) => pick(k, rank, used, prefer)).filter((p): p is OutfitPiece => p != null);
    // Socks follow the shoes: skip them when you normally go without (sandals, slippers).
    const shoe = pieces.find((p) => p.slot === "shoes");
    const shoeType = shoe?.values["Shoe Type"] ?? "";
    if (!shoe || sockShareFor(shoeType) >= 0.5) {
      const socks = pick("socks", rank, used, prefer);
      if (socks) pieces.splice(pieces.findIndex((p) => p.slot === "shoes") + 1, 0, socks);
    }
    return pieces.some((p) => p.slot === "shirt") && pieces.some((p) => p.slot === "pants") ? { title, tagline, pieces } : null;
  };

  const outfits = [
    build("Most you", `What you reach for when it feels like ${Math.round(feels)}°${wet ? " and wet" : ""}`, 0),
    build("Solid alternate", "Next-best picks from the same kind of days", 0),
    build("Fresh rotation", "Weather-appropriate pieces you haven't worn in a while", 0, (c) => c.score * (c.daysSince == null ? 1.4 : c.daysSince >= 45 ? 1.3 : c.daysSince >= 21 ? 1 : 0.4)),
  ].filter((o): o is OutfitSuggestion => o != null);

  const examples: SimilarDay[] = [...similar].sort((a, b) => b.w - a.w).slice(0, 4).map(({ r }) => ({
    date: r.Date, feelsLike: num(r["Feels Like (F)"]), sky: r.Sky,
    summary: [r["Shirt Color Primary"], r["Shirt Type"], "+", r["Pants Color Primary"], r["Pants Type"], "+", r["Shoe Type"], r["Jacket?"] === "TRUE" ? `+ ${r["Jacket Type"] || "jacket"}` : ""].filter(Boolean).join(" "),
  }));

  const shownKeys = outfits.flatMap((o) => o.pieces.map((p) => `${p.slot}:${p.id}`));

  return {
    weather: { ...weather, feelsLike: feels }, weekday, habits, shownKeys, round: seed, similarDays: similar.length, jacketShare, hatShare, outfits, examples,
    note: similar.length < 8 ? `Only ${similar.length} past days felt like this — take these with a grain of salt.` : null,
  };
}

/** Form patch for "Wear this": item values + the Hat?/Jacket? flags + layers. */
export function outfitToPatch(o: OutfitSuggestion): Record<string, string> {
  const patch: Record<string, string> = {};
  for (const p of o.pieces) Object.assign(patch, p.values);
  const hasHat = o.pieces.some((p) => p.slot === "hat"), hasJacket = o.pieces.some((p) => p.slot === "jacket"), hasSocks = o.pieces.some((p) => p.slot === "socks");
  if (!hasSocks) for (const c of ["Sock ID", "Sock Color Primary", "Sock Color Secondary", "Sock Company", "Sock Design", "Sock Color Short"]) patch[c] = "";
  patch["Hat?"] = hasHat ? "TRUE" : "FALSE";
  patch["Jacket?"] = hasJacket ? "TRUE" : "FALSE";
  patch["Clothes Layers"] = hasJacket ? "2" : "1";
  if (!hasHat) for (const c of ["Hat ID", "Hat Type", "Hat Color Primary", "Hat Color Secondary", "Hat Company", "Hat Design", "Hat Color Short"]) patch[c] = "";
  if (!hasJacket) for (const c of ["Jacket ID", "Jacket Type", "Jacket Color Primary", "Jacket Color Secondary", "Jacket Company", "Jacket Design", "Jacket Color Short"]) patch[c] = "";
  return patch;
}
