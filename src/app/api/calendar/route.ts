import type { NextRequest } from "next/server";
import { buildCalendarPage } from "@/lib/calendar";
import { isValidMonth } from "@/lib/metrics";
import { handler, json, options } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** GET /api/calendar[?month=YYYY-MM] — the home calendar (shirt color per day, fun meter) and streak. */
export const GET = handler(async (req: NextRequest) => {
  const month = req.nextUrl.searchParams.get("month");
  return json({ ok: true, ...(await buildCalendarPage(isValidMonth(month) ? month : undefined)) });
});
