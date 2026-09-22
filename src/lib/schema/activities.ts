import type { FieldType } from "./types";

export interface ColumnGroup {
  title: string;
  /** Column headers making up this side-by-side list. */
  cols: string[];
}

export interface ActivityConfig {
  slug: string;
  sheet: string;
  title: string;
  icon: string;
  /** Column that holds the entry date, if any. */
  dateKey?: string;
  /** Type overrides where inference from data isn't enough. */
  types?: Record<string, FieldType>;
  /** Sheets laid out as several independent lists side by side (Year Rankings). */
  columnGroups?: ColumnGroup[];
  /** Columns to show in the recent-entries table (defaults to first 6). */
  listCols?: string[];
}

export const ACTIVITIES: ActivityConfig[] = [
  {
    slug: "restaurant", sheet: "Restaurant", title: "Restaurants", icon: "🍜", dateKey: "Date",
    types: { Group: "multi", "Food Rating": "rating", "Drink Rating": "rating" },
    listCols: ["Date", "Restaurant", "Restaurant Type", "Food Ordered", "Food Rating"],
  },
  {
    slug: "golf", sheet: "Golf", title: "Golf", icon: "⛳", dateKey: "Date",
    types: { "Tee Time": "time", Players: "multi", "Scramble Team": "multi", "Game Winner": "multi" },
    listCols: ["Date", "Course", "Holes Played", "Par", "Score", "Putts"],
  },
  {
    slug: "mini-golf", sheet: "Mini-Golf", title: "Mini golf", icon: "🏌️", dateKey: "Date",
    types: { "Tee Time": "time", Players: "multi" },
    listCols: ["Date", "Course", "Course City", "Holes Played", "Par", "Score", "Winner"],
  },
  {
    slug: "disc-golf", sheet: "Disc Golf", title: "Disc golf", icon: "🥏", dateKey: "Date",
    types: { "Tee Time": "time", Players: "multi" },
    listCols: ["Date", "Course", "Course City", "Holes Played", "Par", "Score", "Winner"],
  },
  {
    slug: "climbing", sheet: "Climbing", title: "Climbing", icon: "🧗", dateKey: "Date",
    types: { Climbers: "multi" },
    listCols: ["Date", "Gym", "City", "Duration (minutes)", "V3 Completed", "V4 Completed"],
  },
  {
    slug: "skiing", sheet: "Skiing", title: "Skiing", icon: "⛷️", dateKey: "Date",
    types: { "First Lift Time": "time", "Crowd (1-5)": "rating" },
    listCols: ["Date", "Resort", "Duration (hrs)", "Conditions", "Total Falls"],
  },
  {
    slug: "video-games", sheet: "Video Game Rankings", title: "Video games", icon: "🎮",
    types: { Rating: "rating", Review: "textarea" },
    listCols: ["Game", "Hours Spent", "Rating", "Review"],
  },
  {
    slug: "year-rankings", sheet: "Year Rankings", title: "Year rankings", icon: "🎬",
    types: { "TV Rating": "rating", "Movie Rating": "rating", "Broadway Rating": "rating", "TV Review": "textarea", "Movie Review": "textarea", "Broadway Review": "textarea" },
    columnGroups: [
      { title: "TV show", cols: ["TV Shows Watched", "TV Rating", "TV Review"] },
      { title: "Movie", cols: ["Movies Watched", "Movie Rating", "Movie Review"] },
      { title: "Broadway", cols: ["Broadway Watched", "Broadway Rating", "Broadway Review"] },
    ],
  },
];

export const ACTIVITY_BY_SLUG: Record<string, ActivityConfig> = Object.fromEntries(ACTIVITIES.map((a) => [a.slug, a]));

/** Guess a field type from a column's header and its historical values. */
export function inferType(header: string, values: string[]): FieldType {
  const filled = values.filter((v) => v.trim() !== "");
  if (/^date$/i.test(header)) return "date";
  if (/\btime\b/i.test(header)) return "time";
  if (/rating|\(1-\d+\)/i.test(header)) return "rating";
  if (/review|notes/i.test(header)) return "textarea";
  if (filled.length && filled.every((v) => v === "TRUE" || v === "FALSE")) return "bool";
  if (/\?$/.test(header) && filled.every((v) => /^(TRUE|FALSE|Yes|No)$/i.test(v))) return filled.some((v) => /^(Yes|No)$/i.test(v)) ? "select" : "bool";
  if (filled.length && filled.every((v) => /^-?\d+(\.\d+)?$/.test(v))) return "number";
  if (filled.length && filled.some((v) => v.includes(", ")) && new Set(filled).size > 3) return "multi";
  return "select";
}

export function ratingMax(header: string): number {
  const m = header.match(/\(1-(\d+)\)/);
  return m ? +m[1] : 10;
}
