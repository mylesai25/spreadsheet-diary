// Refresh the CSV fallback snapshot straight from Google Sheets (no xlsx export needed).
//   node scripts/sheet2csv.mjs closet      → data/closet/*.csv   (CLOSET_SHEET_ID)
//   node scripts/sheet2csv.mjs journal     → data/csv/*.csv      (SHEET_ID)
// Reads .env.local for the ids and the service-account key, like the app does.
import { google } from "googleapis";
import fs from "node:fs";
import path from "node:path";

for (const line of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const book = process.argv[2] ?? "closet";
const targets = { closet: ["CLOSET_SHEET_ID", "data/closet"], journal: ["SHEET_ID", "data/csv"] };
const [envKey, outdir] = targets[book] ?? [`SHEET_ID_${book}`, `data/csv-${book}`];
const id = process.env[envKey];
if (!id) { console.error(`${envKey} is not set`); process.exit(1); }

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const auth = raw
  ? new google.auth.GoogleAuth({ credentials: JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")), scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] })
  : new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
const api = google.sheets({ version: "v4", auth });

const csvCell = (v) => { const s = v == null ? "" : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const meta = await api.spreadsheets.get({ spreadsheetId: id });
fs.mkdirSync(outdir, { recursive: true });
for (const s of meta.data.sheets ?? []) {
  const name = s.properties.title;
  const res = await api.spreadsheets.values.get({ spreadsheetId: id, range: `'${name}'`, valueRenderOption: "FORMATTED_VALUE" });
  const rows = (res.data.values ?? []).map((r) => r.map((c) => (c == null ? "" : String(c))));
  while (rows.length && rows[rows.length - 1].every((c) => c === "")) rows.pop();
  let width = Math.max(0, ...rows.map((r) => r.length));
  while (width && rows.every((r) => r.length < width || r[width - 1] === "")) width--;
  const out = rows.map((r) => { const p = r.slice(0, width); while (p.length < width) p.push(""); return p.map(csvCell).join(","); });
  const fn = path.join(outdir, name.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") + ".csv");
  fs.writeFileSync(fn, out.join("\r\n") + "\r\n");
  console.log(`${name.padEnd(30)} -> ${path.basename(fn).padEnd(30)} ${String(rows.length).padStart(5)} rows x ${String(width).padStart(3)} cols`);
}
