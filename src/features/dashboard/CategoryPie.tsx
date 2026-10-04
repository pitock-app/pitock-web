"use client";

import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber, formatShare } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { BarList } from "./BarList";
import { ChartCard, DataTable, NoData, shareOf, tooltipStyle } from "./ChartCard";
import { categoryColor } from "./lib/colors";
import type { Summary } from "./lib/dataset";
import type { Category, ProductStats } from "./lib/products";

const t = it.dashboard;

type CategoryPieProps = {
  rows: Summary["byCategory"];
  total: number;
  /** Prodotti del periodo: al clic su una categoria si vedono quelli che la compongono. */
  products: ProductStats[];
};

/**
 * Ciambella della spesa per categoria. Ogni categoria ha sempre lo stesso colore; la legenda
 * riporta importi e quote e, al clic, apre il dettaglio dei prodotti della categoria.
 */
export function CategoryPie({ rows, total, products }: CategoryPieProps) {
  const [selected, setSelected] = useState<Category | null>(null);
  const slices = rows.map((row) => ({
    ...row,
    label: it.categories[row.category],
    color: categoryColor(row.category),
  }));
  const active = selected && rows.some((row) => row.category === selected) ? selected : null;
  const categoryProducts = active ? products.filter((p) => p.category === active) : [];

  return (
    <ChartCard
      id="by-category"
      title={t.byCategoryTitle}
      description={
        active ? t.categoryDrill.productsOf(it.categories[active]) : t.byCategoryDescription
      }
      table={
        rows.length > 0 && (
          <DataTable
            caption={t.byCategoryTitle}
            headers={[t.category, t.amount, t.count, t.share]}
            rows={rows.map((row) => ({
              key: row.category,
              cells: [
                it.categories[row.category],
                formatCurrency(row.total),
                formatNumber(row.nReceipts, 0),
                formatShare(shareOf(row.total, total), 1),
              ],
            }))}
          />
        )
      }
    >
      {slices.length === 0 ? (
        <NoData>{t.noData}</NoData>
      ) : active ? (
        <div className="flex flex-col gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-11 self-start"
            onClick={() => setSelected(null)}
          >
            <ChevronLeft aria-hidden />
            {t.categoryDrill.back}
          </Button>
          {categoryProducts.length === 0 ? (
            <NoData>{t.categoryDrill.none}</NoData>
          ) : (
            <BarList
              rows={categoryProducts.map((p) => ({
                key: p.key,
                label: p.label,
                value: p.totalSpent,
                color: categoryColor(active),
                detail: t.purchases(p.purchases),
              }))}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="size-44 shrink-0" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart accessibilityLayer={false}>
                <Pie
                  data={slices}
                  dataKey="total"
                  nameKey="label"
                  innerRadius="58%"
                  outerRadius="100%"
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive={false}
                  rootTabIndex={-1}
                  className="cursor-pointer"
                  onClick={(_, index) => setSelected(slices[index]?.category ?? null)}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.category} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-1">
            <ul className="flex flex-col text-sm" data-testid="category-legend">
              {slices.map((slice) => (
                <li key={slice.category}>
                  <button
                    type="button"
                    onClick={() => setSelected(slice.category)}
                    className="hover:bg-muted/60 focus-visible:ring-ring/50 flex min-h-9 w-full items-center gap-2 rounded-md px-1 text-left outline-none focus-visible:ring-[3px]"
                  >
                    <span
                      className="size-3 shrink-0 rounded-sm"
                      style={{ background: slice.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{slice.label}</span>
                    <span className="tabular-nums">{formatCurrency(slice.total)}</span>
                    <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
                      {formatShare(shareOf(slice.total, total))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs">{t.categoryDrill.hint}</p>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
