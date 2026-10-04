import type { StatsQuery } from "@/lib/api/query-keys";
import { toRomeDateInput } from "@/lib/format";
import {
  addDays,
  daysBetween,
  isDateInput,
  lastDay,
  resolvePeriod,
  shiftMonth,
  ymd,
  type DateRange,
} from "@/lib/period";

/** Periodi della dashboard (niente "tutto": la variazione richiede un periodo precedente). */
export const dashboardPeriods = [
  "this-month",
  "last-month",
  "last-12-months",
  "this-year",
  "custom",
] as const;
export type DashboardPeriod = (typeof dashboardPeriods)[number];

export type DashboardFilters = {
  period: DashboardPeriod;
  /** Solo con period = "custom" (YYYY-MM-DD). */
  from?: string;
  to?: string;
};

export const defaultDashboardFilters: DashboardFilters = { period: "this-month" };

export function isDashboardPeriod(value: string | null | undefined): value is DashboardPeriod {
  return (dashboardPeriods as readonly string[]).includes(value ?? "");
}

type ParamsLike = { get(name: string): string | null };

/** Periodo dalla query string; i valori non validi tornano al predefinito. */
export function parseDashboardFilters(params: ParamsLike): DashboardFilters {
  const param = params.get("period");
  const period = isDashboardPeriod(param) ? param : defaultDashboardFilters.period;
  if (period !== "custom") return { period };
  const from = params.get("from");
  const to = params.get("to");
  return {
    period,
    ...(isDateInput(from) ? { from } : {}),
    ...(isDateInput(to) ? { to } : {}),
  };
}

/** Query string del periodo, senza il valore predefinito. */
export function serializeDashboardFilters(filters: DashboardFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.period !== defaultDashboardFilters.period) params.set("period", filters.period);
  if (filters.period === "custom") {
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  }
  return params;
}

/** Vero se l'intervallo personalizzato ha la data finale prima di quella iniziale. */
export function isRangeInvalid(filters: DashboardFilters): boolean {
  return filters.period === "custom" && !!filters.from && !!filters.to && filters.from > filters.to;
}

export function currentRange(filters: DashboardFilters, now: Date = new Date()): DateRange {
  return resolvePeriod(filters.period, filters, now);
}

/**
 * Periodo con cui confrontare la spesa. Per i periodi in corso (questo mese, quest'anno) si
 * confronta lo stesso tratto del periodo prima (1–4 ottobre con 1–4 settembre), non il mese intero.
 * Null se l'intervallo personalizzato non ha entrambe le date.
 */
export function previousRange(
  filters: DashboardFilters,
  now: Date = new Date(),
): Required<DateRange> | null {
  const [year, month, day] = toRomeDateInput(now).split("-").map(Number);
  switch (filters.period) {
    case "this-month": {
      const prev = shiftMonth(year, month, -1);
      return {
        from: ymd(prev.year, prev.month, 1),
        to: ymd(prev.year, prev.month, Math.min(day, lastDay(prev.year, prev.month))),
      };
    }
    case "last-month": {
      const prev = shiftMonth(year, month, -2);
      return {
        from: ymd(prev.year, prev.month, 1),
        to: ymd(prev.year, prev.month, lastDay(prev.year, prev.month)),
      };
    }
    case "last-12-months": {
      const start = shiftMonth(year, month, -23);
      const end = shiftMonth(year, month, -12);
      return {
        from: ymd(start.year, start.month, 1),
        to: ymd(end.year, end.month, lastDay(end.year, end.month)),
      };
    }
    case "this-year":
      return {
        from: ymd(year - 1, 1, 1),
        to: ymd(year - 1, month, Math.min(day, lastDay(year - 1, month))),
      };
    case "custom": {
      if (!isDateInput(filters.from) || !isDateInput(filters.to) || isRangeInvalid(filters)) {
        return null;
      }
      const days = daysBetween(filters.from, filters.to);
      return { from: addDays(filters.from, -days), to: addDays(filters.from, -1) };
    }
  }
}

/** Oltre due anni (o senza data iniziale) le barre sono per anno, altrimenti per mese. */
export function granularityOf(range: DateRange): StatsQuery["granularity"] {
  if (!range.from) return "year";
  const to = range.to ?? toRomeDateInput();
  return daysBetween(range.from, to) > 731 ? "year" : "month";
}

export function toStatsQuery(range: DateRange): StatsQuery {
  return {
    ...(range.from ? { from: range.from } : {}),
    ...(range.to ? { to: range.to } : {}),
    granularity: granularityOf(range),
  };
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

/** Variazione percentuale; null se il periodo precedente non ha spese. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
