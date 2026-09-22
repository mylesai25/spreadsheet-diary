# Spreadsheet Diary

A web app (installable on iPhone as a home-screen app) for the daily spreadsheet diary.
It reads and writes the Google Sheet directly — the sheet stays the source of truth.

- **Log** (`/log`) — the 145-column *Daily Overview* row for any date as a sectioned form
  (Sleep · Day & Weather · Outfit · Food · Fitness · Getting around · People & Work · Play & Drinks).
  Unlogged days are prefilled with your usual answers; outfit pickers pull from the Virtual Closet sheet
  and fill in type/color/brand/design; only changed cells are written back.
  **Weather** (Sky / High / Low / Feels like) is auto-filled from [Open-Meteo](https://open-meteo.com) (no API key)
  for where you slept the previous night; "↻ Get weather" re-pulls it for whatever Wake Up City is on the form.
  Feels like = apparent temperature at your wake-up hour.
- **Dashboard** (`/`) — stat tiles and charts over 7d / 30d / 90d / YTD / all: sleep, fun & productivity,
  steps, gym days, cooked vs. ate out, drinks, golf, resting HR, shirt colors, sky, cities, people, cuisines…
- **Insights** (`/insights`) — the charts from the old `Diary_Graphs` Colab notebook, live: year calendars
  (shirt color / shade, pants, went outside, gym, cooked, alcohol, sick, sky), shades of green worn, most-worn
  brands, favorite outfits, sleep histogram, calories-vs-fun with correlation, monthly resting→peak heart rate,
  fun-with-friends, food top-lists, candy-by-season heatmap, hours by sport, transit, states, golf/climb/ski breakdowns.
- **Compare** (`/compare`) — this year vs. 2025 (or 2024): headline tiles with deltas, month-by-month grouped bars,
  cumulative "race" lines by day of year, and then-vs-now ranked tables (people, cities, shirt colors, restaurants…).
  "Same period" trims the prior year to Jan 1 → today's date for a fair comparison. Prior-year sheets are read-only.
- **Activities** (`/activities/<sheet>`) — add rows to Golf, Restaurant, Mini-Golf, Disc Golf, Climbing,
  Skiing, Video Game Rankings and Year Rankings, with recent entries listed.

## Run it

```bash
npm install
cp .env.example .env.local        # then see "Google access" below
npm run dev                       # http://localhost:3000
```

With `SHEET_ID` unset the app runs against the CSV exports in `data/` (handy for development;
edits go to the CSVs, not the sheet).

### Google access (one time)

```bash
gcloud auth login                 # if your gcloud session has expired
./scripts/setup-google.sh         # enables the Sheets API, creates a service account, writes .env.local
```

Then share **Spreadsheet_Journal_2026** and **Virtual_Closet_Spreadsheet** with the printed
`…@….iam.gserviceaccount.com` address as *Editor*. Restart `npm run dev`.

Alternative: leave `GOOGLE_SERVICE_ACCOUNT_JSON` empty and use your own login —
`gcloud auth application-default login --scopes=https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/cloud-platform`.

### Install on iPhone

Open the app in Safari → Share → **Add to Home Screen**. It launches full-screen with its own icon.
On your Mac it's reachable on the same Wi‑Fi at `http://<your-mac-name>.local:3000`; for anywhere-access, deploy.

### Deploy to Vercel

```bash
npx vercel                        # link the repo
```
Set the same variables as `.env.local` in the Vercel project (`SHEET_ID`, `CLOSET_SHEET_ID`,
`GOOGLE_SERVICE_ACCOUNT_JSON`, `APP_TZ`) **plus `APP_PASSWORD`** — that turns on the login gate so only
you can write to your sheet. Nothing else changes.

## Flutter app (`mobile/`)

A native client (iOS / Android / macOS / web) that uses this app as its backend through the JSON API:

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | connection check (`store`, `authRequired`) |
| `GET /api/schema` | Daily Overview sections/fields — the app renders its form from this |
| `GET /api/daily?date=` · `POST /api/daily` | load a day (values, defaults, options, closet) · save changed cells |
| `POST /api/weather` | Open‑Meteo lookup for a date + place |
| `GET /api/dashboard?range=` | dashboard metrics |
| `GET /api/activities` · `GET/POST /api/activities/:slug` | activity sheets |

Auth: `Authorization: Bearer <APP_PASSWORD>` (or the web session cookie); open when `APP_PASSWORD` is unset.
See `mobile/README.md` for running it.

## Layout

```
src/app/                  Next.js App Router pages (dashboard, log, activities, login, manifest)
src/components/           DailyForm, ActivityForm, form inputs, Recharts chart wrappers
src/lib/store/            Store interface: SheetsStore (googleapis) and CsvStore (data/*.csv)
src/lib/schema/           daily.ts (sections/fields), closet.ts (closet → outfit columns), activities.ts
src/lib/daily.ts          load a date's row, defaults, suggestion lists; diff-based save
src/lib/metrics.ts        dashboard aggregation
src/app/api/              JSON API used by the Flutter client
src/proxy.ts              optional password gate (active only when APP_PASSWORD is set; /api uses bearer auth)
mobile/                   Flutter client (see mobile/README.md)
data/                     xlsx exports + per-sheet CSVs: csv/ (2026), csv-2025/, csv-2024/, closet/ (Sept 22, 2026 snapshot)
scripts/xlsx2csv.py       stdlib xlsx → CSV converter (refresh data/ from a new export)
scripts/setup-google.sh   service-account bootstrap
```

### Notes on how writes work

- Daily rows already exist for every date of the year; saving updates only the cells you changed
  (`values.batchUpdate`), so formulas in untouched columns survive. Dates outside the sheet are appended.
- Booleans are written as `TRUE`/`FALSE` (checkbox-compatible); times as `HH:MM`; lists as `A, B, C`.
- Year Rankings is three side-by-side lists; a new TV show / movie / Broadway entry lands in the first
  empty row of its own column group.
