import type { Field, Section } from "./types";

const bool = (key: string, label?: string, def: Field["default"] = "mode"): Field => ({ key, label, type: "bool", default: def });
const rating = (key: string, label?: string): Field => ({ key, label, type: "rating", min: 1, max: 10, default: "mode" });
const sel = (key: string, label?: string, def?: Field["default"]): Field => ({ key, label, type: "select", default: def });
const multi = (key: string, label?: string, def?: Field["default"]): Field => ({ key, label, type: "multi", default: def });
const num = (key: string, label?: string, extra: Partial<Field> = {}): Field => ({ key, label, type: "number", ...extra });

const outfit = (kind: Field["closet"], idKey: string, cols: string[], prefixStrip: string, gate?: Field["showIf"]): Field[] => [
  { key: idKey, label: "Item", type: "closet", closet: kind, showIf: gate },
  ...cols.map((c) => ({ key: c, label: c.replace(prefixStrip, "").trim(), type: "select" as const, showIf: gate })),
];

/** Sectioned layout of the 145 Daily Overview columns. Date/Day/Week/Month are handled by the app. */
export const DAILY_SECTIONS: Section[] = [
  {
    id: "sleep", title: "Sleep", icon: "🛏️",
    items: [
      { key: "Wake Up Time", type: "time", default: "mode" },
      { key: "Bedtime", type: "time", default: "mode" },
      num("Hours slept", undefined, { min: 0, max: 24, step: 0.5, default: "mode", hint: "Auto-filled from bedtime → wake up" }),
      rating("Sleep Quality (1-10)", "Sleep quality"),
      bool("Alarm Wake-Up?", "Alarm"),
      num("Naps taken", "Naps", { min: 0, default: "0" }),
      num("Nap Duration (hours)", "Nap hours", { min: 0, step: 0.5, default: "0" }),
      num("Morning Phone Battery (%)", "Morning battery", { min: 0, max: 100, unit: "%" }),
    ],
  },
  {
    id: "day", title: "Day & Weather", icon: "🌤️",
    items: [
      rating("Fun Meter (1-10)", "Fun meter"),
      bool("Injured?", "Injured"),
      bool("Sick?", "Sick"),
      sel("Sky"),
      num("High Temperature (F)", "High", { unit: "°F" }),
      num("Low Temperature (F)", "Low", { unit: "°F" }),
      num("Feels Like (F)", "Feels like", { unit: "°F" }),
      bool("Went Outside?", "Went outside"),
      sel("Outside Feel", "Outside felt", "mode"),
      {
        group: "Location",
        fields: [
          sel("Wake Up City", undefined, "prev"), sel("Wake Up State", undefined, "prev"), sel("Wake Up Country", undefined, "prev"),
          sel("Sleep City", undefined, "prev"), sel("Sleep State", undefined, "prev"), sel("Sleep Country", undefined, "prev"),
          multi("Cities Visited", undefined, "prev"), multi("States Visited", undefined, "prev"), multi("Countries Visited", undefined, "prev"),
        ],
      },
    ],
  },
  {
    id: "outfit", title: "Outfit", icon: "👕",
    items: [
      { group: "Shirt", fields: outfit("shirt", "Shirt ID", ["Shirt Type", "Shirt Color Primary", "Shirt Color Secondary", "Shirt Company", "Shirt Design", "Shirt Color Short"], "Shirt") },
      { group: "Pants", fields: outfit("pants", "Pants ID", ["Pants Type", "Pants Color Primary", "Pants Color Secondary", "Pants Brand", "Pants Design", "Pants Color Short"], "Pants") },
      { group: "Shoes", fields: outfit("shoes", "Shoe ID", ["Shoe Type", "Shoe Color Primary", "Shoe Color Secondary", "Shoe Brand", "Shoe Design", "Shoe Color Short"], "Shoe") },
      { group: "Socks", fields: outfit("socks", "Sock ID", ["Sock Color Primary", "Sock Color Secondary", "Sock Company", "Sock Design", "Sock Color Short"], "Sock") },
      {
        group: "Underwear",
        fields: [sel("Underwear Type", "Type", "prev"), sel("Underwear Color Primary", "Color primary"), sel("Underwear Color Secondary", "Color secondary"), sel("Underwear Color Short", "Color short")],
      },
      { group: "Eyes", fields: [sel("Contacts/Glasses?", "Contacts or glasses", "prev"), sel("Glasses Color", undefined, "prev")] },
      { group: "Hat", fields: [bool("Hat?", "Wore a hat"), ...outfit("hat", "Hat ID", ["Hat Type", "Hat Color Primary", "Hat Color Secondary", "Hat Company", "Hat Design", "Hat Color Short"], "Hat", { key: "Hat?", equals: "TRUE" })] },
      { group: "Jacket", fields: [bool("Jacket?", "Wore a jacket"), ...outfit("jacket", "Jacket ID", ["Jacket Type", "Jacket Color Primary", "Jacket Color Secondary", "Jacket Company", "Jacket Design", "Jacket Color Short"], "Jacket", { key: "Jacket?", equals: "TRUE" })] },
      num("Clothes Layers", "Layers", { min: 1, max: 5, hint: "Auto: 2 with a jacket, else 1" }),
    ],
  },
  {
    id: "food", title: "Food", icon: "🍽️",
    items: [
      ...(["Breakfast", "Lunch", "Dinner", "Dessert"] as const).map((meal) => ({
        group: meal,
        fields: [
          sel(meal, "What"),
          bool(`Cooked ${meal}?`, "Cooked it"),
          ...(meal === "Lunch" || meal === "Dinner" ? [bool(`${meal} Leftovers?`, "Leftovers")] : []),
          sel(`Restaurant ${meal}`, "Restaurant"),
          { key: `${meal} Rating`, label: "Rating", type: "rating" as const, min: 1, max: 10 },
          { key: `${meal} Notes`, label: "Notes", type: "textarea" as const },
          sel(`Streaming Service ${meal}`, "Watched on"),
          sel(`Show Watched During ${meal}`, "Show"),
        ],
      })),
      multi("Fruit Eaten", "Fruit"),
      multi("Vegetables Eaten", "Vegetables"),
      multi("Meat Eaten", "Meat"),
      multi("Snacks Eaten", "Snacks"),
      multi("Candy Eaten", "Candy"),
      num("Times watched TV", "Times watched TV", { min: 0, default: "0" }),
      bool("Went to grocery store?", "Grocery run"),
    ],
  },
  {
    id: "fitness", title: "Fitness", icon: "🏃",
    items: [
      bool("Gym?", "Gym"),
      bool("Cardio?", "Cardio"),
      num("Cardio Duration (minutes)", "Cardio minutes", { min: 0, default: "0", showIf: { key: "Cardio?", equals: "TRUE" } }),
      bool("Lifting?", "Lifting"),
      num("Lifting Duration (minutes)", "Lifting minutes", { min: 0, default: "0", showIf: { key: "Lifting?", equals: "TRUE" } }),
      num("Steps Taken", "Steps", { min: 0 }),
      num("Distance Traveled (miles)", "Distance", { min: 0, step: 0.01, unit: "mi" }),
      num("Resting Heart Rate", "Resting HR", { min: 30, max: 120, unit: "bpm" }),
      num("Peak Heart Rate", "Peak HR", { min: 40, max: 220, unit: "bpm" }),
      num("Calories Burned", "Calories", { min: 0 }),
      multi("Sports Played", "Sports"),
      num("Duration (minutes)", "Sports minutes", { min: 0 }),
    ],
  },
  {
    id: "transport", title: "Getting around", icon: "🚇",
    items: [
      multi("Public Transportation Used", "Public transit"),
      bool("In Car?", "In a car"),
      bool("Drove?", "Drove", "FALSE"),
      sel("Driver", undefined, undefined),
      sel("Uber/Lyft?", "Rideshare"),
    ],
  },
  {
    id: "people", title: "People & Work", icon: "💼",
    items: [
      multi("People seen in person", "People seen"),
      multi("Things I worked on", "Worked on", "prev"),
      rating("Productivity (1-10)", "Productivity"),
      multi("Coding Languages Used", "Languages", "prev"),
      bool("Zoom?", "Zoom call"),
    ],
  },
  {
    id: "play", title: "Play & Drinks", icon: "🎮",
    items: [
      multi("Video games played", "Video games"),
      multi("Board games played", "Board games"),
      bool("Alcohol?", "Alcohol"),
      num("# of Drinks", "Drinks", { min: 0, default: "0", showIf: { key: "Alcohol?", equals: "TRUE" } }),
      multi("Drink Type", undefined, undefined),
      multi("Drink Brand", undefined, undefined),
      bool("Brushed Teeth?", "Brushed teeth", "TRUE"),
      bool("Flossed?", "Flossed", "TRUE"),
    ],
  },
];

/** Restore showIf on fields created through the Drink helpers (only relevant when Alcohol is on). */
for (const f of DAILY_SECTIONS.find((s) => s.id === "play")!.items as Field[]) {
  if (f.key === "Drink Type" || f.key === "Drink Brand") f.showIf = { key: "Alcohol?", equals: "TRUE" };
}
for (const f of DAILY_SECTIONS.find((s) => s.id === "transport")!.items as Field[]) {
  if (f.key === "Driver") f.showIf = { key: "In Car?", equals: "TRUE" };
}

export const DAILY_FIELDS: Field[] = DAILY_SECTIONS.flatMap((s) =>
  s.items.flatMap((i) => ("group" in i ? i.fields : [i])),
);

export const DAILY_FIELD_BY_KEY: Record<string, Field> = Object.fromEntries(DAILY_FIELDS.map((f) => [f.key, f]));

/** Columns the form never writes (formulas / auto-derived in the sheet). */
export const DAILY_AUTO_COLUMNS = ["Date", "Day", "Week", "Month"];
