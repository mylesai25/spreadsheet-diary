import { ACTIVITIES } from "@/lib/schema/activities";
import { handler, json, options } from "@/lib/api";

export const OPTIONS = options;

/** GET /api/activities → the activity sheets the app knows about. */
export const GET = handler(async () => json({ ok: true, activities: ACTIVITIES.map(({ slug, sheet, title, icon, dateKey, columnGroups }) => ({ slug, sheet, title, icon, dateKey, columnGroups })) }));
