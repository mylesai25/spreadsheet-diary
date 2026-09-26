import { buildClosetStats } from "@/lib/closetStats";
import { handler, json, options } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** GET /api/closet/stats → Virtual Closet composition (green share, colors, brands) and this year's wear. */
export const GET = handler(async () => json({ ok: true, ...(await buildClosetStats()) }));
