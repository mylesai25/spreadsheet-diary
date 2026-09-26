/** Named clothing colors → hex, carried over from the Diary_Graphs notebook (detail_cols / GREEN_HEX / cols). */
export const NAMED_COLORS: Record<string, string> = {
  // Greens
  "Lime Green": "#32CD32", "Kelly Green": "#4CBB17", "Forest Green": "#228B22", "Dark Green": "#023020",
  "Jungle Green": "#2AAA8A", "Electric Lime": "#CCFF00", "Olive Green": "#808000", "Cadmium Green": "#097969",
  "Pastel Green": "#C1E1C1", "Seafoam Green": "#9FE2BF", "Mint Green": "#98FF98", "Eucalyptus": "#5F8575",
  "Emerald Green": "#50C878", "Hunter Green": "#355E3B", "Moss Green": "#8A9A5B", "Gray Green": "#5E716A",
  "Fern Green": "#4F7942", "Neon Green": "#0FFF50", "Pistachio": "#93C572", "Nyanza": "#E9FFDB", "Light Green": "#90EE90",
  "Green": "#008000", "Sage": "#9CAF88", "Teal": "#008080", "Sea Green": "#2E8B57", "Army Green": "#4B5320",
  // Blues
  "Blue": "#0000FF", "Light Blue": "#ADD8E6", "Dark Blue": "#00008B", "Navy Blue": "#1f3a93", "Navy": "#1f3a93",
  "Cornflour Blue": "#6495ED", "Cerulean": "#007BA7", "Cyan": "#00FFFF", "Blue Green": "#0D98BA", "Royal Blue": "#4169E1",
  // Neutrals & others
  "White": "#FFFFFF", "Black": "#000000", "Gray": "#808080", "Grey": "#808080", "Brown": "#8B4513", "Tan": "#D2B48C",
  "Khaki": "#F0E68C", "Beige": "#F5F5DC", "Cream": "#FFFDD0", "Red": "#FF0000", "Crimson": "#DC143C", "Maroon": "#800000",
  "Orange": "#FFA500", "Yellow": "#FFD700", "Pink": "#FFC0CB", "Magenta": "#FF00FF", "Purple": "#800080", "Silver": "#C0C0C0",
  "Gold": "#FFD700", "Burgundy": "#800020", "NA": "#A0A0A0",
};

/** The figures' ink: lime frames/outlines, black paper, white type. */
export const NEON = "#00ff00";
export const PAPER = "#000000";

export function colorFor(name: string, fallback = "#8a8a8a"): string {
  return NAMED_COLORS[name] ?? NAMED_COLORS[name.replace(/\s*\(.*\)$/, "")] ?? fallback;
}

/** Black or white text for a hex background (black on lime/red/white like the calendar figures, white on dark cells). */
export function inkOn(hex: string): string {
  const m = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.18 ? "#000000" : "#ffffff";
}

/**
 * Rank ramp from the "most-worn brands" figure: the top bars glow lime, the tail fades to forest green.
 * `i` is the 0-based rank, `n` the number of bars.
 */
export function greenRamp(i: number, n: number): string {
  const t = n <= 1 ? 0 : Math.min(1, Math.max(0, i / (n - 1)));
  const from = [0, 255, 0], to = [10, 74, 10];
  return `rgb(${from.map((c, k) => Math.round(c + (to[k] - c) * t)).join(",")})`;
}

/** Sequential scale for heatmaps: near-black green → lime. */
export function greenScale(t: number): string {
  const x = Math.min(1, Math.max(0, t));
  const from = [6, 32, 6], to = [0, 255, 0];
  return `rgb(${from.map((c, k) => Math.round(c + (to[k] - c) * x)).join(",")})`;
}

/** Calendar palette for TRUE/FALSE habit views (notebook: neon green / red). */
export const BOOL_PALETTE: Record<string, string> = { TRUE: "#00ff00", FALSE: "#ff0000" };
