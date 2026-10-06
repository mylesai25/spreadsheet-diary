"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Cumulative, SendRate, Slice } from "@/lib/activityStats";
import type { Count, Tile as TileData } from "@/lib/metrics";
import { NEON } from "@/lib/colors";
import { formatShortDate } from "@/lib/dates";
import { axis, Empty, legendStyle, Tile, tipBox } from "./Charts";

/* ───────────── A row of headline tiles (golf / climbing / ski numbers) ───────────── */

export function TileRow({ tiles }: { tiles: TileData[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => <Tile key={t.label} {...t} />)}
    </div>
  );
}

/* ───────────── The notebook's cumulative_line_graph: running totals per series, one point per session ───────────── */

export function CumulativeLines({ data, height = 240 }: { data: Cumulative; height?: number }) {
  if (data.rows.length < 2 || !data.series.length) return <Empty text="No sessions in this range" />;
  const last = data.rows.length - 1;
  const finals = data.series.map((s) => Number(data.rows[last][s.key]) || 0);
  const yMax = niceMax(Math.max(1, ...finals));
  // End labels: nudge apart any that would land within 12px of each other (plot height ≈ height − margins − axis − legend).
  const plotH = height - 8 - 4 - 30 - 24;
  const px = (v: number) => (1 - v / yMax) * plotH;
  const order = data.series.map((s, i) => ({ i, y: px(finals[i]) })).sort((a, b) => a.y - b.y);
  const offsets = new Array<number>(data.series.length).fill(0);
  let floor = -Infinity;
  for (const o of order) { const y = Math.max(o.y, floor); offsets[o.i] = y - o.y; floor = y + 12; }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data.rows} margin={{ top: 8, right: 76, left: -18, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="i" type="number" domain={[0, last]} allowDecimals={false} tickCount={Math.min(last + 1, 8)} {...axis} label={{ value: data.xLabel, position: "insideBottomRight", offset: -2, fill: "var(--viz-muted)", fontSize: 11 }} />
        <YAxis {...axis} width={44} allowDecimals={false} domain={[0, yMax]} />
        <Tooltip cursor={{ stroke: "var(--viz-axis)" }} content={({ active, payload, label }) => {
          const row = payload?.[0]?.payload as Cumulative["rows"][number] | undefined;
          return active && payload?.length && row ? (
            <div className={tipBox}>
              <div className="mb-1 text-xs text-muted">{row.date ? `${data.xLabel} ${label} · ${formatShortDate(row.date)}` : "Before the first session"}</div>
              {payload.map((p) => (
                <div key={String(p.dataKey)} className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
                  <span className="text-ink-2">{p.name}</span>
                  <span className="ml-auto font-bold tabular-nums">{p.value as number}</span>
                </div>
              ))}
            </div>
          ) : null;
        }} />
        <Legend iconType="square" iconSize={9} wrapperStyle={legendStyle} />
        {data.series.map((s, si) => (
          <Line
            key={s.key} isAnimationActive={false} type="linear" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false}
            activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2, fill: s.color }}
            label={(p: { x?: number | string; y?: number | string; index?: number; value?: unknown }) =>
              p.index === last && p.x != null && p.y != null ? (
                <text x={Number(p.x) + 6} y={Number(p.y) + 4 + offsets[si]} fill="var(--ink)" fontSize={11} fontWeight={700}>{s.name} {String(p.value)}</text>
              ) : <g />}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Round an axis maximum up to a tidy number (1-2-5 steps) so the label math above matches what's drawn. */
function niceMax(max: number): number {
  const mag = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (max <= m * mag * 1.0001) return Math.ceil(max / (m * mag / 4)) * (m * mag / 4) || m * mag;
  return max;
}

/* ───────────── The notebook's category_pie_chart, as a donut with the counts beside it ───────────── */

export function Donut({ data, unit = "holes", size = 170 }: { data: Slice[]; unit?: string; size?: number }) {
  const total = data.reduce((a, s) => a + s.value, 0);
  if (!total) return <Empty />;
  const R = size / 2, r0 = R * 0.6, cx = R, cy = R;
  const starts = data.reduce<number[]>((acc, s, i) => [...acc, (i ? acc[i - 1] + (data[i - 1].value / total) * Math.PI * 2 : -Math.PI / 2)], []);
  const arcs = data.map((s, i) => {
    const a0 = starts[i], a1 = a0 + (s.value / total) * Math.PI * 2;
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number, r: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
    const d = data.length === 1
      ? `M ${p(a0, R)} A ${R} ${R} 0 1 1 ${p(a0 + Math.PI, R)} A ${R} ${R} 0 1 1 ${p(a0, R)} M ${p(a0, r0)} A ${r0} ${r0} 0 1 0 ${p(a0 + Math.PI, r0)} A ${r0} ${r0} 0 1 0 ${p(a0, r0)}`
      : `M ${p(a0, R)} A ${R} ${R} 0 ${big} 1 ${p(a1, R)} L ${p(a1, r0)} A ${r0} ${r0} 0 ${big} 0 ${p(a0, r0)} Z`;
    return { ...s, d, pct: Math.round((s.value / total) * 100) };
  });
  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${total} ${unit}`}>
        {arcs.map((a) => <path key={a.name} d={a.d} fill={a.color} stroke="var(--surface)" strokeWidth={2} fillRule="evenodd"><title>{a.name}: {a.value} {unit} ({a.pct}%)</title></path>)}
        <text x={cx} y={cy - 2} textAnchor="middle" fill="var(--ink)" fontSize={22} fontWeight={700}>{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--viz-muted)" fontSize={11}>{unit}</text>
      </svg>
      <ul className="flex min-w-[9rem] flex-col gap-1.5 text-sm">
        {arcs.map((a) => (
          <li key={a.name} className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: a.color }} />
            <span className="text-ink">{a.name}</span>
            <span className="ml-auto pl-3 font-bold tabular-nums">{a.value}</span>
            <span className="w-9 text-right text-xs tabular-nums text-ink-2">{a.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────── Send rate per grade: completed ÷ attempted ───────────── */

export function SendRateBars({ data }: { data: SendRate[] }) {
  if (!data.length) return <Empty text="No attempts logged" />;
  const rows = data.map((d) => ({ ...d, value: d.rate ?? 0, label: `${d.completed}/${d.attempted}${d.rate != null ? ` · ${d.rate}%` : ""}` }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, rows.length * 32 + 16)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 100, left: 0, bottom: 0 }} barCategoryGap={4}>
        <XAxis type="number" hide domain={[0, 100]} />
        <YAxis type="category" dataKey="grade" {...axis} axisLine={false} width={36} tick={{ fill: "var(--ink)", fontSize: 12, fontWeight: 700 }} interval={0} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={({ active, payload }) => active && payload?.length ? (
          <div className={tipBox}><b>{payload[0].payload.grade}</b><div className="text-ink-2">{payload[0].payload.completed} sent of {payload[0].payload.attempted} attempted</div></div>
        ) : null} />
        <Bar isAnimationActive={false} dataKey="value" name="Send rate" stroke={NEON} strokeWidth={1} maxBarSize={20} minPointSize={3}>
          {rows.map((d) => <Cell key={d.grade} fill={d.color} />)}
          <LabelList dataKey="label" position="right" style={{ fill: "var(--ink)", fontSize: 11, fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ───────────── Circle packing of hours by sport (the notebook's packcircles figure) ───────────── */

interface Packed { name: string; value: number; r: number; x: number; y: number }

/** Greedy packing: biggest circle at the origin, each next one walks a spiral until it touches nothing. */
function pack(items: Count[]): Packed[] {
  const sorted = [...items].filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
  const out: Packed[] = [];
  for (const it of sorted) {
    const r = Math.sqrt(it.value / Math.PI);
    if (!out.length) { out.push({ ...it, r, x: 0, y: 0 }); continue; }
    let placed: Packed | null = null;
    for (let t = 0; t < 4000 && !placed; t++) {
      const a = t * 0.17, d = 0.06 * t;
      const x = d * Math.cos(a), y = d * Math.sin(a);
      if (out.every((o) => Math.hypot(o.x - x, o.y - y) >= o.r + r + 0.02 * r)) placed = { ...it, r, x, y };
    }
    if (placed) out.push(placed);
  }
  return out;
}

const mix = (a: [number, number, number], b: [number, number, number], t: number) => `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * t)).join(",")})`;

export function BubblePack({ data, unit = "hours", height = 260 }: { data: Count[]; unit?: string; height?: number }) {
  const circles = pack(data);
  if (!circles.length) return <Empty />;
  const minX = Math.min(...circles.map((c) => c.x - c.r)), maxX = Math.max(...circles.map((c) => c.x + c.r));
  const minY = Math.min(...circles.map((c) => c.y - c.r)), maxY = Math.max(...circles.map((c) => c.y + c.r));
  const pad = (maxX - minX) * 0.02;
  const vb = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  const big = circles[0].r;
  const n = circles.length;
  return (
    <div className="flex flex-col gap-3">
      <svg viewBox={vb} style={{ width: "100%", height }} role="img" aria-label={`Hours by sport, ${n} sports`}>
        {circles.map((c, i) => {
          const fs = Math.max(0.1, Math.min(c.r * 0.34, big * 0.22));
          const showLabel = c.r > big * 0.28;
          return (
            <g key={c.name}>
              <circle cx={c.x} cy={c.y} r={c.r} fill={mix([12, 70, 36], [0, 110, 110], n > 1 ? i / (n - 1) : 0)} stroke={NEON} strokeWidth={big * 0.025} />
              <title>{c.name}: {c.value} {unit}</title>
              {showLabel && (
                <text x={c.x} y={c.y} textAnchor="middle" fill="#fff" fontWeight={700} fontSize={fs} style={{ pointerEvents: "none" }}>
                  <tspan x={c.x} dy={-fs * 0.2}>{c.name}</tspan>
                  <tspan x={c.x} dy={fs * 1.1} fontWeight={400}>{c.value} {unit}</tspan>
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {circles.map((c, i) => <li key={c.name}><span className="font-bold text-ink">{i + 1}.</span> {c.name} <span className="tabular-nums">{c.value} {unit}</span></li>)}
      </ul>
    </div>
  );
}
