/**
 * The dashboard's menu of figures: every chart the app can draw, grouped the way the
 * Diary_Graphs notebook is sectioned. The picker on /dashboard turns entries on and off;
 * the chosen ids live in the `dash_charts` cookie so the server renders the right set first time.
 */

export type ChartSize = "sm" | "md" | "lg";
export type Category = "overview" | "sleep" | "fitness" | "golf" | "climbing" | "skiing" | "food" | "wardrobe" | "people" | "travel" | "fun";

export interface ChartDef { id: string; category: Category; title: string; sub?: string; size: ChartSize }

export const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "📓" },
  { key: "sleep", label: "Sleep & mood", icon: "😴" },
  { key: "fitness", label: "Fitness", icon: "💪" },
  { key: "golf", label: "Golf", icon: "⛳" },
  { key: "climbing", label: "Climbing", icon: "🧗" },
  { key: "skiing", label: "Skiing", icon: "⛷️" },
  { key: "food", label: "Food & drink", icon: "🍜" },
  { key: "wardrobe", label: "Wardrobe", icon: "👕" },
  { key: "people", label: "People", icon: "👥" },
  { key: "travel", label: "Travel & weather", icon: "🚆" },
  { key: "fun", label: "Games", icon: "🎮" },
];

export const CHARTS: ChartDef[] = [
  // Overview
  { id: "tiles", category: "overview", title: "Headline numbers", sub: "Days logged, sleep, fun, steps, gym, drinks, meals", size: "lg" },
  { id: "habitCalendars", category: "overview", title: "Year calendars", sub: "Every day of the year colored by what you logged", size: "lg" },

  // Sleep & mood
  { id: "sleep", category: "sleep", title: "Sleep", sub: "Hours slept per night with 7-day average", size: "md" },
  { id: "sleepHist", category: "sleep", title: "Sleep distribution", sub: "Nights by hours slept · dashed line = 8-hour target", size: "md" },
  { id: "funProd", category: "sleep", title: "Fun & productivity", sub: "Daily self-ratings, 1–10", size: "md" },
  { id: "calFun", category: "sleep", title: "Calories burned vs fun meter", sub: "Does a big day make a fun day?", size: "md" },

  // Fitness
  { id: "steps", category: "fitness", title: "Steps", sub: "Steps per day with 7-day average", size: "md" },
  { id: "gymWeeks", category: "fitness", title: "Gym days per week", sub: "Days with a gym visit (Sunday-start weeks)", size: "md" },
  { id: "hrSpread", category: "fitness", title: "Heart rate spread", sub: "Resting → peak, monthly average", size: "md" },
  { id: "restingHR", category: "fitness", title: "Resting heart rate", sub: "Beats per minute", size: "md" },
  { id: "sportBubbles", category: "fitness", title: "Hours by sport", sub: "Circle area = time played (Sports Played × Duration)", size: "md" },

  // Golf
  { id: "golfTiles", category: "golf", title: "Golf numbers", sub: "Solo rounds (Regular / Wolf), like the notebook", size: "lg" },
  { id: "golfScores18", category: "golf", title: "18-hole scores", sub: "Every solo 18-hole round, in order played", size: "md" },
  { id: "golfToPar", category: "golf", title: "Score to par & putts", sub: "Per round, over time", size: "md" },
  { id: "golfOutcomes", category: "golf", title: "Hole outcomes", sub: "Birdies, pars, bogeys… across solo rounds", size: "sm" },
  { id: "golfCumulative", category: "golf", title: "Outcomes, round by round", sub: "Running count of each hole result", size: "md" },
  { id: "golfPutts", category: "golf", title: "Putting", sub: "Holes by putt count", size: "sm" },
  { id: "golfCourses", category: "golf", title: "Courses played", sub: "Rounds per course", size: "sm" },

  // Climbing
  { id: "climbTiles", category: "climbing", title: "Climbing numbers", sub: "Sessions, time on the wall, sends", size: "lg" },
  { id: "climbGrades", category: "climbing", title: "Climbs completed", sub: "By V-grade", size: "sm" },
  { id: "climbCumulative", category: "climbing", title: "Sends, session by session", sub: "Running count of completed climbs per grade", size: "md" },
  { id: "climbSendRate", category: "climbing", title: "Send rate", sub: "Completed ÷ attempted, per grade", size: "sm" },
  { id: "climbGyms", category: "climbing", title: "Gyms", sub: "Sessions per gym", size: "sm" },

  // Skiing
  { id: "skiTiles", category: "skiing", title: "Ski numbers", sub: "Days, hours, runs, falls", size: "lg" },
  { id: "skiRuns", category: "skiing", title: "Runs by difficulty", sub: "Green to double black", size: "sm" },
  { id: "skiCumulative", category: "skiing", title: "Runs, day by day", sub: "Running count of runs per difficulty", size: "md" },
  { id: "skiFalls", category: "skiing", title: "Falls by difficulty", sub: "Where the wipeouts happen", size: "sm" },

  // Food & drink
  { id: "meals", category: "food", title: "Cooked vs. ate out", sub: "Meals per week (breakfast, lunch, dinner)", size: "md" },
  { id: "drinks", category: "food", title: "Drinks per week", size: "md" },
  { id: "cuisines", category: "food", title: "Cuisines", sub: "Restaurant visits by type", size: "sm" },
  { id: "restaurants", category: "food", title: "Top restaurants", sub: "Visits", size: "sm" },
  { id: "mealRatings", category: "food", title: "Meal ratings", sub: "Average rating out of 10", size: "sm" },
  { id: "fruits", category: "food", title: "Fruits", sub: "Days eaten", size: "sm" },
  { id: "veggies", category: "food", title: "Vegetables", sub: "Days eaten", size: "sm" },
  { id: "meats", category: "food", title: "Meats", sub: "Days eaten", size: "sm" },
  { id: "snacks", category: "food", title: "Snacks", sub: "Days eaten", size: "sm" },
  { id: "candy", category: "food", title: "Candy", sub: "Days eaten", size: "sm" },
  { id: "candySeason", category: "food", title: "Candy by season", sub: "Days each candy showed up", size: "md" },

  // Wardrobe
  { id: "shirtColors", category: "wardrobe", title: "Shirt colors", sub: "Days worn", size: "sm" },
  { id: "greenShades", category: "wardrobe", title: "Top shades of green", sub: "Wears across shirt, pants, shoes, socks, hat and jacket", size: "md" },
  { id: "brands", category: "wardrobe", title: "Most-worn brands", sub: "All clothing columns pooled", size: "md" },
  { id: "outfits", category: "wardrobe", title: "Favorite outfits", sub: "Shirt + pants pairings worn most", size: "md" },

  // People
  { id: "people", category: "people", title: "People seen most", sub: "Days together", size: "sm" },
  { id: "friendFun", category: "people", title: "Fun with friends", sub: "Average fun meter on days you saw each person", size: "md" },

  // Travel & weather
  { id: "sky", category: "travel", title: "Sky", sub: "Days", size: "sm" },
  { id: "wakeCities", category: "travel", title: "Woke up in", sub: "Days per city", size: "sm" },
  { id: "transit", category: "travel", title: "Public transit", sub: "Rides", size: "sm" },
  { id: "states", category: "travel", title: "States visited", sub: "Days", size: "sm" },

  // Games
  { id: "videoGames", category: "fun", title: "Video games", sub: "Days played", size: "sm" },
];

export const CHART_IDS = new Set(CHARTS.map((c) => c.id));

/** What a first visit shows: the old dashboard's core plus the notebook's golf, climbing and sports figures. */
export const DEFAULT_CHARTS: string[] = [
  "tiles", "sleep", "funProd", "steps", "gymWeeks", "sportBubbles",
  "golfTiles", "golfScores18", "golfOutcomes", "golfCumulative",
  "climbTiles", "climbGrades", "climbCumulative",
  "meals", "drinks", "shirtColors", "people", "sky",
];

export const CHARTS_COOKIE = "dash_charts";

export function decodeSelection(raw: string | undefined | null): string[] | null {
  if (raw == null) return null;
  const ids = decodeURIComponent(raw).split(",").map((s) => s.trim()).filter((s) => CHART_IDS.has(s));
  return ids;
}

export const encodeSelection = (ids: string[]) => ids.filter((id) => CHART_IDS.has(id)).join(",");
