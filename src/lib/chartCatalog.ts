/**
 * The dashboard's menu of figures: every chart the app can draw, grouped the way the
 * Diary_Graphs notebook is sectioned. The picker on /dashboard turns entries on and off;
 * the chosen ids live in the `dash_charts` cookie so the server renders the right set first time.
 */

export type ChartSize = "sm" | "md" | "lg";
export type Category = "overview" | "sleep" | "fitness" | "golf" | "minigolf" | "discgolf" | "climbing" | "skiing" | "food" | "wardrobe" | "people" | "travel" | "work" | "fun";

export interface ChartDef { id: string; category: Category; title: string; sub?: string; size: ChartSize }

export const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "📓" },
  { key: "sleep", label: "Sleep & mood", icon: "😴" },
  { key: "fitness", label: "Fitness", icon: "💪" },
  { key: "golf", label: "Golf", icon: "⛳" },
  { key: "minigolf", label: "Mini golf", icon: "🏌️" },
  { key: "discgolf", label: "Disc golf", icon: "🥏" },
  { key: "climbing", label: "Climbing", icon: "🧗" },
  { key: "skiing", label: "Skiing", icon: "⛷️" },
  { key: "food", label: "Food & drink", icon: "🍜" },
  { key: "wardrobe", label: "Wardrobe", icon: "👕" },
  { key: "people", label: "People", icon: "👥" },
  { key: "travel", label: "Travel & weather", icon: "🚆" },
  { key: "work", label: "Work", icon: "💻" },
  { key: "fun", label: "Games & screen", icon: "🎮" },
];

export const CHARTS: ChartDef[] = [
  // Overview
  { id: "tiles", category: "overview", title: "Headline numbers", sub: "Days logged, sleep, fun, steps, gym, drinks, meals", size: "lg" },
  { id: "habitCalendars", category: "overview", title: "Year calendars", sub: "Every day of the year colored by what you logged", size: "lg" },
  { id: "streaks", category: "overview", title: "Streaks", sub: "Longest run of each good habit in this range (gym, outside, no alcohol, 10k steps, 7h sleep, cooked dinner) and where it stands now", size: "lg" },
  { id: "weekday", category: "overview", title: "Weekday profile", sub: "Average fun, productivity and sleep by day of the week", size: "md" },

  // Sleep & mood
  { id: "sleep", category: "sleep", title: "Sleep", sub: "Hours slept per night with 7-day average", size: "md" },
  { id: "sleepHist", category: "sleep", title: "Sleep distribution", sub: "Nights by hours slept · dashed line = 8-hour target", size: "md" },
  { id: "funProd", category: "sleep", title: "Fun & productivity", sub: "Daily self-ratings, 1–10", size: "md" },
  { id: "calFun", category: "sleep", title: "Calories burned vs fun meter", sub: "Does a big day make a fun day?", size: "md" },
  { id: "sleepFun", category: "sleep", title: "Sleep vs fun meter", sub: "Does a long night make a fun day?", size: "md" },
  { id: "hours", category: "sleep", title: "Bedtime & wake-up", sub: "Nights by bedtime hour, mornings by wake-up hour", size: "md" },
  { id: "battery", category: "sleep", title: "Morning phone battery", sub: "Mornings by battery left when you woke up", size: "md" },
  { id: "funSky", category: "sleep", title: "Fun by weather", sub: "Average fun meter on days with each sky (3+ days)", size: "sm" },

  // Fitness
  { id: "steps", category: "fitness", title: "Steps", sub: "Steps per day with 7-day average", size: "md" },
  { id: "gymWeeks", category: "fitness", title: "Gym days per week", sub: "Days with a gym visit (Sunday-start weeks)", size: "md" },
  { id: "hrSpread", category: "fitness", title: "Heart rate spread", sub: "Resting → peak, monthly average", size: "md" },
  { id: "restingHR", category: "fitness", title: "Resting heart rate", sub: "Beats per minute", size: "md" },
  { id: "sportBubbles", category: "fitness", title: "Hours by sport", sub: "Circle area = time played (Sports Played × Duration)", size: "md" },
  { id: "sportDays", category: "fitness", title: "Days by sport", sub: "Days each sport was played", size: "sm" },
  { id: "stepsWeekday", category: "fitness", title: "Steps by weekday", sub: "Average steps per day of the week", size: "md" },

  // Golf
  { id: "golfTiles", category: "golf", title: "Golf numbers", sub: "Solo rounds (Regular / Wolf), like the notebook", size: "lg" },
  { id: "golfScores18", category: "golf", title: "18-hole scores", sub: "Every solo 18-hole round, in order played", size: "md" },
  { id: "golfToPar", category: "golf", title: "Score to par & putts", sub: "Per round, over time", size: "md" },
  { id: "golfOutcomes", category: "golf", title: "Hole outcomes", sub: "Birdies, pars, bogeys… across solo rounds", size: "sm" },
  { id: "golfCumulative", category: "golf", title: "Outcomes, round by round", sub: "Running count of each hole result", size: "md" },
  { id: "golfPutts", category: "golf", title: "Putting", sub: "Holes by putt count", size: "sm" },
  { id: "golfCourses", category: "golf", title: "Courses played", sub: "Rounds per course", size: "sm" },
  { id: "golfFairways", category: "golf", title: "Fairways & greens hit", sub: "FIR% and GIR% per solo round, in order played", size: "md" },
  { id: "golfByCourse", category: "golf", title: "Score to par by course", sub: "Average strokes over par, solo rounds · easiest first", size: "sm" },
  { id: "golfCart", category: "golf", title: "Cart vs walking", sub: "Median 18-hole score", size: "sm" },

  // Mini golf
  { id: "miniTiles", category: "minigolf", title: "Mini golf numbers", sub: "Rounds, scoring, hole-in-ones, wins", size: "lg" },
  { id: "miniScores", category: "minigolf", title: "Rounds to par", sub: "Strokes over par per round, in order played", size: "md" },
  { id: "miniPutts", category: "minigolf", title: "Putts per hole", sub: "Hole-in-ones to four-putts", size: "sm" },
  { id: "miniCourses", category: "minigolf", title: "Courses played", sub: "Rounds per course", size: "sm" },
  { id: "miniWinners", category: "minigolf", title: "Who won", sub: "Rounds won by each player", size: "sm" },

  // Disc golf
  { id: "discTiles", category: "discgolf", title: "Disc golf numbers", sub: "Rounds, scoring, birdies, wins, miles", size: "lg" },
  { id: "discScores", category: "discgolf", title: "Rounds to par", sub: "Throws over par per round, in order played", size: "md" },
  { id: "discOutcomes", category: "discgolf", title: "Hole outcomes", sub: "Aces, birdies, pars, bogeys…", size: "sm" },
  { id: "discCumulative", category: "discgolf", title: "Outcomes, round by round", sub: "Running count of each hole result", size: "md" },
  { id: "discCourses", category: "discgolf", title: "Courses played", sub: "Rounds per course", size: "sm" },
  { id: "discWinners", category: "discgolf", title: "Who won", sub: "Rounds won by each player", size: "sm" },

  // Climbing
  { id: "climbTiles", category: "climbing", title: "Climbing numbers", sub: "Sessions, time on the wall, sends", size: "lg" },
  { id: "climbGrades", category: "climbing", title: "Climbs completed", sub: "By V-grade", size: "sm" },
  { id: "climbCumulative", category: "climbing", title: "Sends, session by session", sub: "Running count of completed climbs per grade", size: "md" },
  { id: "climbSendRate", category: "climbing", title: "Send rate", sub: "Completed ÷ attempted, per grade", size: "sm" },
  { id: "climbGyms", category: "climbing", title: "Gyms", sub: "Sessions per gym", size: "sm" },
  { id: "climbColors", category: "climbing", title: "Color circuits sent", sub: "Gyms that grade by color instead of V-grade", size: "sm" },
  { id: "climbColorRate", category: "climbing", title: "Send rate by color", sub: "Completed ÷ attempted, per circuit", size: "sm" },

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
  { id: "candyVeg", category: "food", title: "Which candies spoiled your appetite for vegetables", sub: "The notebook's lift heatmap: red = less candy on days with that vegetable", size: "lg" },
  { id: "drinkTypes", category: "food", title: "What you drank", sub: "Days each drink type showed up", size: "sm" },
  { id: "cuisineRatings", category: "food", title: "Best-rated cuisines", sub: "Average food rating, 2+ visits", size: "sm" },

  // Wardrobe
  { id: "shirtColors", category: "wardrobe", title: "Shirt colors", sub: "Days worn", size: "sm" },
  { id: "greenShades", category: "wardrobe", title: "Top shades of green", sub: "Wears across shirt, pants, shoes, socks, hat and jacket", size: "md" },
  { id: "brands", category: "wardrobe", title: "Most-worn brands", sub: "All clothing columns pooled", size: "md" },
  { id: "outfits", category: "wardrobe", title: "Favorite outfits", sub: "Shirt + pants pairings worn most", size: "md" },
  { id: "jacketTemp", category: "wardrobe", title: "When the jacket comes out", sub: "Share of days with a jacket, hat or two layers, by high temperature", size: "md" },

  // People
  { id: "people", category: "people", title: "People seen most", sub: "Days together", size: "sm" },
  { id: "friendFun", category: "people", title: "Fun with friends", sub: "Average fun meter on days you saw each person", size: "md" },

  // Travel & weather
  { id: "sky", category: "travel", title: "Sky", sub: "Days", size: "sm" },
  { id: "wakeCities", category: "travel", title: "Woke up in", sub: "Days per city", size: "sm" },
  { id: "transit", category: "travel", title: "Public transit", sub: "Rides", size: "sm" },
  { id: "states", category: "travel", title: "States visited", sub: "Days", size: "sm" },
  { id: "temps", category: "travel", title: "Temperature", sub: "Daily high and low, °F", size: "md" },

  // Work
  { id: "projects", category: "work", title: "Projects", sub: "Days worked on each", size: "sm" },
  { id: "projectProd", category: "work", title: "Productivity by project", sub: "Average productivity on days you worked on each (3+ days)", size: "sm" },

  // Games
  { id: "videoGames", category: "fun", title: "Video games", sub: "Days played", size: "sm" },
  { id: "gameRatings", category: "fun", title: "Game ratings", sub: "Your Video Game Rankings sheet, out of 10", size: "sm" },
  { id: "boardGames", category: "fun", title: "Board games", sub: "Days played", size: "sm" },
  { id: "tvRatings", category: "fun", title: "TV ratings", sub: "Your Year Rankings sheet, out of 10", size: "md" },
  { id: "movieRatings", category: "fun", title: "Movie ratings", sub: "Your Year Rankings sheet, out of 10", size: "sm" },
  { id: "broadwayRatings", category: "fun", title: "Broadway ratings", sub: "Your Year Rankings sheet, out of 10", size: "sm" },
  { id: "shows", category: "fun", title: "Dinner-table TV", sub: "Shows watched during meals, by days", size: "sm" },
  { id: "services", category: "fun", title: "Streaming services", sub: "Meals watched on each", size: "sm" },
];

export const CHART_IDS = new Set(CHARTS.map((c) => c.id));

/** What a first visit shows: the old dashboard's core, the notebook's golf, climbing and sports figures, streaks and the weekday profile. */
export const DEFAULT_CHARTS: string[] = [
  "tiles", "streaks", "weekday", "sleep", "funProd", "steps", "gymWeeks", "sportBubbles",
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
