import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadActivity } from "@/lib/activities";
import { ACTIVITIES, ACTIVITY_BY_SLUG } from "@/lib/schema/activities";
import { ActivityForm } from "@/components/ActivityForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: ACTIVITY_BY_SLUG[slug]?.title ?? "Activity" };
}

export function generateStaticParams() {
  return ACTIVITIES.map((a) => ({ slug: a.slug }));
}

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadActivity(slug);
  if (!data) notFound();
  const cols = data.config.columnGroups ? ["Type", "Title", "Rating", "Review"] : (data.config.listCols ?? data.header.slice(0, 6));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight"><span aria-hidden className="mr-2">{data.config.icon}</span>{data.config.title}</h1>
        <p className="text-sm text-ink-2">{data.total} entr{data.total === 1 ? "y" : "ies"} in “{data.config.sheet}”{data.storeKind === "csv" ? " · local CSV mode" : ""}</p>
      </div>

      <ActivityForm data={data} />

      <section className="card overflow-hidden">
        <header className="border-b-[1.5px] border-neon px-4 py-3"><h2 className="text-[15px] font-bold">Recent entries</h2></header>
        {data.recent.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Nothing logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-fig">
              <thead>
                <tr>{cols.map((c) => <th key={c} className="whitespace-nowrap">{c}</th>)}</tr>
              </thead>
              <tbody>
                {data.config.columnGroups
                  ? data.config.columnGroups.flatMap((g) =>
                      data.recent.filter((r) => r[g.cols[0]]).map((r, i) => (
                        <tr key={g.title + i}>
                          <td className="text-xs text-muted">{g.title}</td>
                          <td className="font-bold">{r[g.cols[0]]}</td>
                          <td className="tabular-nums">{r[g.cols[1]]}</td>
                          <td className="max-w-md truncate text-ink-2">{r[g.cols[2]]}</td>
                        </tr>
                      )),
                    )
                  : data.recent.map((r, i) => (
                      <tr key={i}>
                        {cols.map((c) => <td key={c} className="max-w-xs truncate whitespace-nowrap tabular-nums">{r[c]}</td>)}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
