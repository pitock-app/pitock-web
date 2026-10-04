import { Check } from "lucide-react";
import { it } from "@/lib/i18n/it";
import { ChartCard, DataTable, NoData } from "./ChartCard";
import { SAVING } from "./lib/colors";
import { formatComparison, type ProductStats } from "./lib/products";
import { formatGap, formatUnitPrice } from "./ProductRankings";

const t = it.dashboard;
const SHOWN_GROUPS = 6;

/** Formati e marche dello stesso tipo confrontati sul prezzo al kg o al litro. */
export function UnitPrices({ products }: { products: ProductStats[] }) {
  const groups = formatComparison(products);
  return (
    <ChartCard
      id="unit-prices"
      title={t.unitPrices.title}
      description={t.unitPrices.description}
      table={
        groups.length > 0 && (
          <DataTable
            caption={t.unitPrices.title}
            headers={[t.product, t.price]}
            rows={groups.flatMap((group) =>
              group.products.map((p) => ({
                key: `${group.id}|${p.key}`,
                cells: [p.label, formatUnitPrice(p.measuredPrice!.value, group.unit)],
              })),
            )}
          />
        )
      }
    >
      {groups.length === 0 ? (
        <NoData>{t.unitPrices.none}</NoData>
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.slice(0, SHOWN_GROUPS).map((group) => {
            const max = group.products[group.products.length - 1].measuredPrice!.value;
            return (
              <li key={group.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium capitalize">{group.type}</span>
                  <span className="text-xs font-medium" style={{ color: SAVING }}>
                    {t.storeComparison.cheaperBy(formatGap(group.gap))}
                  </span>
                </div>
                {group.products.map((p, index) => (
                  <div
                    key={p.key}
                    className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-2 text-xs"
                  >
                    <span className="truncate" title={p.label}>
                      {p.label}
                    </span>
                    <span className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(p.measuredPrice!.value / max) * 100}%`,
                          background: index === 0 ? SAVING : "var(--chart-2)",
                        }}
                      />
                    </span>
                    <span
                      className="flex items-center gap-1 tabular-nums"
                      style={index === 0 ? { color: SAVING, fontWeight: 600 } : undefined}
                    >
                      {index === 0 && (
                        <Check className="size-3" aria-label={t.unitPrices.cheapest} />
                      )}
                      {formatUnitPrice(p.measuredPrice!.value, group.unit)}
                    </span>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </ChartCard>
  );
}
