"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, formatLongDate } from "@/lib/dates";

export function DateNav({ date, today, isLogged, missing }: { date: string; today: string; isLogged: boolean; missing: string[] }) {
  const router = useRouter();
  const go = (d: string) => router.push(`/log?date=${d}`);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Link href={`/log?date=${addDays(date, -1)}`} className="btn-ghost !px-2.5" aria-label="Previous day">‹</Link>
        <input type="date" className="control !w-auto" value={date} max={today} onChange={(e) => e.target.value && go(e.target.value)} />
        <Link href={`/log?date=${addDays(date, 1)}`} className="btn-ghost !px-2.5" aria-label="Next day" aria-disabled={date >= today}
          style={date >= today ? { pointerEvents: "none", opacity: 0.4 } : undefined}>›</Link>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-bold">{date === today ? "Today · " : ""}{formatLongDate(date)}</div>
        <div className="text-xs text-muted">
          {isLogged ? <span className="font-bold text-neon">● Logged</span> : <span>○ Not logged yet — prefilled with your usual answers</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {date !== today && <Link href="/log" className="btn-ghost">Today</Link>}
        {missing.length > 0 && (
          <Link href={`/log?date=${missing[missing.length - 1]}`} className="btn-ghost text-xs" title={missing.join(", ")}>
            {missing.length} missing day{missing.length === 1 ? "" : "s"}
          </Link>
        )}
      </div>
    </div>
  );
}
