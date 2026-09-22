"use client";

import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Scatter,
  Tooltip, XAxis, YAxis, ZAxis, Line, ComposedChart,
} from "recharts";
import type { CalendarView, Fit, FitPoint, Heat, HrMonth } from "@/lib/insights";
import type { Count } from "@/lib/metrics";
import { BOOL_PALETTE, colorFor, inkOn } from "@/lib/colors";
import { formatShortDate } from "@/lib/dates";
import { Empty } from "./Charts";

const S1 = "var(--series-1)", S2 = "var(--series-2)";
const axis = { stroke: "var(--viz-axis)", tick: { fill: "var(--viz-muted)", fontSize: 11 }, tickLine: false, axisLine: false } as const;
const tipBox = "rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-md";

/* ───────────── Habit / color calendar (12 month facets, Sunday-start) ───────────── */

const SKY_PALETTE: Record<string, string> = {
  Sunny: "#eda100", "Partly Sunny": "#f0c454", "Partly Cloudy": "#9ab0c8", Cloudy: "#6b7b8c", Rain: "#2a78d6", Snow: "#cfe3f5",
  Windy: "#1baf7a", Fog: "#a8a8a8", Haze: "#c9bfa0", Sleet: "#7fa8d6", Hail: "#4a3aa7",
};

function paletteFor(view: CalendarView): Record<string, string> {
  if (view.kind === "bool") return BOOL_PALETTE;
  if (view.key === "sky") return SKY_PALETTE;
  const out: Record<string, string> = {};
  for (const v of new Set(Object.values(view.values))) out[v] = colorFor(v);
  return out;
}

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
      <div className="mb-3 flex flex-wrap gap-1">
        {views.map((v) => (
          <button key={v.key} type="button" onClick={() => setKey(v.key)}
            className={`rounded-full px-3 py-1 text-xs ${v.key === view.key ? "bg-ink text-page" : "bg-surface-2 text-ink-2 hover:text-ink"}`}>
            {v.title}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }, (_, m) => (
          <MonthGrid key={m} year={y} month={m} values={view.values} palette={palette} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
        {legend.map(([v, n]) => (
          <span key={v} className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm border border-border" style={{ background: palette[v] ?? "#8a8a8a" }} />
            {view.kind === "bool" ? (v === "TRUE" ? "Yes" : "No") : v} <span className="text-muted">{n}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-border bg-surface" /> not logged</span>
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
      <div className="mb-1 text-xs font-medium text-ink-2">{name}</div>
      <div className="grid grid-cols-7 gap-[2px]">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="text-center text-[9px] text-muted">{d}</div>)}
        {cells.map((d, i) => {
          if (d == null) return <div key={i} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const v = values[iso];
          const bg = v ? palette[v] ?? "#8a8a8a" : undefined;
          return (
            <div key={i} title={v ? `${formatShortDate(iso)}: ${v}` : formatShortDate(iso)}
              className={`grid aspect-square place-items-center rounded-[3px] text-[9px] leading-none ${v ? "" : "border border-border text-muted"}`}
              style={v ? { background: bg, color: inkOn(bg!) } : undefined}>
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────── Ranked bars with per-bar named colors (shades of green) ───────────── */

export function ColorBars({ data, unit = "Days", height }: { data: Count[]; unit?: string; height?: number }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(120, data.length * 30 + 16)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }} barCategoryGap={4}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" {...axis} width={124} tick={{ fill: "var(--ink-2)", fontSize: 12 }} interval={0} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={({ active, payload }) => active && payload?.length ? (
          <div className={tipBox}><span className="text-ink-2">{payload[0].payload.name}</span> <span className="ml-2 font-medium">{payload[0].value} {unit.toLowerCase()}</span></div>
        ) : null} />
        <Bar isAnimationActive={false} dataKey="value" name={unit} radius={[0, 4, 4, 0]} maxBarSize={20} stroke="var(--border)">
          {data.map((d) => <Cell key={d.name} fill={colorFor(d.name)} />)}
          <LabelList dataKey="value" position="right" style={{ fill: "var(--ink-2)", fontSize: 12 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
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
          <div className={tipBox}><span className="text-ink-2">{label} slept</span> <span className="ml-2 font-medium">{payload[0].value} nights</span></div>
        ) : null} />
        {target && <ReferenceLine x={target} stroke="var(--ink)" strokeDasharray="4 3" />}
        <Bar isAnimationActive={false} dataKey="days" name="Nights" fill={S1} radius={[4, 4, 0, 0]} maxBarSize={40}>
          <LabelList dataKey="days" position="top" style={{ fill: "var(--ink-2)", fontSize: 11 }} formatter={(v: unknown) => (Number(v) ? String(v) : "")} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ───────────── Scatter with least-squares line and r ───────────── */

export function ScatterFit({ data, fit, xLabel, yLabel, height = 240 }: { data: FitPoint[]; fit: Fit | null; xLabel: string; yLabel: string; height?: number }) {
  if (data.length < 3) return <Empty text="Not enough days in this range" />;
  const xs = data.map((p) => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const line = fit ? [{ x: x0, y: fit.intercept + fit.slope * x0 }, { x: x1, y: fit.intercept + fit.slope * x1 }] : [];
  return (
    <div className="relative">
      {fit && (
        <div className="absolute right-2 top-0 z-10 rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
          r = {fit.r.toFixed(2)} · n = {fit.n}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={line} margin={{ top: 24, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--viz-grid)" />
          <XAxis dataKey="x" type="number" {...axis} domain={["auto", "auto"]} tickFormatter={(v) => Number(v).toLocaleString("en-US")} name={xLabel} />
          <YAxis dataKey="y" type="number" {...axis} domain={[0, 10]} width={40} name={yLabel} />
          <ZAxis range={[36, 36]} />
          <Tooltip cursor={{ stroke: "var(--viz-axis)" }} content={({ active, payload }) => {
            const p = payload?.[0]?.payload as FitPoint | undefined;
            return active && p?.date ? <div className={tipBox}><div className="text-xs text-muted">{formatShortDate(p.date)}</div>{xLabel}: <b>{p.x.toLocaleString("en-US")}</b> · {yLabel}: <b>{p.y}</b></div> : null;
          }} />
          <Scatter isAnimationActive={false} data={data} fill={S1} fillOpacity={0.55} stroke={S1} />
          {fit && <Line isAnimationActive={false} dataKey="y" stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───────────── Monthly resting ↔ peak heart-rate dumbbell ───────────── */

export function Dumbbell({ data }: { data: HrMonth[] }) {
  if (!data.length) return <Empty />;
  const vals = data.flatMap((d) => [d.resting, d.peak]).filter((v): v is number => v != null);
  const lo = Math.floor(Math.min(...vals) / 10) * 10, hi = Math.ceil(Math.max(...vals) / 10) * 10;
  const W = 100; // percent-based
  const px = (v: number) => ((v - lo) / (hi - lo)) * W;
  const ticks = Array.from({ length: (hi - lo) / 10 + 1 }, (_, i) => lo + i * 10);
  return (
    <div className="text-xs">
      <div className="mb-2 flex items-center gap-3 text-ink-2">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: S1 }} /> Resting</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: S2 }} /> Peak</span>
        <span className="ml-auto text-muted">monthly average bpm</span>
      </div>
      <div className="grid grid-cols-[2.2rem_1fr_5.5rem] gap-y-2">
        {data.map((d) => (
          <div key={d.month} className="contents">
            <div className="text-ink-2">{d.month}</div>
            <div className="relative mx-2 h-4">
              {d.resting != null && d.peak != null && <div className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-line" style={{ left: `${px(d.resting)}%`, width: `${px(d.peak) - px(d.resting)}%` }} />}
              {d.resting != null && <span title={`Resting ${d.resting}`} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface" style={{ left: `${px(d.resting)}%`, background: S1 }} />}
              {d.peak != null && <span title={`Peak ${d.peak}`} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface" style={{ left: `${px(d.peak)}%`, background: S2 }} />}
            </div>
            <div className="text-right tabular-nums text-ink-2">{d.resting != null ? Math.round(d.resting) : "—"} → {d.peak != null ? Math.round(d.peak) : "—"}</div>
          </div>
        ))}
        <div />
        <div className="relative mx-2 h-4 border-t border-line">
          {ticks.map((t) => <span key={t} className="absolute -translate-x-1/2 text-[10px] text-muted" style={{ left: `${px(t)}%` }}>{t}</span>)}
        </div>
        <div />
      </div>
    </div>
  );
}

/* ───────────── Sequential heatmap (candy × season) ───────────── */

export function Heatmap({ data, unit = "days" }: { data: Heat; unit?: string }) {
  if (!data.rows.length) return <Empty />;
  const max = Math.max(1, ...data.cells.flat());
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[3px] text-xs">
        <thead><tr><th />{data.cols.map((c) => <th key={c} className="pb-1 font-medium text-ink-2">{c}</th>)}</tr></thead>
        <tbody>
          {data.rows.map((r, i) => (
            <tr key={r}>
              <td className="max-w-[9rem] truncate pr-2 text-right text-ink-2" title={r}>{r}</td>
              {data.cells[i].map((v, j) => {
                const t = v / max;
                const bg = v ? `color-mix(in oklab, var(--series-1) ${Math.round(25 + t * 75)}%, var(--surface))` : "var(--surface-2)";
                return <td key={j} title={`${r} · ${data.cols[j]}: ${v} ${unit}`} className="h-7 w-16 rounded-md text-center tabular-nums" style={{ background: bg, color: v && t > 0.55 ? "#fff" : "var(--ink-2)" }}>{v || ""}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────── Friends: days seen + avg fun ───────────── */

export function FriendBars({ data }: { data: { name: string; days: number; avgFun: number | null }[] }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 30 + 16)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap={4}>
        <XAxis type="number" hide domain={[0, 10]} />
        <YAxis type="category" dataKey="name" {...axis} width={90} tick={{ fill: "var(--ink-2)", fontSize: 12 }} interval={0} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={({ active, payload }) => active && payload?.length ? (
          <div className={tipBox}><b>{payload[0].payload.name}</b><div className="text-ink-2">{payload[0].payload.days} days together · fun {payload[0].payload.avgFun}/10</div></div>
        ) : null} />
        <Bar isAnimationActive={false} dataKey="avgFun" name="Avg fun" fill={S1} radius={[0, 4, 4, 0]} maxBarSize={20}>
          <LabelList dataKey="avgFun" position="right" style={{ fill: "var(--ink-2)", fontSize: 12 }} formatter={(v: unknown) => `${v}`} />
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
    <ol className="flex flex-col gap-2 text-sm">
      {data.map((d, i) => (
        <li key={d.name}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate"><span className="mr-2 text-xs text-muted">{i + 1}.</span>{d.name}</span>
            <span className="shrink-0 text-xs text-ink-2">{d.value} {unit}</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: S1 }} /></div>
        </li>
      ))}
    </ol>
  );
}
