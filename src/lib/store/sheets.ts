import { google, type sheets_v4 } from "googleapis";
import { normalizeDate, normalizeTime } from "../dates";
import { COLUMN_KINDS } from "./columnKinds";
import type { Book, SheetData, Store } from "./types";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const CACHE_TTL_MS = 60_000;                       // current-year journal: edits land through the app, so keep this short
const CLOSET_TTL_MS = 5 * 60 * 1000;               // closet: edited by hand in Sheets, rarely
const PRIOR_YEAR_TTL_MS = 24 * 60 * 60 * 1000;

const EMPTY_VALUES = "UNFORMATTED_VALUE" as const;

/** Prior-year journals (override with SHEET_ID_<year>). */
export const PRIOR_YEAR_SHEET_IDS: Record<string, string> = {
  "2025": "1qVdR35qa7avzK45Kf6R7IXf1dZkl3UoNYDXcqWCHczw",
  "2024": "1Fv2YUJiwh0DtsVHzf4QTsmGp2kQVQNfNChAisml13VY",
};

/** Google Sheets store. Auth: GOOGLE_SERVICE_ACCOUNT_JSON (raw or base64 JSON) → else
 *  Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS / gcloud ADC). */
export class SheetsStore implements Store {
  readonly kind = "sheets" as const;
  private api: sheets_v4.Sheets;
  private ids: Record<string, string | undefined>;
  private cache = new Map<string, { at: number; data: SheetData }>();

  constructor() {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const auth = raw
      ? new google.auth.GoogleAuth({ credentials: JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")), scopes: SCOPES })
      : new google.auth.GoogleAuth({ scopes: SCOPES });
    this.api = google.sheets({ version: "v4", auth });
    this.ids = { journal: process.env.SHEET_ID, closet: process.env.CLOSET_SHEET_ID };
  }

  private id(book: Book) {
    let id = this.ids[book];
    if (!id && book.startsWith("journal-")) {
      const year = book.slice("journal-".length);
      id = process.env[`SHEET_ID_${year}`] ?? PRIOR_YEAR_SHEET_IDS[year];
    }
    if (!id) throw new Error(`No spreadsheet id configured for ${book} (set ${book === "journal" ? "SHEET_ID" : book === "closet" ? "CLOSET_SHEET_ID" : `SHEET_ID_${book.slice(8)}`})`);
    return id;
  }

  private ttl(book: Book) {
    return book.startsWith("journal-") ? PRIOR_YEAR_TTL_MS : book === "closet" ? CLOSET_TTL_MS : CACHE_TTL_MS;
  }

  private cached(book: Book, sheet: string): SheetData | null {
    const hit = this.cache.get(`${book}:${sheet}`);
    return hit && Date.now() - hit.at < this.ttl(book) ? hit.data : null;
  }

  async read(book: Book, sheet: string): Promise<SheetData> {
    const hit = this.cached(book, sheet);
    if (hit) return hit;
    const res = await this.api.spreadsheets.values.get({
      spreadsheetId: this.id(book),
      range: `'${sheet}'`,
      valueRenderOption: EMPTY_VALUES,
      dateTimeRenderOption: "SERIAL_NUMBER",
    });
    return this.remember(book, sheet, (res.data.values ?? []) as unknown[][]);
  }

  /** One batchGet for every sheet not already cached; falls back to per-sheet reads if the batch fails (e.g. a missing tab). */
  async readMany(book: Book, sheets: string[]): Promise<SheetData[]> {
    const out = new Map<string, SheetData>();
    const missing = sheets.filter((s) => { const hit = this.cached(book, s); if (hit) out.set(s, hit); return !hit; });
    if (missing.length) {
      try {
        const res = await this.api.spreadsheets.values.batchGet({
          spreadsheetId: this.id(book),
          ranges: missing.map((s) => `'${s}'`),
          valueRenderOption: EMPTY_VALUES,
          dateTimeRenderOption: "SERIAL_NUMBER",
        });
        const ranges = res.data.valueRanges ?? [];
        missing.forEach((s, i) => out.set(s, this.remember(book, s, (ranges[i]?.values ?? []) as unknown[][])));
      } catch {
        const singles = await Promise.all(missing.map((s) => this.read(book, s).catch((): SheetData => ({ book, name: s, header: [], rows: [] }))));
        missing.forEach((s, i) => out.set(s, singles[i]));
      }
    }
    return sheets.map((s) => out.get(s)!);
  }

  private remember(book: Book, sheet: string, values: unknown[][]): SheetData {
    const header = (values[0] ?? []).map((h) => String(h ?? "").trim());
    const kinds = COLUMN_KINDS[sheet] ?? {};
    const rows = values.slice(1).map((r) =>
      header.map((h, c) => {
        const v = r[c];
        if (v == null || v === "") return "";
        if (kinds[h] === "date") return normalizeDate(v);
        if (kinds[h] === "time") return normalizeTime(v);
        if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
        return String(v);
      }),
    );
    // Drop fully blank trailing rows but keep interior ones (row numbers must stay stable).
    while (rows.length && rows[rows.length - 1].every((c) => c === "")) rows.pop();
    const data = { book, name: sheet, header, rows };
    this.cache.set(`${book}:${sheet}`, { at: Date.now(), data });
    return data;
  }

  async updateCells(book: Book, sheet: string, rowNumber: number, values: Record<string, string>) {
    const { header } = await this.read(book, sheet);
    const data: sheets_v4.Schema$ValueRange[] = [];
    for (const [k, v] of Object.entries(values)) {
      const c = header.indexOf(k);
      if (c < 0) continue;
      data.push({ range: `'${sheet}'!${colLetter(c)}${rowNumber}`, values: [[v]] });
    }
    if (!data.length) return;
    await this.api.spreadsheets.values.batchUpdate({
      spreadsheetId: this.id(book),
      requestBody: { valueInputOption: "USER_ENTERED", data },
    });
    this.cache.delete(`${book}:${sheet}`);
  }

  async append(book: Book, sheet: string, values: Record<string, string>) {
    const { header } = await this.read(book, sheet);
    await this.api.spreadsheets.values.append({
      spreadsheetId: this.id(book),
      range: `'${sheet}'!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [header.map((h) => values[h] ?? "")] },
    });
    this.cache.delete(`${book}:${sheet}`);
  }
}

export function colLetter(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
