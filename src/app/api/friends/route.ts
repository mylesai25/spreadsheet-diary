import type { NextRequest } from "next/server";
import { buildFriends } from "@/lib/friends";
import { RANGES, type Range } from "@/lib/metrics";
import { handler, json, options } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** GET /api/friends?range=7d|30d|90d|ytd|all — per-person stats for days spent together. */
export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams.get("range");
  const range: Range = RANGES.some((r) => r.key === q) ? (q as Range) : "ytd";
  return json({ ok: true, ...(await buildFriends(range)) });
});
