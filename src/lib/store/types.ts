/** "journal" = current year, "journal-2025" etc. = prior years (read-only in practice), "closet" = Virtual Closet. */
export type Book = "journal" | "closet" | `journal-${number}`;

export interface SheetData {
  book: Book;
  name: string;
  header: string[];
  /** Data rows (header excluded), padded to header length. Sheet row number = index + 2. */
  rows: string[][];
}

export interface Store {
  readonly kind: "sheets" | "csv";
  read(book: Book, sheet: string): Promise<SheetData>;
  /** Read several sheets of one book in a single round trip. Sheets that can't be read come back empty. */
  readMany(book: Book, sheets: string[]): Promise<SheetData[]>;
  /** Write specific cells on an existing (1-based) sheet row. Only the given headers are touched. */
  updateCells(book: Book, sheet: string, rowNumber: number, values: Record<string, string>): Promise<void>;
  /** Append a full row (values keyed by header; missing headers are blank). */
  append(book: Book, sheet: string, values: Record<string, string>): Promise<void>;
}

/** Columns whose raw sheet values need date/time normalization, per sheet. */
export type ColumnKinds = Record<string, Record<string, "date" | "time">>;
