"use client";

import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList, Cell,
} from "recharts";
import type { Count, DayPoint, GolfRound, WeekPoint } from "@/lib/metrics";
import { formatShortDate } from "@/lib/dates";

const S = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
const axis = { stroke: "var(--viz-axis)", tick: { fill: "var(--viz-muted)", fontSize: 11 }, tickLine: false, axisLine: false } as const;
const grid = <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeDasharray="0" />;

function Tip({ active, payload, label, fmt, title }: { active?: boolean; payload?: { name: string; value: number | string; color?: string; dataKey?: string }[]; label?: string; fmt?: (v: number) => string; title?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-md">
      <div className="mb-1 text-xs text-muted">{title ? title(String(label)) : label}</div>
      {payload.filter((p) => p.value != null && p.value !== "").map((p) => (
        <div key={String(p.dataKey ?? p.name)} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-ink-2">{p.name}</span>
          <span className="ml-auto font-medium tabular-nums">{typeof p.value === "number" ? (fmt ? fmt(p.value) : p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ChartCard({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card flex flex-col p-4 ${className}`}>
      <header className="mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
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
        {keys.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} />}
        {keys.map((k, i) =>
          area && i === 0 ? (
            <Area isAnimationActive={false} key={k} type="monotone" dataKey={k} name={names[i]} stroke={S[i]} fill={S[i]} fillOpacity={0.12} strokeWidth={2} dot={false} connectNulls />
          ) : (
            <Line isAnimationActive={false} key={k} type="monotone" dataKey={k} name={names[i]} stroke={S[i]} strokeWidth={2} dot={dense ? false : { r: 3, strokeWidth: 0, fill: S[i] }} activeDot={{ r: 5 }} connectNulls />
          ),
        )}
        {avgKey && <Line isAnimationActive={false} type="monotone" dataKey={avgKey} name={avgName ?? "7-day avg"} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Daily bars (e.g. steps) with an optional rolling average line. */
const fmtInt = (v: number) => Math.round(v).toLocaleString("en-US");

export function DayBars({ data, dataKey, name, avgKey, height = 220 }: { data: DayPoint[]; dataKey: keyof DayPoint; name: string; avgKey?: keyof DayPoint; height?: number }) {
  if (!data.length) return <Empty />;
  const fmt = fmtInt;
  const rows = withTs(data);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 12, left: -4, bottom: 0 }} barCategoryGap={2}>
        {grid}
        <TimeXAxis dates={data.map((d) => d.date)} />
        <YAxis {...axis} width={56} tickFormatter={(v) => (fmt ? fmt(v) : v)} />
        <Tooltip content={<Tip title={(l) => formatShortDate(fromTs(Number(l)))} fmt={fmt} />} cursor={{ fill: "var(--surface-2)" }} />
        <Bar isAnimationActive={false} dataKey={dataKey} name={name} fill={S[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
        {avgKey && <Line isAnimationActive={false} type="monotone" dataKey={avgKey} name="7-day avg" stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />}
        {avgKey && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Weekly grouped bars for one or two measures. */
export function WeekBars({ data, keys, names, height = 220, refLine }: { data: WeekPoint[]; keys: (keyof WeekPoint)[]; names: string[]; height?: number; refLine?: number }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2} barCategoryGap="25%">
        {grid}
        <XAxis dataKey="label" {...axis} minTickGap={24} />
        <YAxis {...axis} width={Math.max(...data.flatMap((d) => keys.map((k) => Number(d[k]) || 0))) >= 1000 ? 56 : 40} allowDecimals={false} tickFormatter={(v) => Number(v).toLocaleString("en-US")} />
        <Tooltip content={<Tip title={(l) => `Week of ${l}`} />} cursor={{ fill: "var(--surface-2)" }} />
        {keys.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} />}
        {refLine != null && <ReferenceLine y={refLine} stroke="var(--viz-muted)" strokeDasharray="3 3" />}
        {keys.map((k, i) => <Bar isAnimationActive={false} key={k} dataKey={k} name={names[i]} fill={S[i]} radius={[4, 4, 0, 0]} maxBarSize={32} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

const NAMED: Record<string, string> = {
  Green: "#1a7f37", Black: "#3b3b3b", Blue: "#2a78d6", White: "#d9d9d4", Gray: "#8a8a8a", Grey: "#8a8a8a", Brown: "#8b5a2b", Red: "#d03b3b", Purple: "#7a4bd1", Yellow: "#e0b000", Orange: "#eb6834", Pink: "#e87ba4", Navy: "#1f3a93",
};

/** Horizontal ranked bars. `colorByName` paints each bar with the named color it represents (shirt colors). */
export function RankBars({ data, colorByName, unit, height, max }: { data: Count[]; colorByName?: boolean; unit?: string; height?: number; max?: number }) {
  if (!data.length) return <Empty />;
  const h = height ?? Math.max(120, data.length * 30 + 16);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }} barCategoryGap={4}>
        <XAxis type="number" hide domain={[0, max ?? "auto"]} />
        <YAxis type="category" dataKey="name" {...axis} width={124} tick={{ fill: "var(--ink-2)", fontSize: 12 }} interval={0} tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + "…" : v)} />
        <Tooltip content={<Tip />} cursor={{ fill: "var(--surface-2)" }} />
        <Bar isAnimationActive={false} dataKey="value" name={unit ?? "Days"} fill={S[0]} radius={[0, 4, 4, 0]} maxBarSize={20}>
          {colorByName && data.map((d) => <Cell key={d.name} fill={NAMED[d.name] ?? S[0]} />)}
          <LabelList dataKey="value" position="right" style={{ fill: "var(--ink-2)", fontSize: 12 }} />
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
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} />
        <Line isAnimationActive={false} type="monotone" dataKey="toPar" name="Score to par" stroke={S[0]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: S[0] }} activeDot={{ r: 5 }} />
        <Line isAnimationActive={false} type="monotone" dataKey="putts" name="Putts" stroke={S[1]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: S[1] }} activeDot={{ r: 5 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
