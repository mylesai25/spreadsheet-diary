"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CumPoint, Metric, MonthPoint, RankCompare } from "@/lib/compare";
import { Empty } from "./Charts";

const A = "var(--series-1)", B = "var(--series-2)";
const axis = { stroke: "var(--viz-axis)", tick: { fill: "var(--viz-muted)", fontSize: 11 }, tickLine: false, axisLine: false } as const;
const tipBox = "rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-md";
const fmt = (v: number | null, d = 1) => (v == null ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 }));

/* ───────────── Headline tiles with delta ───────────── */

export function DeltaTile({ m, yearB }: { m: Metric; yearA?: number; yearB: number }) {
  const d = m.a != null && m.b != null ? m.a - m.b : null;
  const pct = d != null && m.b ? (d / Math.abs(m.b)) * 100 : null;
  const good = d == null || m.higherIsBetter == null || d === 0 ? null : (d > 0) === m.higherIsBetter;
  const tone = good == null ? "text-ink-2" : good ? "text-accent" : "text-danger";
  const sameish = d != null && fmt(Math.abs(d), m.decimals) === "0";
  const arrow = d == null || sameish ? "" : d > 0 ? "▲" : "▼";
  const unit = m.unit && !["unique", "meals"].includes(m.unit) ? m.unit : "";
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-medium text-muted">{m.label}{m.unit && ["unique", "meals"].includes(m.unit) ? ` (${m.unit})` : ""}</div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className="text-2xl font-semibold tracking-tight">{fmt(m.a, m.decimals)}<span className="ml-0.5 text-sm font-normal text-ink-2">{unit}</span></span>
        {d != null && (sameish ? (
          <span className="text-xs font-medium text-muted">≈ same</span>
        ) : (
          <span className={`whitespace-nowrap text-xs font-medium ${tone}`}>
            {arrow} {fmt(Math.abs(d), m.decimals)}{pct != null && Math.abs(pct) >= 1 && m.kind !== "pct" ? ` (${Math.round(Math.abs(pct))}%)` : m.kind === "pct" ? " pts" : ""}
          </span>
        ))}
      </div>
      <div className="text-xs text-ink-2">{yearB}: {fmt(m.b, m.decimals)}{unit}</div>
    </div>
  );
}

/* ───────────── Month-by-month grouped bars ───────────── */

export function MonthCompare({ data, yearA, yearB, unit, height = 220 }: { data: MonthPoint[]; yearA: number; yearB: number; unit?: string; height?: number }) {
  if (!data.length) return <Empty />;
  const big = Math.max(0, ...data.flatMap((p) => [p.a ?? 0, p.b ?? 0])) >= 1000;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: big ? -2 : -14, bottom: 4 }} barGap={2} barCategoryGap="25%">
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="month" {...axis} interval={0} angle={-45} textAnchor="end" height={36} tickMargin={4} />
        <YAxis {...axis} width={big ? 56 : 48} tickFormatter={(v) => Number(v).toLocaleString("en-US")} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={({ active, payload, label }) => active && payload?.length ? (
          <div className={tipBox}>
            <div className="mb-1 text-xs text-muted">{label}</div>
            {payload.map((p) => <div key={String(p.dataKey)} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} /><span className="text-ink-2">{p.name}</span><span className="ml-auto font-medium tabular-nums">{fmt(p.value as number)}{unit ?? ""}</span></div>)}
          </div>
        ) : null} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} />
        <Bar isAnimationActive={false} dataKey="b" name={String(yearB)} fill={B} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar isAnimationActive={false} dataKey="a" name={String(yearA)} fill={A} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ───────────── Cumulative race by day of year ───────────── */

const MONTH_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const doyLabel = (d: number) => { let i = MONTH_STARTS.findIndex((s) => s > d); if (i < 0) i = 12; return `${MONTHS[i - 1]} ${d - MONTH_STARTS[i - 1] + 1}`; };

export function CumulativeRace({ data, yearA, yearB, unit, height = 220 }: { data: CumPoint[]; yearA: number; yearB: number; unit?: string; height?: number }) {
  if (!data.length) return <Empty />;
  const last = data[data.length - 1].doy;
  const ticks = MONTH_STARTS.filter((s) => s <= last);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="doy" type="number" domain={[1, last]} ticks={ticks} tickFormatter={(d) => MONTHS[MONTH_STARTS.indexOf(d)]} interval={0} {...axis} />
        <YAxis {...axis} width={48} tickFormatter={(v) => Number(v).toLocaleString("en-US")} />
        <Tooltip cursor={{ stroke: "var(--viz-axis)" }} content={({ active, payload, label }) => active && payload?.length ? (
          <div className={tipBox}>
            <div className="mb-1 text-xs text-muted">{doyLabel(Number(label))}</div>
            {payload.filter((p) => p.value != null).map((p) => <div key={String(p.dataKey)} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} /><span className="text-ink-2">{p.name}</span><span className="ml-auto font-medium tabular-nums">{fmt(p.value as number)}{unit ?? ""}</span></div>)}
          </div>
        ) : null} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} />
        <Line isAnimationActive={false} type="monotone" dataKey="b" name={String(yearB)} stroke={B} strokeWidth={2} dot={false} connectNulls />
        <Line isAnimationActive={false} type="monotone" dataKey="a" name={String(yearA)} stroke={A} strokeWidth={2} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ───────────── Then-vs-now ranked table ───────────── */

export function RankTable({ data, yearA, yearB }: { data: RankCompare; yearA: number; yearB: number }) {
  if (!data.rows.length) return <Empty />;
  const max = Math.max(1, ...data.rows.flatMap((r) => [r.a, r.b]));
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-muted">
        <tr><th className="pb-1 text-left font-medium">&nbsp;</th><th className="w-24 pb-1 text-right font-medium">{yearB}</th><th className="w-24 pb-1 text-right font-medium">{yearA}</th><th className="w-14 pb-1 text-right font-medium">Δ</th></tr>
      </thead>
      <tbody>
        {data.rows.map((r) => {
          const d = r.a - r.b;
          return (
            <tr key={r.name} className="border-t border-border">
              <td className="max-w-[10rem] truncate py-1.5 pr-2" title={r.name}>{r.name}</td>
              <td className="py-1.5 text-right tabular-nums text-ink-2"><span className="mr-2 inline-block h-2 rounded-sm align-middle" style={{ width: `${(r.b / max) * 48}px`, background: B }} />{r.b}</td>
              <td className="py-1.5 text-right tabular-nums"><span className="mr-2 inline-block h-2 rounded-sm align-middle" style={{ width: `${(r.a / max) * 48}px`, background: A }} />{r.a}</td>
              <td className={`py-1.5 text-right text-xs tabular-nums ${d > 0 ? "text-accent" : d < 0 ? "text-danger" : "text-muted"}`}>{d > 0 ? `+${d}` : d === 0 ? "=" : d}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
