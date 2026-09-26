import type { ClosetStats } from "@/lib/closetStats";
import { ChartCard, RankBars, Tile, VerticalBars } from "@/components/charts/Charts";

/** The Closet tab of the dashboard: how green the Virtual Closet is, and how much of it gets worn — drawn like the wardrobe figures. */
export function ClosetStatsView({ s }: { s: ClosetStats }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {s.tiles.map((t) => <Tile key={t.label} {...t} />)}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table-fig min-w-[44rem]">
          <thead>
            <tr>
              <th>Kind</th>
              <th className="text-right">Pieces</th>
              <th className="text-right">Green</th>
              <th className="text-right">Any green</th>
              <th className="text-right">Worn in {s.year}</th>
              <th>Most common types</th>
            </tr>
          </thead>
          <tbody>
            {s.kinds.map((k) => (
              <tr key={k.kind}>
                <td className="font-bold">{k.label}</td>
                <td className="text-right tabular-nums">{k.total}</td>
                <td className="text-right tabular-nums">{k.green} <span className="text-muted">({k.greenPct}%)</span></td>
                <td className="text-right tabular-nums">{k.anyGreen} <span className="text-muted">({k.anyGreenPct}%)</span></td>
                <td className="text-right tabular-nums">{k.wornThisYear} <span className="text-muted">({k.wornPct}%)</span></td>
                <td className="whitespace-nowrap text-ink-2">{k.types.map((t) => `${t.name} (${t.value})`).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title mt-2">Colors</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="My Closet by Color — Percent" sub="Short color of every piece; bars painted in the color they count">
          <VerticalBars data={s.colorFamilies} colorByName unit="Pieces" asPercentOf={s.total} />
        </ChartCard>
        <ChartCard title="My Closet's Shades of Green — Percent" sub={`Primary color of the ${s.green} green pieces`}>
          <VerticalBars data={s.greenShades} colorByName unit="Pieces" asPercentOf={s.green} />
        </ChartCard>
      </div>

      <h2 className="section-title mt-2">Wear</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ChartCard title="Brands in the Closet — Percent" sub="Share of all pieces per brand" className="sm:col-span-2">
          <VerticalBars data={s.brands} unit="Pieces" asPercentOf={s.total} />
        </ChartCard>
        <ChartCard title="Green goes with" sub="Accent colors on green pieces"><RankBars data={s.greenAccents} colorByName unit="Pieces" /></ChartCard>
        <ChartCard title={`Most worn in ${s.year}`} sub="Days worn, top two pieces of each kind" className="sm:col-span-2 lg:col-span-3"><RankBars data={s.mostWorn} unit="Days" labelWidth={260} /></ChartCard>
      </div>
    </>
  );
}
