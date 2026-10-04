"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { components } from "@/lib/api/schema";
import { formatCurrency, formatNumber, formatShare } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { ChartCard, DataTable, shareOf } from "./ChartCard";

type ByCategory = components["schemas"]["Stats"]["byCategory"];

const t = it.dashboard;

/** Colori del tema per le fette, in ordine fisso; "Altre categorie" è sempre grigio. */
const SLICE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const OTHER_COLOR = "var(--muted-foreground)";

export type Slice = { key: string; label: string; total: number; nReceipts: number; color: string };

/**
 * Le prime 5 categorie per spesa, le altre riunite in "Altre categorie": oltre 6 fette
 * i colori non si distinguono più.
 */
export function toSlices(rows: ByCategory): Slice[] {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const fits = sorted.length <= SLICE_COLORS.length + 1;
  const shown = fits ? sorted : sorted.slice(0, SLICE_COLORS.length);
  const slices: Slice[] = shown.map((row, index) => ({
    key: row.category,
    label: it.categories[row.category],
    total: row.total,
    nReceipts: row.nReceipts,
    color: SLICE_COLORS[index] ?? OTHER_COLOR,
  }));
  if (!fits) {
    const rest = sorted.slice(SLICE_COLORS.length);
    slices.push({
      key: "other",
      label: t.otherCategories,
      total: Math.round(rest.reduce((sum, row) => sum + row.total, 0) * 100) / 100,
      nReceipts: rest.reduce((sum, row) => sum + row.nReceipts, 0),
      color: OTHER_COLOR,
    });
  }
  return slices;
}

/** Ciambella della spesa per categoria, con legenda che riporta importi e quote. */
export function CategoryPie({ rows, total }: { rows: ByCategory; total: number }) {
  const slices = toSlices(rows);
  return (
    <ChartCard
      id="by-category"
      title={t.byCategoryTitle}
      description={t.byCategoryDescription}
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
        <p className="text-muted-foreground py-6 text-center text-sm">{t.noData}</p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="size-44 shrink-0" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="total"
                  nameKey="label"
                  innerRadius="58%"
                  outerRadius="100%"
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.key} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex w-full min-w-0 flex-col gap-2 text-sm" data-testid="category-legend">
            {slices.map((slice) => (
              <li key={slice.key} className="flex items-center gap-2">
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
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
