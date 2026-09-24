import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { loadDaily, saveDaily } from "@/lib/daily";
import { isValidISODate, todayISO } from "@/lib/dates";
import { error, handler, json, options } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** GET /api/daily?date=YYYY-MM-DD[&closet=0] → the row, defaults, suggestion lists, and (unless closet=0) closet items.
 *  Clients that cache /api/closet pass closet=0 to skip the ~100 KB of pickers. */
export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams.get("date");
  const date = q && isValidISODate(q) ? q : todayISO();
  const data = await loadDaily(date, { closet: req.nextUrl.searchParams.get("closet") !== "0" });
  return json({ ok: true, today: todayISO(), ...data });
});

/** POST /api/daily { date, changes: { [column]: value } } → writes only those cells. */
export const POST = handler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as { date?: string; changes?: Record<string, string> } | null;
  if (!body?.date || !isValidISODate(body.date)) return error("date (YYYY-MM-DD) is required");
  if (!body.changes || typeof body.changes !== "object") return error("changes object is required");
  await saveDaily(body.date, body.changes);
  revalidatePath("/"); revalidatePath("/log");
  return json({ ok: true, saved: Object.keys(body.changes).length });
});
