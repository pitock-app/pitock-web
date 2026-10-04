import { categories } from "@/lib/api/enums";
import type { StatsQuery } from "@/lib/api/query-keys";
import type { components } from "@/lib/api/schema";
import { toRomeDateInput } from "@/lib/format";
import {
  daysBetween,
  isDateInput,
  lastDay,
  resolvePeriod,
  shiftMonth,
  ymd,
  type DateRange,
} from "@/lib/period";

/** Periodi della dashboard. */
export const dashboardPeriods = [
  "this-month",
  "last-month",
  "last-12-months",
  "this-year",
  "custom",
] as const;
export type DashboardPeriod = (typeof dashboardPeriods)[number];
type Category = components["schemas"]["Category"];

export type DashboardFilters = {
  period: DashboardPeriod;
  /** Solo con period = "custom" (YYYY-MM-DD). */
  from?: string;
  to?: string;
  /** Filtri globali per negozio (nome esercente) e categoria. */
  store?: string;
  category?: Category;
};

export const defaultDashboardFilters: DashboardFilters = { period: "this-month" };

export function isDashboardPeriod(value: string | null | undefined): value is DashboardPeriod {
  return (dashboardPeriods as readonly string[]).includes(value ?? "");
}

type ParamsLike = { get(name: string): string | null };

const isCategory = (value: string | null): value is Category =>
  (categories as readonly string[]).includes(value ?? "");

/** Periodo e filtri dalla query string; i valori non validi tornano al predefinito. */
export function parseDashboardFilters(params: ParamsLike): DashboardFilters {
  const param = params.get("period");
  const period = isDashboardPeriod(param) ? param : defaultDashboardFilters.period;
  const store = params.get("store")?.trim().slice(0, 200);
  const category = params.get("category");
  const dimensions = {
    ...(store ? { store } : {}),
    ...(isCategory(category) ? { category } : {}),
  };
  if (period !== "custom") return { period, ...dimensions };
  const from = params.get("from");
  const to = params.get("to");
  return {
    period,
    ...(isDateInput(from) ? { from } : {}),
    ...(isDateInput(to) ? { to } : {}),
    ...dimensions,
  };
}

/** Query string del periodo e dei filtri, senza i valori predefiniti. */
export function serializeDashboardFilters(filters: DashboardFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.period !== defaultDashboardFilters.period) params.set("period", filters.period);
  if (filters.period === "custom") {
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  }
  if (filters.store) params.set("store", filters.store);
  if (filters.category) params.set("category", filters.category);
  return params;
}

/** Vero se l'intervallo personalizzato ha la data finale prima di quella iniziale. */
export function isRangeInvalid(filters: DashboardFilters): boolean {
  return filters.period === "custom" && !!filters.from && !!filters.to && filters.from > filters.to;
}

export function currentRange(filters: DashboardFilters, now: Date = new Date()): DateRange {
  return resolvePeriod(filters.period, filters, now);
}

/** Oltre due anni (o senza data iniziale) le barre sono per anno, altrimenti per mese. */
export function granularityOf(range: DateRange): NonNullable<StatsQuery["granularity"]> {
  if (!range.from) return "year";
  const to = range.to ?? toRomeDateInput();
  return daysBetween(range.from, to) > 731 ? "year" : "month";
}

/**
 * Chiavi delle barre ("2026-10" o "2026") dall'inizio alla fine del periodo, anche senza spese.
 * Null se il periodo non ha entrambe le date: allora valgono solo quelle della risposta.
 */
export function periodKeys(range: DateRange, granularity: StatsQuery["granularity"]) {
  if (!range.from || !range.to || range.from > range.to) return null;
  const [fromYear, fromMonth] = range.from.split("-").map(Number);
  const [toYear, toMonth] = range.to.split("-").map(Number);
  if (granularity === "year") {
    return Array.from({ length: toYear - fromYear + 1 }, (_, index) => String(fromYear + index));
  }
  const count = (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
  return Array.from({ length: count }, (_, index) => {
    const { year, month } = shiftMonth(fromYear, fromMonth, index);
    return ymd(year, month, 1).slice(0, 7);
  });
}

/** Mesi dello slider: l'ultimo anno, dal mese di un anno fa a quello in corso. */
export const SLIDER_MONTHS = 12;

/** Chiavi "YYYY-MM" dei mesi dello slider, dal più vecchio al mese in corso. */
export function sliderMonths(now: Date = new Date()): string[] {
  const [year, month] = toRomeDateInput(now).split("-").map(Number);
  return Array.from({ length: SLIDER_MONTHS }, (_, index) => {
    const shifted = shiftMonth(year, month, index - (SLIDER_MONTHS - 1));
    return ymd(shifted.year, shifted.month, 1).slice(0, 7);
  });
}

function monthBounds(key: string): Required<DateRange> {
  const [year, month] = key.split("-").map(Number);
  return { from: ymd(year, month, 1), to: ymd(year, month, lastDay(year, month)) };
}

/**
 * Posizione dei due cursori per il periodo scelto. Null se il periodo non è fatto di mesi
 * interi dell'ultimo anno (es. date personalizzate a metà mese): allora valgono solo le date.
 */
export function sliderValue(
  filters: DashboardFilters,
  now: Date = new Date(),
): [number, number] | null {
  if (isRangeInvalid(filters)) return null;
  const range = currentRange(filters, now);
  if (!range.from || !range.to) return null;
  const months = sliderMonths(now);
  const start = months.findIndex((key) => monthBounds(key).from === range.from);
  const end = months.findIndex((key) => monthBounds(key).to === range.to);
  return start === -1 || end === -1 || start > end ? null : [start, end];
}

/**
 * Periodo dai due cursori. Le selezioni che coincidono con un preset usano il preset, così il
 * mese in corso si confronta con lo stesso tratto del mese prima.
 */
export function filtersFromSlider(
  [start, end]: readonly [number, number],
  now: Date = new Date(),
): DashboardFilters {
  const last = SLIDER_MONTHS - 1;
  if (start === last && end === last) return { period: "this-month" };
  if (start === last - 1 && end === last - 1) return { period: "last-month" };
  if (start === 0 && end === last) return { period: "last-12-months" };
  const months = sliderMonths(now);
  return {
    period: "custom",
    from: monthBounds(months[start]).from,
    to: monthBounds(months[end]).to,
  };
}
