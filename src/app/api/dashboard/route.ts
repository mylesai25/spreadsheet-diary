import type { NextRequest } from "next/server";
import { buildDashboard, isValidMonth, RANGES, type Range } from "@/lib/metrics";
import { handler, json, options } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** GET /api/dashboard?range=7d|30d|90d|ytd|all[&month=YYYY-MM] — month picks the calendar view (default: this month). */
export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams.get("range");
  const range: Range = RANGES.some((r) => r.key === q) ? (q as Range) : "30d";
  const month = req.nextUrl.searchParams.get("month");
  return json({ ok: true, ...(await buildDashboard(range, isValidMonth(month) ? month : undefined)) });
});
