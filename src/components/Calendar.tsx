"use client";

import Link from "next/link";
import { useState } from "react";
import type { CalendarMonth, CalDay } from "@/lib/metrics";
import { inkOn } from "@/lib/colors";
import { formatLongDate } from "@/lib/dates";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const shiftMonth = (ym: string, n: number) => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

/**
 * The home calendar (Dailybean-style): one circle per day, filled with the shirt color worn that day
 * and showing the fun meter inside. Not-logged days are dashed, today has a "+", and picking a day
 * opens its summary beside the grid with a link to the entry.
 */
export function HomeCalendar({ cal, streak, base = "/" }: { cal: CalendarMonth; streak: number; base?: string }) {
  const logged = cal.days.filter((d) => d.logged);
  const [sel, setSel] = useState<string | null>(() => (cal.days.find((d) => d.date === cal.today && d.logged) ?? logged[logged.length - 1])?.date ?? null);
  const selected = cal.days.find((d) => d.date === sel) ?? null;
  const lead = new Date(`${cal.month}-01T12:00:00Z`).getUTCDay();
  const thisMonth = cal.today.slice(0, 7);
  const href = (m: string) => `${base}${base.includes("?") ? "&" : "?"}month=${m}`;

  return (
    <section className="card grid min-w-0 gap-4 p-4 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold leading-tight">Calendar</h3>
            {streak > 1 && <p className="mt-0.5 text-xs text-neon">{streak}-day streak</p>}
          </div>
          <div className="seg">
            <Link href={href(shiftMonth(cal.month, -1))} role="button" aria-label="Previous month">‹</Link>
            <span className="px-2 py-1 text-sm font-bold text-ink">{cal.label}</span>
            {cal.month < thisMonth ? <Link href={href(shiftMonth(cal.month, 1))} role="button" aria-label="Next month">›</Link> : <span className="px-3 py-1 text-sm text-muted">›</span>}
          </div>
        </header>
        <div className="grid grid-cols-7 gap-y-2 text-center">
          {DOW.map((d) => <div key={d} className="text-[11px] font-bold text-ink-2">{d}</div>)}
          {Array.from({ length: lead }, (_, i) => <div key={`lead${i}`} />)}
          {cal.days.map((d) => <DayCell key={d.date} d={d} today={cal.today} selected={d.date === sel} onPick={() => setSel(d.date)} />)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border border-dashed border-muted" />Not logged</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border-2 border-neon" />Today</span>
        </div>
      </div>
      <aside className="rounded-lg border border-border bg-surface-2/50 p-4 lg:self-start">
        {selected ? (
          <>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-neon">Selected day</div>
            <div className="mt-1 text-base font-bold">{formatLongDate(selected.date)}</div>
            {selected.logged ? (
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-2 text-sm">
                <dt className="text-ink-2">Shirt</dt><dd className="flex items-center gap-1.5 font-bold"><span className="inline-block h-3 w-3 rounded-full" style={{ background: selected.shirt?.hex }} />{selected.shirt?.name}</dd>
                <dt className="text-ink-2">Sleep</dt><dd className="font-bold tabular-nums">{selected.hoursSlept == null ? "—" : `${selected.hoursSlept} h`}{selected.sleepQuality != null && <span className="font-normal text-muted"> · {selected.sleepQuality}/10</span>}</dd>
                <dt className="text-ink-2">Fun meter</dt><dd className="font-bold tabular-nums">{selected.fun ?? "—"}<span className="font-normal text-muted"> / 10</span></dd>
                <dt className="text-ink-2">Productivity</dt><dd className="font-bold tabular-nums">{selected.productivity ?? "—"}<span className="font-normal text-muted"> / 10</span></dd>
                <dt className="text-ink-2">Steps</dt><dd className="font-bold tabular-nums">{selected.steps == null ? "—" : Math.round(selected.steps).toLocaleString("en-US")}</dd>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-ink-2">{selected.future ? "That day hasn't happened yet." : "No entry for this day yet."}</p>
            )}
            {!selected.future && <Link href={`/log?date=${selected.date}`} className={`${selected.logged ? "btn-ghost" : "btn-primary"} mt-4 w-full`}>{selected.logged ? "Open entry" : "Log this day"}</Link>}
          </>
        ) : (
          <p className="text-sm text-ink-2">Pick a day to see its summary.</p>
        )}
      </aside>
    </section>
  );
}

function DayCell({ d, today, selected, onPick }: { d: CalDay; today: string; selected: boolean; onPick: () => void }) {
  const day = +d.date.slice(8, 10);
  const isToday = d.date === today;
  const ring = selected ? "ring-2 ring-neon ring-offset-2 ring-offset-surface" : "";
  const circle = "mx-auto grid h-9 w-9 place-items-center rounded-full text-sm font-bold transition";
  let inner: React.ReactNode;
  if (d.logged) {
    const hex = d.shirt?.hex ?? "#4ade80";
    inner = <button type="button" onClick={onPick} className={`${circle} ${ring}`} style={{ background: hex, color: inkOn(hex) }} title={`${d.date} · ${d.shirt?.name ?? ""}`}>{d.fun ?? "·"}</button>;
  } else if (d.future) {
    inner = <div className={`${circle} text-muted/40`} />;
  } else if (isToday) {
    inner = <Link href={`/log?date=${d.date}`} className={`${circle} border-2 border-neon text-neon hover:bg-accent-soft ${ring}`} title="Log today">+</Link>;
  } else {
    inner = <Link href={`/log?date=${d.date}`} className={`${circle} border border-dashed border-muted text-transparent hover:border-neon ${ring}`} title={`Log ${d.date}`}>·</Link>;
  }
  return (
    <div className={d.future ? "opacity-50" : ""}>
      {inner}
      <div className={`mt-0.5 text-[11px] ${isToday ? "font-bold text-neon" : "text-ink-2"}`}>{day === 1 ? new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : day}</div>
    </div>
  );
}
