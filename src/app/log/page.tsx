import type { Metadata } from "next";
import { loadDaily } from "@/lib/daily";
import { addDays, isValidISODate, todayISO } from "@/lib/dates";
import { DailyForm } from "@/components/DailyForm";
import { DateNav } from "@/components/DateNav";

export const metadata: Metadata = { title: "Log" };
export const dynamic = "force-dynamic";

export default async function LogPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: q } = await searchParams;
  const today = todayISO();
  const date = q && isValidISODate(q) ? q : today;
  const data = await loadDaily(date, { closet: false });   // the form fetches /api/closet itself (browser-cached)

  // Days in the last 60 with no entry (up to yesterday), for the "missing" jump.
  const logged = new Set(data.loggedDates);
  const missing: string[] = [];
  for (let d = addDays(today, -60); d < today; d = addDays(d, 1)) if (!logged.has(d) && d >= (data.loggedDates[0] ?? d)) missing.push(d);

  return (
    <>
      <DateNav date={date} today={today} isLogged={data.isLogged} missing={missing} />
      <DailyForm key={date} data={data} />
    </>
  );
}
