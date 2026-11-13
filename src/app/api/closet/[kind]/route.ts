import { addClosetItem } from "@/lib/closetEdit";
import { isClosetKind } from "@/lib/closetPhotos";
import { error, handler, json, options } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

type Ctx = { params: Promise<{ kind: string }> };

/** POST /api/closet/:kind { values } → appends a piece to that closet tab (values keyed by the tab's columns; id assigned) → { item }. */
export const POST = handler<Ctx>(async (req, { params }) => {
  const { kind } = await params;
  if (!isClosetKind(kind)) return error("Unknown closet kind", 404);
  const b = (await req.json().catch(() => null)) as { values?: Record<string, string> } | null;
  if (!b?.values || typeof b.values !== "object") return error("values object is required");
  try {
    return json({ ok: true, item: await addClosetItem(kind, b.values) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return error(msg, /required/.test(msg) ? 400 : 500);
  }
});
