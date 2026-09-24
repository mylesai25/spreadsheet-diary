import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CLOSET, type ClosetItems } from "./schema/closet";
import type { ClosetKind } from "./schema/types";
import { suggestOutfits, type OutfitOptions, type OutfitPiece, type OutfitSuggestion, type OutfitSuggestions, type OutfitWeather } from "./outfits";

/** Outfit ideas composed by Claude. The history engine in outfits.ts still does the number crunching
 *  (similar days, weekday habits, freshness, never-worn pieces); Claude reads those signals plus the
 *  whole closet and assembles the outfits. Falls back to the history engine's own picks on any failure. */

export const OUTFIT_MODEL = process.env.OUTFIT_MODEL || "claude-sonnet-5";

/** On when an Anthropic key is configured (set OUTFIT_LLM=off to force the history engine). */
export function claudeOutfitsEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.OUTFIT_LLM !== "off";
}

declare global {
  var __diaryAnthropic: Anthropic | undefined;
}
function client(): Anthropic {
  return (globalThis.__diaryAnthropic ??= new Anthropic({ timeout: 60_000, maxRetries: 1 }));
}

const SLOT_ORDER: ClosetKind[] = ["shirt", "pants", "shoes", "socks", "hat", "jacket"];
const TITLES = ["Most you", "Solid alternate", "Fresh rotation", "Something new"];

const OutfitPlan = z.object({
  outfits: z.array(z.object({
    title: z.string(),
    tagline: z.string(),
    pieces: z.array(z.object({
      slot: z.enum(["shirt", "pants", "shoes", "socks", "hat", "jacket"]),
      id: z.string(),
      why: z.string(),
    })),
  })),
});

const SYSTEM = `You are the personal stylist for one person, working only from their Virtual Closet and this year's outfit diary.
The closet is listed below; the user message carries today's weather and what the diary says about days like it.

Rules:
- Use only ids from the closet, in the slot they belong to. Never invent pieces.
- Every outfit needs a shirt, pants and shoes. Add socks unless the shoes are sandals, slippers or flip-flops, or the diary says they skip socks with that shoe type.
- Add a jacket or hat only when the user message says layers are usual for this weather (or it is genuinely cold).
- Respect the weekday color habit when one is given (e.g. blue shirts on Tuesdays); otherwise lean on the colors they wear most.
- Favor pieces not worn in the last few weeks. Never repeat a piece across the outfits, and avoid ids in the "already shown" list.
- Match the type of piece to the weather (no swim trunks or shorts on a cold day, no winter jacket on a warm one). Keep colors coherent.
- "Something new" must feature never-worn pieces that suit the weather; leave it out only if none fit.
- Output exactly the requested outfit titles in order. Taglines are one short line. Each piece's "why" is at most 12 words and cites diary evidence (e.g. "worn 5× on days like this, last 44d ago" or "never worn yet, your Wednesday green").`;

type Rec = Record<string, string>;

function closetText(closet: ClosetItems): string {
  const out: string[] = ["Virtual Closet (id — description (short color)):"];
  for (const kind of SLOT_ORDER) {
    const items = closet[kind] ?? [];
    if (!items.length) continue;
    out.push(`\n${kind.toUpperCase()} (${items.length})`);
    for (const it of items) {
      const short = Object.entries(it.values).find(([k]) => k.endsWith("Color Short"))?.[1] ?? "";
      out.push(`#${it.id} ${it.label}${short ? ` (${short.toLowerCase()})` : ""}`);
    }
  }
  return out.join("\n");
}

function contextText(date: string, base: OutfitSuggestions, rows: Rec[], closet: ClosetItems, neverWorn: Set<string>, opts: OutfitOptions): string {
  const w = base.weather;
  const feels = w.feelsLike != null ? Math.round(w.feelsLike) : null;
  const lines: string[] = [];
  lines.push(`Date: ${base.weekday} ${date}. Weather: feels like ${feels ?? "?"}°F, high ${w.high != null ? Math.round(w.high) : "?"}°F, ${w.sky || "sky unknown"}.`);
  const includeJacket = base.jacketShare >= 0.6 || (feels != null && feels < 45);
  lines.push(`Similar past days: ${base.similarDays}. Jacket worn on ${Math.round(base.jacketShare * 100)}% of them (${includeJacket ? "layers are usual — include a jacket" : "usually no jacket — skip it"}); hat on ${Math.round(base.hatShare * 100)}% (${base.hatShare >= 0.6 ? "include a hat" : "usually no hat — skip it"}).`);
  if (base.habits.length) lines.push(`${base.weekday} habit: ${base.habits.join("; ")}.`);
  if (base.note) lines.push(`Note: ${base.note}`);

  const history = rows.filter((r) => r.Date && r.Date < date && (r["Shirt ID"] || r["Pants ID"])).sort((a, b) => (a.Date < b.Date ? 1 : -1));
  lines.push("\nRecently worn (most recent first):");
  for (const r of history.slice(0, 12)) {
    const parts: string[] = [];
    for (const kind of SLOT_ORDER) {
      const gate = kind === "hat" ? "Hat?" : kind === "jacket" ? "Jacket?" : null;
      if (gate && r[gate] !== "TRUE") continue;
      const id = r[CLOSET[kind].idCol];
      if (id) parts.push(`${kind} #${id}`);
    }
    lines.push(`- ${r.Date} (${r.Day}, feels ${r["Feels Like (F)"] || "?"}°, ${r.Sky || "?"}): ${parts.join(", ")}`);
  }

  if (base.examples.length) {
    lines.push("\nWhat they wore on the most similar days:");
    for (const e of base.examples) lines.push(`- ${e.date}${e.feelsLike != null ? ` · ${e.feelsLike}°` : ""}${e.sky ? ` ${e.sky}` : ""}: ${e.summary}`);
  }

  lines.push("\nDiary-ranked candidates per slot (best first, with evidence):");
  for (const kind of SLOT_ORDER) {
    const c = base.candidates?.[kind];
    if (!c?.length) continue;
    lines.push(`${kind}: ${c.map((x) => `#${x.id} (${x.why})`).join("; ")}`);
  }

  lines.push("\nNever worn yet this year (newest first, judge weather fit from the closet description):");
  for (const kind of SLOT_ORDER) {
    const ids = (closet[kind] ?? []).filter((it) => neverWorn.has(`${kind}:${it.id}`)).map((it) => it.id).reverse().slice(0, 10);
    if (ids.length) lines.push(`${kind}: ${ids.map((id) => `#${id}`).join(", ")}`);
  }

  if (opts.seen?.length) lines.push(`\nAlready shown this session (avoid): ${opts.seen.join(", ")}`);
  if (opts.seed) lines.push(`Round ${opts.seed + 1}: give a noticeably different set from earlier rounds.`);
  lines.push(`\nProduce these outfits, in order: ${TITLES.map((t) => `"${t}"`).join(", ")}.`);
  return lines.join("\n");
}

export async function suggestOutfitsWithClaude(date: string, weather: OutfitWeather, rows: Rec[], closet: ClosetItems, opts: OutfitOptions = {}): Promise<OutfitSuggestions> {
  const { candidates, ...base } = suggestOutfits(date, weather, rows, closet, { ...opts, candidates: true });
  const fallback: OutfitSuggestions = { ...base, engine: "history", claudeAvailable: true };
  if (!base.outfits.length) return fallback;

  const neverWorn = new Set<string>();
  const worn = new Set<string>();
  for (const r of rows) if (r.Date && r.Date < date) for (const kind of SLOT_ORDER) { const id = r[CLOSET[kind].idCol]; if (id) worn.add(`${kind}:${id}`); }
  for (const kind of SLOT_ORDER) for (const it of closet[kind] ?? []) if (!worn.has(`${kind}:${it.id}`)) neverWorn.add(`${kind}:${it.id}`);

  try {
    const res = await client().messages.parse({
      model: OUTFIT_MODEL,
      max_tokens: 4096,
      system: [
        { type: "text", text: SYSTEM },
        { type: "text", text: closetText(closet), cache_control: { type: "ephemeral" } },   // the closet rarely changes → cached across requests
      ],
      messages: [{ role: "user", content: contextText(date, { ...base, candidates }, rows, closet, neverWorn, opts) }],
      output_config: { effort: "low", format: zodOutputFormat(OutfitPlan) },
    });
    if (res.stop_reason === "refusal") throw new Error(`refused (${res.stop_details?.category ?? "unspecified"})`);
    if (!res.parsed_output) throw new Error(`no structured output (stop_reason ${res.stop_reason})`);
    if (process.env.NODE_ENV !== "production") console.log(`[outfits] ${OUTFIT_MODEL}: in ${res.usage.input_tokens} (cache read ${res.usage.cache_read_input_tokens ?? 0}, write ${res.usage.cache_creation_input_tokens ?? 0}) out ${res.usage.output_tokens}`);

    const used = new Set<string>();
    const outfits: OutfitSuggestion[] = [];
    for (const o of res.parsed_output.outfits) {
      const pieces: OutfitPiece[] = [];
      for (const p of o.pieces) {
        const kind = p.slot as ClosetKind;
        const key = `${kind}:${p.id}`;
        const item = (closet[kind] ?? []).find((c) => c.id === p.id);
        if (!item || pieces.some((x) => x.slot === kind) || used.has(key)) continue;   // unknown id, duplicate slot, or reused piece
        used.add(key);
        pieces.push({ slot: kind, id: p.id, label: item.label, values: { ...item.values, [CLOSET[kind].idCol]: p.id }, why: p.why.trim(), isNew: neverWorn.has(key) });
      }
      pieces.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
      if (pieces.some((p) => p.slot === "shirt") && pieces.some((p) => p.slot === "pants")) outfits.push({ title: o.title.trim() || TITLES[outfits.length] || "Outfit", tagline: o.tagline.trim(), pieces });
    }
    if (!outfits.length) throw new Error("no valid outfits in the response");
    return { ...fallback, engine: "claude", model: OUTFIT_MODEL, outfits, shownKeys: outfits.flatMap((o) => o.pieces.map((p) => `${p.slot}:${p.id}`)) };
  } catch (e) {
    const apiMsg = e instanceof Anthropic.APIError ? (e.error as { error?: { message?: string } } | undefined)?.error?.message : undefined;
    const msg = apiMsg ?? (e instanceof Error ? e.message : String(e));
    console.error("[outfits] Claude failed, using history-based picks:", msg);
    return { ...fallback, note: [fallback.note, `Claude ideas unavailable (${msg}) — showing history-based picks.`].filter(Boolean).join(" ") };
  }
}
