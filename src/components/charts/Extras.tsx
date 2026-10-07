"use client";

import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GroupRow, LiftHeat } from "@/lib/insights";
import { greenScale, inkOn } from "@/lib/colors";
import { axis, BAR_FILL, BAR_STROKE, Empty, labelStyle, legendStyle, Tip } from "./Charts";

/* ───────────── Grouped vertical bars over category labels (weekday profile, clock hours, temperature bins) ───────────── */

export function GroupBars({ data, keys, names, unit, max, height = 220, fmt, labels, nKey = "n" }: {
  data: GroupRow[]; keys: string[]; names: string[]; unit?: string; max?: number; height?: number;
  /** Tick / tooltip formatter for the values. */
  fmt?: (v: number) => string;
  /** Print the value on top of each bar (single-series charts). */
  labels?: boolean;
  /** Row field holding the day count shown in the tooltip, if any. */
  nKey?: string;
}) {
  if (!data.length || !data.some((r) => keys.some((k) => r[k] != null))) return <Empty />;
  const f = fmt ?? ((v: number) => (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(1)));
  const peak = Math.max(0, ...data.flatMap((r) => keys.map((k) => Number(r[k]) || 0)));
  const yWidth = peak >= 10000 ? 60 : peak >= 1000 ? 54 : 44;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: labels ? 18 : 8, right: 8, left: -14, bottom: 0 }} barGap={3} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="label" {...axis} interval={data.length > 12 ? 1 : 0} tick={{ fill: "var(--ink)", fontSize: 11, fontWeight: 700 }} />
        <YAxis {...axis} width={yWidth} domain={[0, max ?? "auto"]} tickFormatter={(v) => `${f(Number(v))}${unit ?? ""}`} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<Tip fmt={(v) => `${f(v)}${unit ?? ""}`} title={(l) => { const r = data.find((d) => d.label === l); const n = r?.[nKey]; return n ? `${l} · ${n} days` : l; }} />} />
        {keys.length > 1 && <Legend iconType="square" iconSize={9} wrapperStyle={legendStyle} itemSorter={() => 0} />}
        {keys.map((k, i) => (
          <Bar key={k} isAnimationActive={false} dataKey={k} name={names[i]} fill={BAR_FILL[i % BAR_FILL.length]} stroke={BAR_STROKE[i % BAR_STROKE.length]} strokeWidth={1} maxBarSize={40}>
            {labels && <LabelList dataKey={k} position="top" style={{ ...labelStyle, fontSize: 11 }} formatter={(v: unknown) => (v == null ? "" : `${f(Number(v))}${unit ?? ""}`)} />}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ───────────── Diverging heatmap — the notebook's "Which candies spoiled my appetite for vegetables" (red ← neutral → green) ───────────── */

const RED = [225, 29, 72] as const;
function liftColor(v: number, max: number): string {
  const t = Math.min(1, Math.abs(v) / max);
  if (v >= 0) return greenScale(0.12 + t * 0.88);
  const from = [40, 22, 26];
  return `rgb(${from.map((c, k) => Math.round(c + (RED[k] - c) * (0.15 + t * 0.85))).join(",")})`;
}

export function LiftHeatmap({ data }: { data: LiftHeat }) {
  const vals = data.cells.flat().filter((v): v is number => v != null);
  if (!data.rows.length || !vals.length) return <Empty text="Not enough candy-and-vegetable days yet" />;
  const max = Math.max(0.5, ...vals.map(Math.abs));
  return (
    <div className="flex flex-col gap-3">
      <div className="min-w-0 overflow-x-auto">
        <table className="border-separate border-spacing-[3px] text-xs">
          <thead>
            <tr>
              <th />
              {data.cols.map((c, j) => (
                <th key={c} className="max-w-[4.5rem] pb-1 align-bottom font-semibold leading-tight text-ink" title={`${c}: eaten on ${data.colTotals[j]} days`}>
                  <span className="block truncate">{c}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={r}>
                <td className="max-w-[9rem] truncate pr-2 text-right text-ink" title={`${r}: eaten on ${data.rowTotals[i]} days`}>{r}</td>
                {data.cells[i].map((v, j) => {
                  const bg = v == null ? "var(--surface-2)" : liftColor(v, max);
                  return (
                    <td key={j} className="h-7 min-w-[3.4rem] text-center font-bold tabular-nums"
                      title={v == null ? `${r} never shared a day with ${data.cols[j]}` : `${r} with ${data.cols[j]}: ${v > 0 ? "+" : ""}${v.toFixed(2)} (log₂ lift)`}
                      style={{ background: bg, color: v == null ? "var(--muted)" : inkOn(rgbToHex(bg)), borderRadius: 4 }}>
                      {v == null ? "" : fmtLift(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-10 rounded-sm" style={{ background: `linear-gradient(to right, ${liftColor(-max, max)}, var(--surface-2))` }} /> vegetable deterred the candy</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-10 rounded-sm" style={{ background: `linear-gradient(to right, var(--surface-2), ${liftColor(max, max)})` }} /> candy showed up more</span>
        <span className="text-muted">Cells are log₂ of P(candy | vegetable) ÷ P(candy); blank = never on the same day.</span>
      </div>
    </div>
  );
}

const fmtLift = (v: number) => { const r = Math.round(v * 10) / 10; return r === 0 ? "0.0" : `${r > 0 ? "+" : ""}${r.toFixed(1)}`; };

function rgbToHex(rgb: string): string {
  const m = rgb.match(/\d+/g);
  return m && m.length >= 3 ? `#${m.slice(0, 3).map((n) => (+n).toString(16).padStart(2, "0")).join("")}` : "#000000";
}
