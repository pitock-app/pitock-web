import type { UsageQuery } from "@/lib/api/query-keys";
import { toRomeDateInput } from "@/lib/format";

/** Periodi del consumo token. */
export const usagePeriods = ["this-month", "30-days", "90-days", "all"] as const;
export type UsagePeriod = (typeof usagePeriods)[number];

/** Inizio di "Tutto": prima di qualunque chiamata registrata. */
const ALL_FROM = "2000-01-01";

export function isUsagePeriod(value: string | null | undefined): value is UsagePeriod {
  return (usagePeriods as readonly string[]).includes(value ?? "");
}

/** Giorno di Roma spostato di `delta` giorni (YYYY-MM-DD). */
export function shiftDay(day: string, delta: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10);
}

/** Primo giorno del periodo (compreso), nel fuso di Roma. */
export function usagePeriodStart(period: UsagePeriod, now: Date = new Date()): string {
  const today = toRomeDateInput(now);
  switch (period) {
    case "this-month":
      return `${today.slice(0, 8)}01`;
    case "30-days":
      return shiftDay(today, -29);
    case "90-days":
      return shiftDay(today, -89);
    case "all":
      return ALL_FROM;
  }
}

/** Query di `GET /v1/usage`: dal primo giorno del periodo fino ad adesso, serie per giorno. */
export function toUsageQuery(period: UsagePeriod, now: Date = new Date()): UsageQuery {
  return { from: usagePeriodStart(period, now), groupBy: "day" };
}

/**
 * Tutti i giorni da `from` a `to` compresi, per mostrare anche i giorni senza chiamate.
 * Con "Tutto" non si riempie (l'intervallo sarebbe troppo lungo).
 */
export function daysOfPeriod(period: UsagePeriod, now: Date = new Date()): string[] | null {
  if (period === "all") return null;
  const to = toRomeDateInput(now);
  const days: string[] = [];
  for (let day = usagePeriodStart(period, now); day <= to; day = shiftDay(day, 1)) {
    days.push(day);
  }
  return days;
}
