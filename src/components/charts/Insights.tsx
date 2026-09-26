"use client";

import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Scatter,
  Tooltip, XAxis, YAxis, ZAxis, Line, ComposedChart,
} from "recharts";
import type { CalendarView, Fit, FitPoint, Heat, HrMonth } from "@/lib/insights";
import type { Count } from "@/lib/metrics";
import { BOOL_PALETTE, colorFor, greenRamp, greenScale, inkOn, NEON } from "@/lib/colors";
import { formatShortDate } from "@/lib/dates";
import { axis, Empty, labelStyle, RankBars, tipBox } from "./Charts";

/* ───────────── Habit / color calendar (12 month facets, Sunday-start) — the "Days I Went to the Gym" figure ───────────── */

const SKY_PALETTE: Record<string, string> = {
  Sunny: "#ffd700", "Partly Sunny": "#f0c454", "Partly Cloudy": "#9ab0c8", Cloudy: "#6b7b8c", Rain: "#2a78d6", Snow: "#e6f0fa",
  Windy: "#00ff00", Fog: "#a8a8a8", Haze: "#c9bfa0", Sleet: "#7fa8d6", Hail: "#4a3aa7",
};

function paletteFor(view: CalendarView): Record<string, string> {
  if (view.kind === "bool") return BOOL_PALETTE;
  if (view.key === "sky") return SKY_PALETTE;
  const out: Record<string, string> = {};
  for (const v of new Set(Object.values(view.values))) out[v] = colorFor(v);
  return out;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function YearCalendar({ views, year }: { views: CalendarView[]; year: string }) {
  const [key, setKey] = useState(views[0]?.key);
  const view = views.find((v) => v.key === key) ?? views[0];
  if (!view) return <Empty />;
  const palette = paletteFor(view);
  const counts = new Map<string, number>();
  for (const v of Object.values(view.values)) counts.set(v, (counts.get(v) ?? 0) + 1);
  const legend = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const y = +year;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {views.map((v) => (
          <button key={v.key} type="button" className="tab" aria-pressed={v.key === view.key} onClick={() => setKey(v.key)}>{v.title}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }, (_, m) => (
          <MonthGrid key={m} year={y} month={m} values={view.values} palette={palette} />
        ))}
      </div>
      <div className="mt-5 flex justify-center">
        <div className="legend-box">
          <span className="mr-1 text-sm font-bold">{view.title}{view.kind === "bool" ? "?" : ""}</span>
          {legend.map(([v, n]) => (
            <span key={v} className="inline-flex items-center gap-1.5">
              <span className="swatch" style={{ background: palette[v] ?? "#8a8a8a" }} />
              {view.kind === "bool" ? (v === "TRUE" ? "TRUE" : "FALSE") : v} <span className="text-muted">{n}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="swatch" style={{ borderColor: "var(--border)" }} /> not logged</span>
        </div>
      </div>
    </div>
  );
}

function MonthGrid({ year, month, values, palette }: { year: number; month: number; values: Record<string, string>; palette: Record<string, string> }) {
  const first = new Date(Date.UTC(year, month, 1));
  const daysIn = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = first.getUTCDay(); // Sunday-start
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const name = first.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  return (
    <div>
      <div className="mb-1 text-center text-sm font-bold">{name}</div>
      <div className="border-[1.5px] border-neon bg-black p-[2px]">
        <div className="grid grid-cols-7 gap-[2px]">
          {cells.map((d, i) => {
            if (d == null) return <div key={i} />;
            const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const v = values[iso];
            const bg = v ? palette[v] ?? "#8a8a8a" : undefined;
            return (
              <div key={i} title={v ? `${formatShortDate(iso)}: ${v}` : formatShortDate(iso)}
                className={`grid aspect-square place-items-center text-[10px] font-semibold leading-none ${v ? "" : "border border-border text-muted"}`}
                style={v ? { background: bg, color: inkOn(bg!) } : undefined}>
                {d}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-0.5 grid grid-cols-7 text-center text-[9px] text-ink-2">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
    </div>
  );
}

/* ───────────── Ranked bars with per-bar named colors (shades of green) ───────────── */

export function ColorBars({ data, unit = "Days", height }: { data: Count[]; unit?: string; height?: number }) {
  return <RankBars data={data} unit={unit} height={height} colorByName />;
}

/* ───────────── Histogram with a target line ───────────── */

export function Histogram({ data, target, height = 220 }: { data: { bin: string; days: number }[]; target?: string; height?: number }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 12, left: -10, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="bin" {...axis} interval={0} />
        <YAxis {...axis} width={44} allowDecimals={false} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={({ active, payload, label }) => active && payload?.length ? (
          <div className={tipBox}><span className="text-ink-2">{label} slept</span> <span className="ml-2 font-bold">{payload[0].value} nights</span></div>
        ) : null} />
        {target && <ReferenceLine x={target} stroke="#ffffff" strokeDasharray="5 3" />}
        <Bar isAnimationActive={false} dataKey="days" name="Nights" fill="var(--viz-fill)" stroke={NEON} strokeWidth={1.5} maxBarSize={40}>
          <LabelList dataKey="days" position="top" style={{ ...labelStyle, fontSize: 11 }} formatter={(v: unknown) => (Number(v) ? String(v) : "")} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ───────────── Scatter with least-squares line and r — the "Calories Burned vs Fun Meter" figure ───────────── */

export function ScatterFit({ data, fit, xLabel, yLabel, height = 240 }: { data: FitPoint[]; fit: Fit | null; xLabel: string; yLabel: string; height?: number }) {
  if (data.length < 3) return <Empty text="Not enough days in this range" />;
  const xs = data.map((p) => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const line = fit ? [{ x: x0, y: fit.intercept + fit.slope * x0 }, { x: x1, y: fit.intercept + fit.slope * x1 }] : [];
  return (
    <div className="relative">
      {fit && (
        <div className="absolute bottom-8 right-3 z-10 border border-neon bg-[var(--viz-dot)] px-2 py-0.5 text-xs font-semibold text-black">
          Correlation (r) = {fit.r.toFixed(2)} · n = {fit.n}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={line} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--viz-grid)" />
          <XAxis dataKey="x" type="number" {...axis} domain={["auto", "auto"]} tickFormatter={(v) => Number(v).toLocaleString("en-US")} name={xLabel} />
          <YAxis dataKey="y" type="number" {...axis} domain={[0, 10]} width={40} name={yLabel} />
          <ZAxis range={[40, 40]} />
          <Tooltip cursor={{ stroke: "var(--viz-axis)" }} content={({ active, payload }) => {
            const p = payload?.[0]?.payload as FitPoint | undefined;
            return active && p?.date ? <div className={tipBox}><div className="text-xs text-muted">{formatShortDate(p.date)}</div>{xLabel}: <b>{p.x.toLocaleString("en-US")}</b> · {yLabel}: <b>{p.y}</b></div> : null;
          }} />
          <Scatter isAnimationActive={false} data={data} fill="var(--viz-dot)" fillOpacity={0.8} stroke="var(--viz-dot)" />
          {fit && <Line isAnimationActive={false} dataKey="y" stroke="#ffffff" strokeWidth={2} dot={false} activeDot={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───────────── Monthly resting ↔ peak heart-rate dumbbell — the "Heart Rate Spread" figure (white resting, lime peak) ───────────── */

export function Dumbbell({ data }: { data: HrMonth[] }) {
  if (!data.length) return <Empty />;
  const vals = data.flatMap((d) => [d.resting, d.peak]).filter((v): v is number => v != null);
  const lo = Math.floor(Math.min(...vals) / 10) * 10, hi = Math.ceil(Math.max(...vals) / 10) * 10;
  const W = 100; // percent-based
  const px = (v: number) => ((v - lo) / (hi - lo)) * W;
  const ticks = Array.from({ length: (hi - lo) / 10 + 1 }, (_, i) => lo + i * 10);
  const dot = "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black";
  return (
    <div className="text-xs">
      <div className="mb-3 flex items-center gap-3">
        <div className="legend-box">
          <span className="font-bold">Heart Rate Type</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full" style={{ background: NEON }} /> Peak</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-white" /> Resting</span>
        </div>
        <span className="ml-auto text-muted">monthly average bpm</span>
      </div>
      <div className="grid grid-cols-[2.4rem_1fr_5.5rem] gap-y-2">
        {data.map((d) => (
          <div key={d.month} className="contents">
            <div className="text-ink-2">{d.month}</div>
            <div className="relative mx-2 h-4">
              <div className="absolute inset-y-0 left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[var(--viz-grid)]" />
              {d.resting != null && d.peak != null && <div className="absolute top-1/2 h-[3px] -translate-y-1/2 bg-[#3f4f4f]" style={{ left: `${px(d.resting)}%`, width: `${px(d.peak) - px(d.resting)}%` }} />}
              {d.resting != null && <span title={`Resting ${d.resting}`} className={`${dot} bg-white`} style={{ left: `${px(d.resting)}%` }} />}
              {d.peak != null && <span title={`Peak ${d.peak}`} className={dot} style={{ left: `${px(d.peak)}%`, background: NEON }} />}
            </div>
            <div className="text-right tabular-nums text-ink-2">{d.resting != null ? Math.round(d.resting) : "—"} → {d.peak != null ? Math.round(d.peak) : "—"}</div>
          </div>
        ))}
        <div />
        <div className="relative mx-2 h-4 border-t border-[var(--viz-axis)]">
          {ticks.map((t) => <span key={t} className="absolute -translate-x-1/2 text-[10px] text-ink-2" style={{ left: `${px(t)}%` }}>{t}</span>)}
        </div>
        <div />
      </div>
    </div>
  );
}

/* ───────────── Sequential heatmap (candy × season) — the "Candy Eaten by Season" figure ───────────── */

export function Heatmap({ data, unit = "days" }: { data: Heat; unit?: string }) {
  if (!data.rows.length) return <Empty />;
  const max = Math.max(1, ...data.cells.flat());
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1 overflow-x-auto">
        <table className="w-full border-separate border-spacing-[3px] text-xs">
          <thead><tr><th />{data.cols.map((c) => <th key={c} className="pb-1 font-semibold text-ink">{c}</th>)}</tr></thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={r}>
                <td className="max-w-[10rem] truncate pr-2 text-right text-ink" title={r}>{r}</td>
                {data.cells[i].map((v, j) => {
                  const t = v / max;
                  return (
                    <td key={j} title={`${r} · ${data.cols[j]}: ${v} ${unit}`} className="h-7 w-16 text-center font-bold tabular-nums"
                      style={{ background: v ? greenScale(0.12 + t * 0.88) : "#000", color: v ? inkOn(greenScale(0.12 + t * 0.88)) : "var(--muted)", border: v ? "1px solid #0a3a0a" : "1px solid #101010" }}>
                      {v || ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-center text-xs sm:flex-col sm:items-start sm:self-start sm:pt-6">
        <span className="font-bold">{unit[0].toUpperCase() + unit.slice(1)}</span>
        <div className="flex items-center gap-1.5 sm:flex-col sm:items-start">
          <span className="text-ink-2">{max}</span>
          <div className="h-3 w-24 border border-neon sm:h-24 sm:w-3" style={{ background: `linear-gradient(to right, ${greenScale(0.12)}, ${greenScale(1)})` }} />
          <span className="text-ink-2">1</span>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Friends: days seen + avg fun ───────────── */

export function FriendBars({ data }: { data: { name: string; days: number; avgFun: number | null }[] }) {
  if (!data.length) return <Empty />;
  const n = data.length;
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 30 + 16)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap={4}>
        <XAxis type="number" hide domain={[0, 10]} />
        <YAxis type="category" dataKey="name" {...axis} axisLine={false} width={90} tick={{ fill: "var(--ink)", fontSize: 12 }} interval={0} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={({ active, payload }) => active && payload?.length ? (
          <div className={tipBox}><b>{payload[0].payload.name}</b><div className="text-ink-2">{payload[0].payload.days} days together · fun {payload[0].payload.avgFun}/10</div></div>
        ) : null} />
        <Bar isAnimationActive={false} dataKey="avgFun" name="Avg fun" stroke={NEON} strokeWidth={1.5} maxBarSize={20}>
          {data.map((d, i) => <Cell key={d.name} fill={greenRamp(i, n)} />)}
          <LabelList dataKey="avgFun" position="right" style={labelStyle} formatter={(v: unknown) => `${v}`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ───────────── Ranked list for long labels (favorite outfits) ───────────── */

export function RankList({ data, unit = "days" }: { data: Count[]; unit?: string }) {
  if (!data.length) return <Empty />;
  const max = Math.max(...data.map((d) => d.value));
  return (
    <ol className="flex flex-col gap-2.5 text-sm">
      {data.map((d, i) => (
        <li key={d.name}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate"><span className="mr-2 text-xs font-bold text-neon">{i + 1}.</span>{d.name}</span>
            <span className="shrink-0 text-xs font-bold tabular-nums">{d.value} {unit}</span>
          </div>
          <div className="mt-1 h-2 w-full border border-border bg-black"><div className="h-full" style={{ width: `${(d.value / max) * 100}%`, background: greenRamp(i, data.length) }} /></div>
        </li>
      ))}
    </ol>
  );
}
