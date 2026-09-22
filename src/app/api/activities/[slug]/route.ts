import { revalidatePath } from "next/cache";
import { loadActivity, saveActivity } from "@/lib/activities";
import { error, handler, json, options } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

type Ctx = { params: Promise<{ slug: string }> };

/** GET /api/activities/:slug → field specs (with suggestion lists) and recent entries. */
export const GET = handler<Ctx>(async (_req, { params }) => {
  const { slug } = await params;
  const data = await loadActivity(slug);
  if (!data) return error("Unknown activity", 404);
  return json({ ok: true, ...data });
});

/** POST /api/activities/:slug { values, groupIndex? } → appends a row. */
export const POST = handler<Ctx>(async (req, { params }) => {
  const { slug } = await params;
  const b = (await req.json().catch(() => null)) as { values?: Record<string, string>; groupIndex?: number } | null;
  if (!b?.values) return error("values object is required");
  await saveActivity(slug, b.values, b.groupIndex ?? 0);
  revalidatePath(`/activities/${slug}`); revalidatePath("/");
  return json({ ok: true });
});
