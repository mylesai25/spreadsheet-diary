import { closetForms } from "@/lib/closetEdit";
import { handler, json, options } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** GET /api/closet/options → per kind: the columns to fill when adding a piece (with suggestions) and the next free id. */
export const GET = handler(async () => json({ ok: true, forms: await closetForms() }));
