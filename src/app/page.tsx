import Link from "next/link";
import { buildCalendarPage } from "@/lib/calendar";
import { isValidMonth } from "@/lib/metrics";
import { HomeCalendar } from "@/components/Calendar";

export const dynamic = "force-dynamic";

/** Home: the month calendar, one shirt-colored circle per day. Charts live on /dashboard. */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const d = await buildCalendarPage(isValidMonth(month) ? month : undefined);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diary</h1>
          <p className="text-sm text-ink-2">
            {d.daysLogged} days logged
            {d.missingDays > 0 && <> · <Link href="/log" className="text-warn underline-offset-2 hover:underline">{d.missingDays} missing in the last 30</Link></>}
            {d.storeKind === "csv" && " · local CSV mode"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="btn-ghost">Dashboard</Link>
          <Link href="/log" className="btn-primary">Log today</Link>
        </div>
      </div>
      <HomeCalendar cal={d.calendar} streak={d.streak} base="/" />
    </div>
  );
}
