/** Google Sheets serial-date <-> ISO helpers and lenient parsers for values coming
 *  back from the Sheets API (UNFORMATTED_VALUE) or the local CSV fallback. */

const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

export const APP_TZ = process.env.APP_TZ ?? "America/New_York";

export function serialToISO(serial: number): string {
  return new Date(SHEETS_EPOCH_MS + Math.round(serial) * DAY_MS).toISOString().slice(0, 10);
}

export function isoToSerial(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - SHEETS_EPOCH_MS) / DAY_MS);
}

export function fractionToTime(fraction: number): string {
  const mins = Math.round(((fraction % 1) + 1) % 1 * 1440) % 1440;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Accepts a serial number, "M/D/YYYY", "YYYY-MM-DD", or a Date; returns "YYYY-MM-DD" or "". */
export function normalizeDate(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "number") return serialToISO(v);
  if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return `${y}-${pad(+m[1])}-${pad(+m[2])}`;
  }
  return s;
}

/** Accepts a day-fraction, "H:MM", "H:MM:SS", "h:MM AM"; returns "HH:MM" or "". */
export function normalizeTime(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "number") return fractionToTime(v);
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!m) return s;
  let h = +m[1];
  const ap = m[3]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${pad(h)}:${m[2]}`;
}

/** Today's date in the app timezone (server may run in UTC). */
export function todayISO(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(iso: string, n: number): string {
  return serialToISO(isoToSerial(iso) + n);
}

export function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "UTC",
  });
}

/** Sunday-based ISO week key "YYYY-MM-DD" of the week's Sunday, for grouping. */
export function weekStart(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return addDays(iso, -dt.getUTCDay());
}
