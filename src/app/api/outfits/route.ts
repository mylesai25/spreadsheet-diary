import type { NextRequest } from "next/server";
import { outfitsFor } from "@/lib/daily";
import { isValidISODate, todayISO } from "@/lib/dates";
import { handler, json, options } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** GET /api/outfits?date=&feels=&high=&sky=&seen=shirt:35,pants:2&seed=2 → weather-aware outfit suggestions.
 *  Pass the previous response's `shownKeys` as `seen` and bump `seed` to get a fresh set. */
export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const date = q.get("date") && isValidISODate(q.get("date")!) ? q.get("date")! : todayISO();
  const n = (k: string) => { const v = q.get(k); return v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v); };
  const seen = (q.get("seen") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const seed = Math.max(0, Math.floor(n("seed") ?? 0));
  return json({ ok: true, ...(await outfitsFor(date, { feelsLike: n("feels"), high: n("high"), sky: q.get("sky") ?? "" }, { seen, seed })) });
});
