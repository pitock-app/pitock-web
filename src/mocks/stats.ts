import { categories } from "@/lib/api/enums";
import type { components } from "@/lib/api/schema";
import { toRomeDateInput } from "@/lib/format";
import { parseInstant, parseRangeEnd } from "./dates";
import { advance, ownerReceipts } from "./db";

type Schemas = components["schemas"];
type Stats = Schemas["Stats"];
type Amounts = { total: number; nReceipts: number };

/** Esercenti restituiti da `topMerchants`, come `TOP_MERCHANTS` del backend. */
export const TOP_MERCHANTS = 10;

export type StatsQuery = { from?: number; to?: number; granularity: Stats["granularity"] };

/** Query di `GET /v1/stats` validata come nel backend; null se non è valida. */
export function parseStatsQuery(params: URLSearchParams): StatsQuery | null {
  const granularity = params.get("granularity") ?? "month";
  if (granularity !== "month" && granularity !== "year") return null;
  const fromText = params.get("from");
  const toText = params.get("to");
  const from = fromText === null ? undefined : parseInstant(fromText);
  const to = toText === null ? undefined : parseRangeEnd(toText);
  if (from === null || to === null) return null;
  if (from !== undefined && to !== undefined && from >= to) return null;
  return {
    granularity,
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
  };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function group<K extends string>(map: Map<K, Amounts>, key: K, total: number) {
  const previous = map.get(key) ?? { total: 0, nReceipts: 0 };
  map.set(key, { total: previous.total + total, nReceipts: previous.nReceipts + 1 });
}

const rows = <K extends string, F extends string>(map: Map<K, Amounts>, field: F) =>
  [...map].map(
    ([key, value]) =>
      ({ [field]: key, total: round2(value.total), nReceipts: value.nReceipts }) as Record<F, K> &
        Amounts,
  );

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Statistiche come `stats.service.summary` del backend: solo scontrini `extracted` con la loro
 * estrazione corrente, data d'acquisto o di caricamento, periodi nel fuso di Roma.
 */
export function summarizeMockStats(owner: string, query: StatsQuery): Stats {
  const totals = { total: 0, nReceipts: 0 };
  const byCategory = new Map<Schemas["Category"], Amounts>();
  const byPeriod = new Map<string, Amounts>();
  const byMerchant = new Map<string, Amounts>();
  const bySource = new Map<Schemas["ReceiptSource"], Amounts>();

  for (const entry of ownerReceipts(owner)) {
    advance(entry);
    const { receipt, extraction } = entry;
    if (receipt.status !== "extracted" || !extraction) continue;
    const when = Date.parse(extraction.purchasedAt ?? receipt.createdAt);
    if (query.from !== undefined && when < query.from) continue;
    if (query.to !== undefined && when >= query.to) continue;

    const total = extraction.total ?? 0;
    totals.total += total;
    totals.nReceipts += 1;
    // Categorie mancanti o fuori elenco confluiscono in "altro".
    const category = (categories as readonly string[]).includes(extraction.category ?? "")
      ? (extraction.category as Schemas["Category"])
      : "altro";
    group(byCategory, category, total);
    const day = toRomeDateInput(new Date(when));
    group(byPeriod, query.granularity === "year" ? day.slice(0, 4) : day.slice(0, 7), total);
    // Come il backend: esclusi solo gli esercenti null, non i nomi vuoti.
    if (extraction.merchantName !== null) group(byMerchant, extraction.merchantName, total);
    group(bySource, receipt.source, total);
  }

  return {
    from: query.from === undefined ? null : new Date(query.from).toISOString(),
    to: query.to === undefined ? null : new Date(query.to).toISOString(),
    granularity: query.granularity,
    totals: {
      total: round2(totals.total),
      nReceipts: totals.nReceipts,
      average: totals.nReceipts > 0 ? round2(totals.total / totals.nReceipts) : 0,
    },
    byCategory: rows(byCategory, "category").sort(
      (a, b) => b.total - a.total || a.category.localeCompare(b.category),
    ),
    byPeriod: rows(byPeriod, "period").sort((a, b) => byText(a.period, b.period)),
    topMerchants: rows(byMerchant, "merchantName")
      .sort((a, b) => b.total - a.total || byText(a.merchantName, b.merchantName))
      .slice(0, TOP_MERCHANTS),
    bySource: rows(bySource, "source").sort((a, b) => byText(a.source, b.source)),
  };
}

/** Massimo di scontrini e di righe di `/v1/stats/dataset`, come `DATASET_LIMIT` del backend. */
export const DATASET_LIMIT = 5000;

/** Come `stats.service.dataset` del backend: scontrini e righe del periodo, dal più recente. */
export function mockStatsDataset(
  owner: string,
  query: Omit<StatsQuery, "granularity">,
): Schemas["StatsDataset"] {
  const entries = ownerReceipts(owner)
    .map((entry) => {
      advance(entry);
      return entry;
    })
    .filter(({ receipt, extraction }) => receipt.status === "extracted" && extraction)
    .map((entry) => ({
      entry,
      when: Date.parse(entry.extraction!.purchasedAt ?? entry.receipt.createdAt),
    }))
    .filter(
      ({ when }) =>
        (query.from === undefined || when >= query.from) &&
        (query.to === undefined || when < query.to),
    )
    .sort((a, b) => b.when - a.when || byText(a.entry.receipt.id, b.entry.receipt.id));
  const asCategory = (value: string | null | undefined): Schemas["Category"] =>
    (categories as readonly string[]).includes(value ?? "")
      ? (value as Schemas["Category"])
      : "altro";
  const receipts = entries.map(({ entry, when }) => ({
    id: entry.receipt.id,
    date: new Date(when).toISOString(),
    // Il backend armonizza i nomi (insegna, chiave normalizzata, P.IVA): qui insegna o nome.
    merchantName: entry.extraction!.merchantBrand ?? entry.extraction!.merchantName,
    merchantOriginal: entry.extraction!.merchantName,
    total: entry.extraction!.total,
    category: asCategory(entry.extraction!.category),
    source: entry.receipt.source,
  }));
  const items = entries.flatMap(({ entry }) =>
    [...entry.extraction!.items]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        receiptId: entry.receipt.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        category: asCategory(item.category ?? entry.extraction!.category),
        normalizedName: item.normalizedName,
        brand: item.brand,
        size: item.size,
        sizeUnit: item.sizeUnit,
      })),
  );
  return {
    from: query.from === undefined ? null : new Date(query.from).toISOString(),
    to: query.to === undefined ? null : new Date(query.to).toISOString(),
    truncated: receipts.length >= DATASET_LIMIT || items.length >= DATASET_LIMIT,
    receipts: receipts.slice(0, DATASET_LIMIT),
    items: items.slice(0, DATASET_LIMIT),
  };
}
