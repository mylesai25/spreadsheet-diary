import type { ColumnKinds } from "./types";

/** Date/time columns per sheet — used to convert Sheets serial numbers to ISO strings. */
export const COLUMN_KINDS: ColumnKinds = {
  "Daily Overview": { Date: "date", "Wake Up Time": "time", Bedtime: "time" },
  Golf: { Date: "date", "Tee Time": "time" },
  "Mini-Golf": { Date: "date", "Tee Time": "time" },
  "Disc Golf": { Date: "date", "Tee Time": "time" },
  Climbing: { Date: "date" },
  Skiing: { Date: "date", "First Lift Time": "time" },
  Restaurant: { Date: "date" },
  Restuarant: { Date: "date" }, // 2025 sheet name (sic)
};
