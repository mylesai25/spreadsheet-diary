import type { NextRequest } from "next/server";
import { getDayWeather, weatherToColumns } from "@/lib/weather";
import { isValidISODate } from "@/lib/dates";
import { error, handler, json, options } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** POST /api/weather { date, city, state?, country?, wakeTime? } → { values: {Sky, High…}, place } */
export const POST = handler(async (req: NextRequest) => {
  const b = (await req.json().catch(() => null)) as { date?: string; city?: string; state?: string; country?: string; wakeTime?: string } | null;
  if (!b?.date || !isValidISODate(b.date)) return error("date is required");
  if (!b.city?.trim()) return error("city is required");
  const w = await getDayWeather(b.date, b.city, b.state, b.country, b.wakeTime || "08:00");
  if (!w) return error(`No weather found for ${b.city}`, 404);
  return json({ ok: true, values: weatherToColumns(w), place: w.place });
});
