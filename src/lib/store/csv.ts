import { promises as fs } from "node:fs";
import path from "node:path";
import type { Book, SheetData, Store } from "./types";

/** Local fallback store backed by the CSV exports under data/. Used when SHEET_ID is unset. */
export class CsvStore implements Store {
  readonly kind = "csv" as const;
  private root = path.join(process.cwd(), "data");

  private file(book: Book, sheet: string) {
    const dir = book === "journal" ? "csv" : book === "closet" ? "closet" : `csv-${book.slice("journal-".length)}`;
    return path.join(this.root, dir, sheet.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") + ".csv");
  }

  async read(book: Book, sheet: string): Promise<SheetData> {
    let text = "";
    try {
      text = await fs.readFile(this.file(book, sheet), "utf8");
    } catch {
      return { book, name: sheet, header: [], rows: [] };
    }
    const table = parseCsv(text);
    const header = table[0] ?? [];
    const rows = table.slice(1).map((r) => padTo(r, header.length));
    return { book, name: sheet, header, rows };
  }

  async updateCells(book: Book, sheet: string, rowNumber: number, values: Record<string, string>) {
    const data = await this.read(book, sheet);
    const idx = rowNumber - 2;
    while (data.rows.length <= idx) data.rows.push(padTo([], data.header.length));
    for (const [k, v] of Object.entries(values)) {
      const c = data.header.indexOf(k);
      if (c >= 0) data.rows[idx][c] = v;
    }
    await this.write(book, sheet, data);
  }

  async append(book: Book, sheet: string, values: Record<string, string>) {
    const data = await this.read(book, sheet);
    data.rows.push(data.header.map((h) => values[h] ?? ""));
    await this.write(book, sheet, data);
  }

  private async write(book: Book, sheet: string, data: SheetData) {
    const lines = [data.header, ...data.rows].map((r) => r.map(csvEscape).join(","));
    await fs.writeFile(this.file(book, sheet), lines.join("\n") + "\n", "utf8");
  }
}

function padTo(r: string[], n: number) {
  const out = r.slice(0, Math.max(n, r.length));
  while (out.length < n) out.push("");
  return out;
}

function csvEscape(v: string) {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ""));
}
