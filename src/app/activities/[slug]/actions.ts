"use server";

import { revalidatePath } from "next/cache";
import { saveActivity } from "@/lib/activities";

export async function saveActivityAction(slug: string, values: Record<string, string>, groupIndex: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await saveActivity(slug, values, groupIndex);
    revalidatePath(`/activities/${slug}`);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
