import { CsvStore } from "./csv";
import { SheetsStore } from "./sheets";
import type { Store } from "./types";

export type { Store, SheetData, Book } from "./types";

declare global {
  var __diaryStore: Store | undefined;
}

/** Store: Google Sheets (singleton, holds auth + cache) when SHEET_ID is set, otherwise the stateless local CSV store. */
export function getStore(): Store {
  if (!process.env.SHEET_ID) return new CsvStore();
  if (!globalThis.__diaryStore) globalThis.__diaryStore = new SheetsStore();
  return globalThis.__diaryStore;
}

export const DAILY_SHEET = "Daily Overview";
