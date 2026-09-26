"use client";

import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList, Cell,
} from "recharts";
import type { Count, DayPoint, GolfRound, Tile as TileData, WeekPoint } from "@/lib/metrics";
import { formatShortDate } from "@/lib/dates";
import { colorFor, greenRamp, NEON } from "@/lib/colors";

/* ── Figure vocabulary (from the Diary_Graphs notebook): lime lines, white as the second series,
      green bar fills with lime outlines, gray grid, white bold labels. ── */
export const S = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
export const BAR_FILL = ["var(--viz-fill)", "#ffffff", "#7fff7f", "#ffd700"];
export const BAR_STROKE = [NEON, "#ffffff", "#7fff7f", "#ffd700"];
export const axis = { stroke: "var(--viz-axis)", tick: { fill: "var(--viz-muted)", fontSize: 11 }, tickLine: false, axisLine: { stroke: "var(--viz-axis)" } } as const;
export const grid = <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeDasharray="0" />;
export const legendStyle = { fontSize: 12, color: "var(--ink)" } as const;
export const labelStyle = { fill: "var(--ink)", fontSize: 12, fontWeight: 700 } as const;
export const tipBox = "border-[1.5px] border-neon bg-black px-3 py-2 text-sm text-ink shadow-[0_8px_24px_rgba(0,255,0,0.15)]";

export function Tip({ active, payload, label, fmt, title }: { active?: boolean; payload?: { name: string; value: number | string; color?: string; dataKey?: string }[]; label?: string; fmt?: (v: number) => string; title?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={tipBox}>
      <div className="mb-1 text-xs text-muted">{title ? title(String(label)) : label}</div>
      {payload.filter((p) => p.value != null && p.value !== "").map((p) => (
        <div key={String(p.dataKey ?? p.name)} className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 border border-black" style={{ background: p.color, outline: `1px solid ${p.color}` }} />
          <span className="text-ink-2">{p.name}</span>
          <span className="ml-auto font-bold tabular-nums">{typeof p.value === "number" ? (fmt ? fmt(p.value) : p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

/** A framed figure: black panel, lime border, white bold title. */
export function ChartCard({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card flex flex-col p-4 ${className}`}>
      <header className="mb-3">
        <h3 className="text-[15px] font-bold leading-tight">{title}</h3>
        {sub && <p className="mt-0.5 text-xs text-ink-2">{sub}</p>}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

/** Headline number in a framed panel. */
export function Tile({ label, value, sub }: TileData) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-neon">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums leading-none tracking-tight">{value}</div>
      {sub && <div className="mt-1.5 text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

export function Empty({ text = "No data in this range" }: { text?: string }) {
  return <div className="grid h-40 place-items-center text-sm text-muted">{text}</div>;
}

const DAY = 86_400_000;
const toTs = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const fromTs = (ts: number) => new Date(ts).toISOString().slice(0, 10);

/** Calendar-aligned ticks: every day (≤10d), Sundays (≤35d), 1st & 15th (≤120d), else 1st of month. */
function timeAxis(dates: string[]) {
  const ts = dates.map(toTs);
  const min = Math.min(...ts), max = Math.max(...ts);
  const span = (max - min) / DAY + 1;
  const ticks: number[] = [];
  for (let t = min; t <= max; t += DAY) {
    const d = new Date(t);
    const day = d.getUTCDate(), dow = d.getUTCDay();
    const keep = span <= 10 ? true : span <= 35 ? dow === 0 : span <= 120 ? day === 1 || day === 15 : day === 1;
    if (keep) ticks.push(t);
  }
  const monthly = span > 120;
  const fmt = (t: number) => (monthly ? new Date(t).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) : formatShortDate(fromTs(t)));
  const pad = span <= 35 ? DAY / 2 : 0;
  return { domain: [min - pad, max + pad] as [number, number], ticks, fmt };
}

function TimeXAxis({ dates }: { dates: string[] }) {
  const a = timeAxis(dates);
  return <XAxis dataKey="ts" type="number" scale="time" domain={a.domain} ticks={a.ticks} tickFormatter={a.fmt} interval={0} {...axis} />;
}

const withTs = <T extends { date: string }>(rows: T[]) => rows.map((r) => ({ ...r, ts: toTs(r.date) }));

/** Daily series over time; each key is a line (max 3). `area` fills the first key. */
export function TimeLines({ data, keys, names, unit, domain, height = 220, area, avgKey, avgName }: {
  data: DayPoint[]; keys: (keyof DayPoint)[]; names: string[]; unit?: string; domain?: [number, number];
  height?: number; area?: boolean; avgKey?: keyof DayPoint; avgName?: string;
}) {
  if (!data.length) return <Empty />;
  const dense = data.length > 60;
  const rows = withTs(data);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        {grid}
        <TimeXAxis dates={data.map((d) => d.date)} />
        <YAxis {...axis} domain={domain ?? ["auto", "auto"]} width={44} tickFormatter={(v) => `${v}${unit ?? ""}`} />
        <Tooltip content={<Tip title={(l) => formatShortDate(fromTs(Number(l)))} />} cursor={{ stroke: "var(--viz-axis)" }} />
        {keys.length > 1 && <Legend iconType="square" iconSize={9} wrapperStyle={legendStyle} />}
        {keys.map((k, i) =>
          area && i === 0 ? (
            <Area isAnimationActive={false} key={k} type="monotone" dataKey={k} name={names[i]} stroke={S[i]} fill={S[i]} fillOpacity={0.18} strokeWidth={2} dot={false} connectNulls />
          ) : (
            <Line isAnimationActive={false} key={k} type="monotone" dataKey={k} name={names[i]} stroke={S[i]} strokeWidth={2} dot={dense ? false : { r: 3, strokeWidth: 0, fill: S[i] }} activeDot={{ r: 5, stroke: "#000" }} connectNulls />
          ),
        )}
        {avgKey && <Line isAnimationActive={false} type="monotone" dataKey={avgKey} name={avgName ?? "7-day avg"} stroke="#ffffff" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

const fmtInt = (v: number) => Math.round(v).toLocaleString("en-US");

/** Daily bars (e.g. steps) with an optional rolling average line. */
export function DayBars({ data, dataKey, name, avgKey, height = 220 }: { data: DayPoint[]; dataKey: keyof DayPoint; name: string; avgKey?: keyof DayPoint; height?: number }) {
  if (!data.length) return <Empty />;
  const rows = withTs(data);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 12, left: -4, bottom: 0 }} barCategoryGap={2}>
        {grid}
        <TimeXAxis dates={data.map((d) => d.date)} />
        <YAxis {...axis} width={56} tickFormatter={fmtInt} />
        <Tooltip content={<Tip title={(l) => formatShortDate(fromTs(Number(l)))} fmt={fmtInt} />} cursor={{ fill: "var(--surface-2)" }} />
        <Bar isAnimationActive={false} dataKey={dataKey} name={name} fill={BAR_FILL[0]} stroke={NEON} strokeWidth={1} maxBarSize={28} />
        {avgKey && <Line isAnimationActive={false} type="monotone" dataKey={avgKey} name="7-day avg" stroke="#ffffff" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />}
        {avgKey && <Legend iconType="square" iconSize={9} wrapperStyle={legendStyle} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Weekly grouped bars for one or two measures (green, then white — the heart-rate figure's pairing). */
export function WeekBars({ data, keys, names, height = 220, refLine }: { data: WeekPoint[]; keys: (keyof WeekPoint)[]; names: string[]; height?: number; refLine?: number }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={3} barCategoryGap="25%">
        {grid}
        <XAxis dataKey="label" {...axis} minTickGap={24} />
        <YAxis {...axis} width={Math.max(...data.flatMap((d) => keys.map((k) => Number(d[k]) || 0))) >= 1000 ? 56 : 40} allowDecimals={false} tickFormatter={(v) => Number(v).toLocaleString("en-US")} />
        <Tooltip content={<Tip title={(l) => `Week of ${l}`} />} cursor={{ fill: "var(--surface-2)" }} />
        {keys.length > 1 && <Legend iconType="square" iconSize={9} wrapperStyle={legendStyle} />}
        {refLine != null && <ReferenceLine y={refLine} stroke="#ffffff" strokeDasharray="4 3" />}
        {keys.map((k, i) => <Bar isAnimationActive={false} key={k} dataKey={k} name={names[i]} fill={BAR_FILL[i]} stroke={BAR_STROKE[i]} strokeWidth={1.5} maxBarSize={32} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Horizontal ranked bars, brightest at the top (the brands figure's ramp).
 * `colorByName` paints each bar with the named color it represents (shirt colors, shades of green), lime-outlined.
 */
export function RankBars({ data, colorByName, unit, height, max, labelWidth = 124 }: { data: Count[]; colorByName?: boolean; unit?: string; height?: number; max?: number; labelWidth?: number }) {
  if (!data.length) return <Empty />;
  const h = height ?? Math.max(120, data.length * 30 + 16);
  const n = data.length;
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }} barCategoryGap={4}>
        <XAxis type="number" hide domain={[0, max ?? "auto"]} />
        <YAxis type="category" dataKey="name" {...axis} axisLine={false} width={labelWidth} tick={{ fill: "var(--ink)", fontSize: 12 }} interval={0} tickFormatter={(v: string) => { const n = Math.floor(labelWidth / 7); return v.length > n ? v.slice(0, n - 1) + "…" : v; }} />
        <Tooltip content={<Tip />} cursor={{ fill: "var(--surface-2)" }} />
        <Bar isAnimationActive={false} dataKey="value" name={unit ?? "Days"} stroke={NEON} strokeWidth={1.5} maxBarSize={20}>
          {data.map((d, i) => <Cell key={d.name} fill={colorByName ? colorFor(d.name, greenRamp(i, n)) : greenRamp(i, n)} />)}
          <LabelList dataKey="value" position="right" style={labelStyle} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Vertical ranked bars with angled labels and values on top — the "most-worn brands" / "shades of green" figures.
 * `asPercentOf` labels each bar as a share of that total (the figures' "— Percent" variant).
 */
export function VerticalBars({ data, unit, height = 280, colorByName, asPercentOf, max }: {
  data: Count[]; unit?: string; height?: number; colorByName?: boolean; asPercentOf?: number; max?: number;
}) {
  if (!data.length) return <Empty />;
  const n = data.length;
  const rows = asPercentOf ? data.map((d) => ({ ...d, raw: d.value, value: Math.round((d.value / asPercentOf) * 1000) / 10 })) : data.map((d) => ({ ...d, raw: d.value }));
  const label = (v: unknown) => (asPercentOf ? `${v}%` : String(v));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 18, right: 8, left: -14, bottom: 4 }} barCategoryGap="18%">
        {grid}
        <XAxis dataKey="name" {...axis} interval={0} angle={-40} textAnchor="end" height={72} tickMargin={6} tick={{ fill: "var(--ink)", fontSize: 11, fontWeight: 700 }} tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 15) + "…" : v)} />
        <YAxis {...axis} width={48} domain={[0, max ?? "auto"]} tickFormatter={(v) => (asPercentOf ? `${v}%` : Number(v).toLocaleString("en-US"))} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={({ active, payload }) => active && payload?.length ? (
          <div className={tipBox}>
            <div className="text-xs text-muted">{payload[0].payload.name}</div>
            <b>{payload[0].payload.raw.toLocaleString("en-US")}</b> {(unit ?? "days").toLowerCase()}{asPercentOf ? ` · ${payload[0].value}%` : ""}
          </div>
        ) : null} />
        <Bar isAnimationActive={false} dataKey="value" name={unit ?? "Days"} stroke={NEON} strokeWidth={1.5} maxBarSize={56}>
          {rows.map((d, i) => <Cell key={d.name} fill={colorByName ? colorFor(d.name, greenRamp(i, n)) : greenRamp(i, n)} />)}
          <LabelList dataKey="value" position="top" style={labelStyle} formatter={label} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GolfChart({ data, height = 220 }: { data: GolfRound[]; height?: number }) {
  if (!data.length) return <Empty text="No rounds in this range" />;
  const rows = withTs(data);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        {grid}
        <TimeXAxis dates={data.map((d) => d.date)} />
        <YAxis {...axis} width={44} tickFormatter={(v) => (v > 0 ? `+${v}` : String(v))} />
        <Tooltip content={<Tip title={(l) => { const iso = fromTs(Number(l)); const r = data.find((x) => x.date === iso); return r ? `${formatShortDate(iso)} · ${r.course} (${r.score})` : iso; }} />} cursor={{ stroke: "var(--viz-axis)" }} />
        <ReferenceLine y={0} stroke="var(--viz-muted)" strokeDasharray="3 3" label={{ value: "par", position: "insideTopRight", fill: "var(--viz-muted)", fontSize: 11 }} />
        <Legend iconType="square" iconSize={9} wrapperStyle={legendStyle} />
        <Line isAnimationActive={false} type="monotone" dataKey="toPar" name="Score to par" stroke={S[0]} strokeWidth={2} dot={{ r: 3.5, strokeWidth: 0, fill: S[0] }} activeDot={{ r: 5, stroke: "#000" }} />
        <Line isAnimationActive={false} type="monotone" dataKey="putts" name="Putts" stroke={S[1]} strokeWidth={2} dot={{ r: 3.5, strokeWidth: 0, fill: S[1] }} activeDot={{ r: 5, stroke: "#000" }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
