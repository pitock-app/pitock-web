import { categories, receiptSources, receiptStatuses } from "@/lib/api/enums";
import type { ReceiptListQuery } from "@/lib/api/query-keys";
import type { components } from "@/lib/api/schema";
import { isDateInput, isPeriodPreset, resolvePeriod, type PeriodPreset } from "@/lib/period";

type Schemas = components["schemas"];

/** Filtri della lista scontrini, così come stanno nell'URL. */
export type ReceiptFilters = {
  period: PeriodPreset;
  /** Solo con period = "custom" (YYYY-MM-DD). */
  from?: string;
  to?: string;
  category?: Schemas["Category"];
  status?: Schemas["ReceiptStatus"];
  source?: Schemas["ReceiptSource"];
  q?: string;
};

export const defaultReceiptFilters: ReceiptFilters = { period: "all" };

const MAX_SEARCH = 100;

const pick = <T extends string>(list: readonly T[], value: string | null): T | undefined =>
  value !== null && (list as readonly string[]).includes(value) ? (value as T) : undefined;

type ParamsLike = { get(name: string): string | null };

/** Legge i filtri dalla query string; i valori non validi vengono ignorati. */
export function parseReceiptFilters(params: ParamsLike): ReceiptFilters {
  const from = params.get("from");
  const to = params.get("to");
  const periodParam = params.get("period");
  const hasDates = isDateInput(from) || isDateInput(to);
  const period: PeriodPreset = isPeriodPreset(periodParam)
    ? periodParam
    : hasDates
      ? "custom"
      : "all";
  const q = params.get("q")?.trim().slice(0, MAX_SEARCH);
  return {
    period,
    ...(period === "custom" && isDateInput(from) ? { from } : {}),
    ...(period === "custom" && isDateInput(to) ? { to } : {}),
    ...withValue("category", pick(categories, params.get("category"))),
    ...withValue("status", pick(receiptStatuses, params.get("status"))),
    ...withValue("source", pick(receiptSources, params.get("source"))),
    ...withValue("q", q || undefined),
  };
}

function withValue<K extends string, V>(key: K, value: V | undefined) {
  return (value === undefined ? {} : { [key]: value }) as Partial<Record<K, V>>;
}

/** Query string dei filtri (senza i valori predefiniti), in un ordine stabile. */
export function serializeReceiptFilters(filters: ReceiptFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.period !== "all") params.set("period", filters.period);
  if (filters.period === "custom") {
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  }
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  if (filters.source) params.set("source", filters.source);
  const q = filters.q?.trim();
  if (q) params.set("q", q.slice(0, MAX_SEARCH));
  return params;
}

export function hasActiveFilters(filters: ReceiptFilters): boolean {
  return serializeReceiptFilters(filters).size > 0;
}

/** Vero se l'intervallo personalizzato ha la data finale prima di quella iniziale. */
export function isRangeInvalid(filters: ReceiptFilters): boolean {
  return filters.period === "custom" && !!filters.from && !!filters.to && filters.from > filters.to;
}

/** Parametri di `GET /v1/receipts` (senza cursore e limite) per i filtri dati. */
export function toListQuery(filters: ReceiptFilters, now: Date = new Date()): ReceiptListQuery {
  const range = isRangeInvalid(filters)
    ? {}
    : resolvePeriod(filters.period, { from: filters.from, to: filters.to }, now);
  const q = filters.q?.trim();
  return {
    ...withValue("from", range.from),
    ...withValue("to", range.to),
    ...withValue("category", filters.category),
    ...withValue("status", filters.status),
    ...withValue("source", filters.source),
    ...withValue("q", q || undefined),
  };
}
