import { DAILY_SECTIONS } from "@/lib/schema/daily";
import { handler, json, options } from "@/lib/api";

export const OPTIONS = options;

/** The Daily Overview form layout, so the mobile client renders the same sections and field types. */
export const GET = handler(async () => json({ ok: true, sections: DAILY_SECTIONS }));
