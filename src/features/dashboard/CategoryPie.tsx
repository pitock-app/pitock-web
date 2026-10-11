"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency, formatNumber, formatShare } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { ChartCard, DataTable, NoData, shareOf, tooltipStyle } from "./ChartCard";
import { LineDrill } from "./LineDrill";
import { categoryColor } from "./lib/colors";
import type { CategoryLine, Summary } from "./lib/dataset";
import type { Category } from "./lib/products";

const t = it.dashboard;

type CategoryPieProps = {
  rows: Summary["byCategory"];
  total: number;
  /** Voci di spesa del periodo, dal più recente: al clic su una categoria si vedono le sue. */
  lines: CategoryLine[];
};

/**
 * Ciambella della spesa per categoria. Ogni categoria ha sempre lo stesso colore; la legenda
 * riporta importi e quote e, al clic, apre le voci della categoria riga per riga, dal più
 * recente. Fette e voci seguono la categoria della riga, quindi la somma delle voci è la fetta.
 */
export function CategoryPie({ rows, total, lines }: CategoryPieProps) {
  const [selected, setSelected] = useState<Category | null>(null);
  const slices = rows.map((row) => ({
    ...row,
    label: it.categories[row.category],
    color: categoryColor(row.category),
  }));
  // Una categoria in negativo (solo sconti) non ha fetta: resta nella legenda.
  const pieSlices = slices.filter((slice) => slice.total > 0);
  const active = selected && rows.some((row) => row.category === selected) ? selected : null;
  const categoryLines = active ? lines.filter((line) => line.category === active) : [];

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
        <LineDrill
          lines={categoryLines}
          color={categoryColor(active)}
          backLabel={t.categoryDrill.back}
          onBack={() => setSelected(null)}
          testId="category-purchases-total"
        />
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="size-44 shrink-0" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart accessibilityLayer={false}>
                <Pie
                  data={pieSlices}
                  dataKey="total"
                  nameKey="label"
                  innerRadius="58%"
                  outerRadius="100%"
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive={false}
                  rootTabIndex={-1}
                  className="cursor-pointer"
                  onClick={(_, index) => setSelected(pieSlices[index]?.category ?? null)}
                >
                  {pieSlices.map((slice) => (
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
