import "server-only";
import { addDays, todayISO } from "./dates";

/** Daily weather for a place and date from Open-Meteo (no API key), shaped for the diary's columns. */
export interface DayWeather {
  sky: string;
  high: number;
  low: number;
  /** Apparent temperature at the wake-up hour. */
  feelsLike: number;
  place: string;
}

interface Geo { lat: number; lon: number; label: string }

const TIMEOUT_MS = 6000;
const geoCache = new Map<string, Geo | null>();
const wxCache = new Map<string, { at: number; data: DayWeather | null }>();

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return (await res.json()) as T;
}

interface GeoResult { name: string; admin1?: string; country_code?: string; country?: string; latitude: number; longitude: number; population?: number }

export async function geocode(city: string, state?: string, country?: string): Promise<Geo | null> {
  const key = [city, state, country].map((s) => (s ?? "").trim().toLowerCase()).join("|");
  if (!city.trim()) return null;
  if (geoCache.has(key)) return geoCache.get(key)!;
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}&count=10&language=en&format=json`;
  const data = await getJson<{ results?: GeoResult[] }>(url);
  const results = data.results ?? [];
  const norm = (s?: string) => (s ?? "").trim().toLowerCase();
  const wantState = norm(state), wantCountry = norm(country);
  const countryMatch = (r: GeoResult) => !wantCountry || norm(r.country) === wantCountry || norm(r.country_code) === wantCountry || (wantCountry === "usa" && norm(r.country_code) === "us");
  const pick =
    results.find((r) => wantState && norm(r.admin1) === wantState && countryMatch(r)) ??
    results.find((r) => countryMatch(r)) ??
    results[0];
  const geo = pick ? { lat: pick.latitude, lon: pick.longitude, label: [pick.name, pick.admin1, pick.country_code].filter(Boolean).join(", ") } : null;
  geoCache.set(key, geo);
  return geo;
}

/** WMO weather code → the Sky vocabulary already used in the sheet. */
export function skyFromCode(code: number, windMph: number): string {
  if (code === 0) return windMph >= 20 ? "Windy" : "Sunny";
  if (code === 1) return windMph >= 20 ? "Windy" : "Partly Sunny";
  if (code === 2) return windMph >= 20 ? "Windy" : "Partly Cloudy";
  if (code === 3) return windMph >= 25 ? "Windy" : "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Rain";
  if (code >= 61 && code <= 65) return "Rain";
  if (code === 66 || code === 67) return "Sleet";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain";
  if (code === 85 || code === 86) return "Snow";
  if (code === 96 || code === 99) return "Hail";
  if (code >= 95) return "Rain";
  return "Cloudy";
}

interface Daily { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; wind_speed_10m_max: number[] }
interface Hourly { time: string[]; apparent_temperature: (number | null)[] }

export async function getDayWeather(date: string, city: string, state?: string, country?: string, wakeTime = "08:00"): Promise<DayWeather | null> {
  const geo = await geocode(city, state, country);
  if (!geo) return null;
  const key = `${geo.lat},${geo.lon}|${date}|${wakeTime.slice(0, 2)}`;
  const hit = wxCache.get(key);
  const isToday = date >= todayISO();
  // Past days don't change; today's forecast is re-fetched hourly.
  if (hit && (!isToday || Date.now() - hit.at < 60 * 60 * 1000)) return hit.data;

  // The forecast endpoint covers the last ~3 months; older dates come from the historical-forecast
  // archive (same high-resolution models, so sky/temps line up with what you'd have seen that day).
  const old = date < addDays(todayISO(), -85);
  const host = old ? "https://historical-forecast-api.open-meteo.com/v1/forecast" : "https://api.open-meteo.com/v1/forecast";
  const params = new URLSearchParams({
    latitude: String(geo.lat), longitude: String(geo.lon),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max",
    hourly: "apparent_temperature", temperature_unit: "fahrenheit", wind_speed_unit: "mph",
    timezone: "auto", start_date: date, end_date: date,
  });
  const data = await getJson<{ daily?: Daily; hourly?: Hourly }>(`${host}?${params}`);
  const d = data.daily;
  if (!d?.time?.length || d.temperature_2m_max[0] == null) { wxCache.set(key, { at: Date.now(), data: null }); return null; }

  const hour = Math.min(23, Math.max(0, parseInt(wakeTime.slice(0, 2), 10) || 8));
  const hourly = data.hourly?.apparent_temperature ?? [];
  const feels = hourly[hour] ?? hourly.find((v) => v != null) ?? null;

  const result: DayWeather = {
    sky: skyFromCode(d.weather_code[0] ?? 3, d.wind_speed_10m_max[0] ?? 0),
    high: Math.round(d.temperature_2m_max[0]),
    low: Math.round(d.temperature_2m_min[0]),
    feelsLike: Math.round(feels ?? d.temperature_2m_min[0]),
    place: geo.label,
  };
  wxCache.set(key, { at: Date.now(), data: result });
  return result;
}

/** Column mapping for the Daily Overview sheet. */
export function weatherToColumns(w: DayWeather): Record<string, string> {
  return {
    Sky: w.sky,
    "High Temperature (F)": String(w.high),
    "Low Temperature (F)": String(w.low),
    "Feels Like (F)": String(w.feelsLike),
  };
}
