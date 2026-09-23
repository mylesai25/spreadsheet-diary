"use server";

import { revalidatePath } from "next/cache";
import { outfitsFor, saveDaily } from "@/lib/daily";
import type { OutfitSuggestions } from "@/lib/outfits";
import { getDayWeather, weatherToColumns } from "@/lib/weather";

export interface SaveResult { ok: boolean; error?: string; saved?: number }

export async function saveDailyAction(date: string, changes: Record<string, string>): Promise<SaveResult> {
  try {
    await saveDaily(date, changes);
    revalidatePath("/");
    revalidatePath("/log");
    return { ok: true, saved: Object.keys(changes).length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface WeatherResult { ok: boolean; values?: Record<string, string>; place?: string; error?: string }

/** Fetch weather for a date at a place (used by the "Get weather" button on the form). */
export async function weatherAction(date: string, city: string, state: string, country: string, wakeTime: string): Promise<WeatherResult> {
  try {
    if (!city.trim()) return { ok: false, error: "Set a Wake Up City first" };
    const w = await getDayWeather(date, city, state, country, wakeTime || "08:00");
    if (!w) return { ok: false, error: `No weather found for ${city}` };
    return { ok: true, values: weatherToColumns(w), place: w.place };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Outfit ideas for the weather currently on the form. */
export async function outfitsAction(date: string, weather: { feelsLike: number | null; high: number | null; sky: string }, opts: { seen?: string[]; seed?: number } = {}): Promise<{ ok: boolean; data?: OutfitSuggestions; error?: string }> {
  try {
    return { ok: true, data: await outfitsFor(date, weather, opts) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
