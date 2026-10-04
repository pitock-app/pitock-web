"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { it } from "@/lib/i18n/it";
import { RANKING_LIMIT } from "./BarList";
import { ChartCard, DataTable, NoData } from "./ChartCard";
import { SAVING } from "./lib/colors";
import { storeComparison, type ProductStats } from "./lib/products";
import { formatGap, formatUnitPrice } from "./ProductRankings";

const t = it.dashboard;

type StoreComparisonProps = {
  products: ProductStats[];
  colorOf(store: string): string;
};

/** Prezzo medio dello stesso prodotto nei diversi negozi; il più economico in verde. */
export function StoreComparison({ products, colorOf }: StoreComparisonProps) {
  const [expanded, setExpanded] = useState(false);
  const rows = storeComparison(products);
  const shown = expanded ? rows : rows.slice(0, RANKING_LIMIT);
  return (
    <ChartCard
      id="store-comparison"
      title={t.storeComparison.title}
      description={t.storeComparison.description}
      table={
        rows.length > 0 && (
          <DataTable
            caption={t.storeComparison.title}
            headers={[t.product, t.store, t.price]}
            rows={rows.flatMap((row) =>
              row.product.merchants.map((m) => ({
                key: `${row.product.key}|${m.merchant}`,
                cells: [
                  row.product.label,
                  m.merchant,
                  formatUnitPrice(m.averagePrice, row.product.unit),
                ],
              })),
            )}
          />
        )
      }
    >
      {rows.length === 0 ? (
        <NoData>{t.storeComparison.none}</NoData>
      ) : (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-4">
            {shown.map(({ product, cheapest, gap }) => {
              const max = Math.max(...product.merchants.map((m) => m.averagePrice));
              return (
                <li key={product.key} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium" title={product.label}>
                      {product.label}
                    </span>
                    <span className="shrink-0 text-xs font-medium" style={{ color: SAVING }}>
                      {t.storeComparison.cheaperBy(formatGap(gap))}
                    </span>
                  </div>
                  {product.merchants.map((m) => {
                    const best = m.merchant === cheapest.merchant;
                    return (
                      <div
                        key={m.merchant}
                        className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-2 text-xs"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span
                            className="size-2.5 shrink-0 rounded-sm"
                            style={{ background: colorOf(m.merchant) }}
                            aria-hidden
                          />
                          <span className="truncate" title={m.merchant}>
                            {m.merchant}
                          </span>
                        </span>
                        <span className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${(m.averagePrice / max) * 100}%`,
                              background: colorOf(m.merchant),
                            }}
                          />
                        </span>
                        <span
                          className="flex items-center gap-1 tabular-nums"
                          style={best ? { color: SAVING, fontWeight: 600 } : undefined}
                        >
                          {best && <Check className="size-3" aria-label={t.unitPrices.cheapest} />}
                          {formatUnitPrice(m.averagePrice, product.unit)}
                        </span>
                      </div>
                    );
                  })}
                </li>
              );
            })}
          </ul>
          {rows.length > RANKING_LIMIT && (
            <Button
              variant="ghost"
              size="sm"
              className="h-11 self-start"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? t.showLess : t.showAll(rows.length)}
            </Button>
          )}
        </div>
      )}
    </ChartCard>
  );
}
