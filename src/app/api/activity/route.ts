import type { NextRequest } from "next/server";
import { buildActivityStats } from "@/lib/activityStats";
import { buildInsights } from "@/lib/insights";
import { RANGES, type Range } from "@/lib/metrics";
import { handler, json, options } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/**
 * GET /api/activity?range=7d|30d|90d|ytd|all — the notebook's golf / climbing / skiing / mini golf / disc golf figures,
 * hours by sport, and `extras`: the daily-sheet figures the phone dashboard draws beyond the notebook.
 */
export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams.get("range");
  const range: Range = RANGES.some((r) => r.key === q) ? (q as Range) : "ytd";
  const [act, ins] = await Promise.all([buildActivityStats(range), buildInsights(range)]);
  const extras = {
    streaks: ins.streaks, weekday: ins.weekday, hours: ins.hours, battery: ins.battery, funBySky: ins.funBySky, drinkTypes: ins.drinkTypes,
    projects: ins.projects, projectProd: ins.projectProd, jacketByTemp: ins.jacketByTemp, cuisineRatings: ins.cuisineRatings, ratings: ins.ratings,
    shows: ins.shows, services: ins.services, boardGames: ins.boardGames, sportDays: ins.sportDays,
  };
  return json({ ok: true, ...act, sportHours: ins.sportHours, extras });
});
