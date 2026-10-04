import Link from "next/link";
import type { WeekDay } from "@/lib/daily";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Sunday–Saturday around the open day: shirt-colored dots for logged days, dashed for empty, "+" on today. */
export function WeekStrip({ week, date, today }: { week: WeekDay[]; date: string; today: string }) {
  return (
    <div className="mb-4 flex gap-1.5 overflow-x-auto [scrollbar-width:none] sm:gap-2">
      {week.map((d, i) => {
        const future = d.date > today, isToday = d.date === today, sel = d.date === date;
        const day = +d.date.slice(8, 10);
        const label = day === 1 ? new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : String(day);
        const circle = "grid h-8 w-8 place-items-center rounded-full text-sm font-bold";
        const dot = d.logged ? <span className={circle} style={{ background: d.hex ?? "#4ade80" }} />
          : isToday ? <span className={`${circle} border-2 border-neon text-neon`}>+</span>
          : <span className={`${circle} border border-dashed ${future ? "border-line" : "border-muted"}`} />;
        const body = (
          <>
            <span className={`text-[11px] font-bold ${sel ? "text-neon" : "text-ink-2"}`}>{DOW[i]}</span>
            {dot}
            <span className={`text-[11px] ${isToday ? "font-bold text-neon" : "text-ink-2"}`}>{label}</span>
          </>
        );
        const cls = `flex min-w-[2.7rem] flex-1 flex-col items-center gap-1 rounded-lg border px-1 py-2 transition ${sel ? "border-neon bg-accent-soft/40" : "border-transparent hover:bg-surface-2"}`;
        return future ? <div key={d.date} className={`${cls} opacity-40`}>{body}</div> : <Link key={d.date} href={`/log?date=${d.date}`} className={cls} aria-current={sel ? "date" : undefined}>{body}</Link>;
      })}
    </div>
  );
}
