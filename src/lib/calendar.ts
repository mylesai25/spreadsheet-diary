import "server-only";
import { DAILY_SHEET, getStore } from "./store";
import { isLoggedRow, rowToRecord } from "./daily";
import { addDays, todayISO } from "./dates";
import { buildCalendar, isValidMonth, monthOf, type CalendarMonth } from "./metrics";

export interface CalendarPage { calendar: CalendarMonth; streak: number; daysLogged: number; missingDays: number; storeKind: "sheets" | "csv" }

/** The home screen: one month of shirt-colored days plus the streak, without the dashboard's charts. */
export async function buildCalendarPage(month?: string): Promise<CalendarPage> {
  const store = getStore();
  const daily = await store.read("journal", DAILY_SHEET);
  const dateCol = daily.header.indexOf("Date");
  const all = daily.rows.filter((r) => r[dateCol] && isLoggedRow(daily, r)).map((r) => rowToRecord(daily, r)).sort((a, b) => (a.Date < b.Date ? -1 : 1));
  const today = todayISO();
  const logged = new Set(all.map((r) => r.Date));
  let streak = 0;
  for (let d = logged.has(today) ? today : addDays(today, -1); logged.has(d); d = addDays(d, -1)) streak++;
  const first = all[0]?.Date ?? today;
  let missingDays = 0;
  for (let d = addDays(today, -30); d < today; d = addDays(d, 1)) if (d >= first && !logged.has(d)) missingDays++;
  return { calendar: buildCalendar(all, isValidMonth(month) ? month : monthOf(today), today), streak, daysLogged: all.length, missingDays, storeKind: store.kind };
}
