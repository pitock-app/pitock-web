import { avoidabilitySummary } from "./avoidability";
import {
  categoryLines,
  filterDataset,
  receiptAmounts,
  summarize,
  type Dataset,
  type DatasetFilters,
} from "./dataset";
import { dailyTotals, periodHighlights } from "./insights";
import { productStats, toPurchases } from "./products";

/** Tutto ciò che i grafici della dashboard mostrano, dal dataset filtrato per negozio e categoria. */
export function dashboardView(
  dataset: Dataset,
  dimensions: DatasetFilters,
  granularity: Parameters<typeof summarize>[2],
) {
  const { receipts, items } = filterDataset(dataset, dimensions);
  const amounts = receiptAmounts(receipts, items, dimensions.category);
  const purchases = toPurchases(receipts, items);
  const lines = categoryLines(receipts, items, amounts);
  const products = productStats(purchases);
  return {
    receipts,
    summary: summarize(receipts, amounts, granularity, lines),
    lines,
    avoidability: avoidabilitySummary(lines),
    purchases,
    products,
    daily: dailyTotals(lines),
    highlights: periodHighlights(receipts, amounts, lines, products),
  };
}

export type DashboardViewData = ReturnType<typeof dashboardView>;
