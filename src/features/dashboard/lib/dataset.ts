import type { components } from "@/lib/api/schema";
import { toRomeDateInput } from "@/lib/format";
import type { Category, ItemFact, ReceiptFact } from "./products";

type Schemas = components["schemas"];
export type Dataset = Schemas["StatsDataset"];
type Amounts = { total: number; nReceipts: number };

/** Filtri per esercente e categoria, comuni a tutti i grafici. */
export type DatasetFilters = { store?: string; category?: Category };

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Scontrini e righe che passano i filtri. Con la categoria si tengono le righe di quella
 * categoria e gli scontrini con quella categoria o con almeno una riga di quella categoria.
 */
export function filterDataset(
  dataset: Pick<Dataset, "receipts" | "items">,
  filters: DatasetFilters,
) {
  const receipts = filters.store
    ? dataset.receipts.filter((r) => r.merchantName?.trim() === filters.store)
    : dataset.receipts;
  const ids = new Set(receipts.map((r) => r.id));
  let items = dataset.items.filter((item) => ids.has(item.receiptId));
  if (!filters.category) return { receipts, items };
  items = items.filter((item) => item.category === filters.category);
  const withItems = new Set(items.map((item) => item.receiptId));
  return {
    receipts: receipts.filter((r) => r.category === filters.category || withItems.has(r.id)),
    items,
  };
}

/**
 * Importo di uno scontrino che conta con il filtro di categoria: con la categoria scelta conta
 * la somma delle sue righe di quella categoria, altrimenti (o senza righe) il totale.
 */
export function receiptAmounts(
  receipts: ReceiptFact[],
  items: ItemFact[],
  category?: Category,
): Map<string, number> {
  const amounts = new Map(receipts.map((r) => [r.id, r.total ?? 0]));
  if (!category) return amounts;
  const byReceipt = new Map<string, number>();
  for (const item of items) {
    if (item.category !== category || item.amount === null) continue;
    byReceipt.set(item.receiptId, (byReceipt.get(item.receiptId) ?? 0) + item.amount);
  }
  for (const receipt of receipts) {
    const fromItems = byReceipt.get(receipt.id);
    if (fromItems !== undefined) amounts.set(receipt.id, fromItems);
  }
  return amounts;
}

function add<K extends string>(map: Map<K, Amounts>, key: K, total: number) {
  const previous = map.get(key) ?? { total: 0, nReceipts: 0 };
  map.set(key, { total: previous.total + total, nReceipts: previous.nReceipts + 1 });
}

const rows = <K extends string>(map: Map<K, Amounts>) =>
  [...map].map(([key, value]) => ({
    key,
    total: round2(value.total),
    nReceipts: value.nReceipts,
  }));

/** Riepilogo come `GET /v1/stats`, calcolato sugli scontrini già filtrati. */
export function summarize(
  receipts: ReceiptFact[],
  amounts: Map<string, number>,
  granularity: Schemas["Stats"]["granularity"],
) {
  let total = 0;
  const byCategory = new Map<Category, Amounts>();
  const byPeriod = new Map<string, Amounts>();
  const byMerchant = new Map<string, Amounts>();
  const bySource = new Map<Schemas["ReceiptSource"], Amounts>();
  for (const receipt of receipts) {
    const amount = amounts.get(receipt.id) ?? 0;
    total += amount;
    add(byCategory, receipt.category, amount);
    const day = toRomeDateInput(new Date(receipt.date));
    add(byPeriod, granularity === "year" ? day.slice(0, 4) : day.slice(0, 7), amount);
    const merchant = receipt.merchantName?.trim();
    if (merchant) add(byMerchant, merchant, amount);
    add(bySource, receipt.source, amount);
  }
  const n = receipts.length;
  return {
    granularity,
    totals: { total: round2(total), nReceipts: n, average: n > 0 ? round2(total / n) : 0 },
    byCategory: rows(byCategory)
      .map(({ key, ...rest }) => ({ category: key, ...rest }))
      .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category)),
    byPeriod: rows(byPeriod)
      .map(({ key, ...rest }) => ({ period: key, ...rest }))
      .sort((a, b) => a.period.localeCompare(b.period)),
    topMerchants: rows(byMerchant)
      .map(({ key, ...rest }) => ({ merchantName: key, ...rest }))
      .sort((a, b) => b.total - a.total || a.merchantName.localeCompare(b.merchantName)),
    bySource: rows(bySource)
      .map(({ key, ...rest }) => ({ source: key, ...rest }))
      .sort((a, b) => b.total - a.total),
  };
}

export type Summary = ReturnType<typeof summarize>;

/** Esercenti del periodo per il filtro, dal più usato. */
export function storeOptions(receipts: ReceiptFact[]): string[] {
  const counts = new Map<string, number>();
  for (const r of receipts) {
    const name = r.merchantName?.trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + (r.total ?? 0));
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
}
