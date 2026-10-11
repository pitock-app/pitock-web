"use client";

import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatNumber, formatShare } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { BarList } from "./BarList";
import { ChartCard, DataTable, NoData, shareOf, tooltipStyle } from "./ChartCard";
import { categoryColor } from "./lib/colors";
import type { Summary } from "./lib/dataset";
import type { Category, Purchase } from "./lib/products";

const t = it.dashboard;

type CategoryPieProps = {
  rows: Summary["byCategory"];
  total: number;
  /** Acquisti del periodo: al clic su una categoria si vedono quelli con la sua categoria di riga. */
  purchases: Purchase[];
};

/** "2 pz", "0,296 kg"; nulla per il singolo pezzo. */
function quantityLabel(p: Purchase) {
  if (p.unit === "pz" && p.quantity === 1) return null;
  return `${formatNumber(p.quantity, p.unit === "kg" ? 3 : 0)} ${p.unit}`;
}

/**
 * Ciambella della spesa per categoria. Ogni categoria ha sempre lo stesso colore; la legenda
 * riporta importi e quote e, al clic, apre i singoli acquisti della categoria, dal più recente.
 * Gli acquisti seguono la categoria della riga, quindi la loro somma può differire dalla
 * fetta, che segue quella dello scontrino.
 */
export function CategoryPie({ rows, total, purchases }: CategoryPieProps) {
  const [selected, setSelected] = useState<Category | null>(null);
  const slices = rows.map((row) => ({
    ...row,
    label: it.categories[row.category],
    color: categoryColor(row.category),
  }));
  const active = selected && rows.some((row) => row.category === selected) ? selected : null;
  const categoryPurchases = active
    ? purchases
        .filter((p) => p.category === active)
        .sort((a, b) => b.day.localeCompare(a.day) || a.label.localeCompare(b.label))
    : [];
  const purchasesTotal = categoryPurchases.reduce((sum, p) => sum + p.amount, 0);

  return (
    <ChartCard
      id="by-category"
      title={t.byCategoryTitle}
      description={
        active ? t.categoryDrill.purchasesOf(it.categories[active]) : t.byCategoryDescription
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
          {categoryPurchases.length === 0 ? (
            <NoData>{t.categoryDrill.none}</NoData>
          ) : (
            <>
              <p
                className="text-muted-foreground text-sm tabular-nums"
                data-testid="category-purchases-total"
              >
                {t.purchases(categoryPurchases.length)} · {formatCurrency(purchasesTotal)}
              </p>
              <BarList
                rows={categoryPurchases.map((p, index) => ({
                  key: `${p.receiptId}-${index}`,
                  label: p.label,
                  value: p.amount,
                  color: categoryColor(active),
                  href: `/receipts/${p.receiptId}`,
                  detail: [formatDate(p.day), p.merchant, quantityLabel(p)]
                    .filter(Boolean)
                    .join(" · "),
                }))}
              />
            </>
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
