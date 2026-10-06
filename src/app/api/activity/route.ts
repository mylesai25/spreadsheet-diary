import type { NextRequest } from "next/server";
import { buildActivityStats } from "@/lib/activityStats";
import { buildInsights } from "@/lib/insights";
import { RANGES, type Range } from "@/lib/metrics";
import { handler, json, options } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** GET /api/activity?range=7d|30d|90d|ytd|all — the notebook's golf / climbing / skiing figures plus hours by sport. */
export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams.get("range");
  const range: Range = RANGES.some((r) => r.key === q) ? (q as Range) : "ytd";
  const [act, ins] = await Promise.all([buildActivityStats(range), buildInsights(range)]);
  return json({ ok: true, ...act, sportHours: ins.sportHours });
});
