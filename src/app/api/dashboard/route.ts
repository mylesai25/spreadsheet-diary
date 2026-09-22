import type { NextRequest } from "next/server";
import { buildDashboard, RANGES, type Range } from "@/lib/metrics";
import { handler, json, options } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** GET /api/dashboard?range=7d|30d|90d|ytd|all */
export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams.get("range");
  const range: Range = RANGES.some((r) => r.key === q) ? (q as Range) : "30d";
  return json({ ok: true, ...(await buildDashboard(range)) });
});
