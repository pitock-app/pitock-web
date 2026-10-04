import { toRomeDateInput } from "./format";

/** Periodi predefiniti dei filtri (lista scontrini, dashboard). */
export const periodPresets = [
  "all",
  "this-month",
  "last-month",
  "last-12-months",
  "this-year",
  "custom",
] as const;
export type PeriodPreset = (typeof periodPresets)[number];

/** Intervallo di date (YYYY-MM-DD, estremi compresi) nel fuso di Roma. */
export type DateRange = { from?: string; to?: string };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Vero se il testo è una data esistente nel formato YYYY-MM-DD. */
export function isDateInput(value: string | null | undefined): value is string {
  const match = DATE_PATTERN.exec(value ?? "");
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isPeriodPreset(value: string | null | undefined): value is PeriodPreset {
  return (periodPresets as readonly string[]).includes(value ?? "");
}

const pad = (value: number) => String(value).padStart(2, "0");
export const ymd = (year: number, month: number, day: number) =>
  `${year}-${pad(month)}-${pad(day)}`;
export const lastDay = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Mese (1–12) spostato di `delta` mesi, con l'anno corretto. */
export function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/**
 * Date di un periodo predefinito, calcolate sul giorno corrente a Roma.
 * "custom" usa l'intervallo indicato; "all" non ha limiti.
 */
export function resolvePeriod(
  preset: PeriodPreset,
  custom: DateRange = {},
  now: Date = new Date(),
): DateRange {
  const [year, month] = toRomeDateInput(now).split("-").map(Number);
  switch (preset) {
    case "all":
      return {};
    case "custom":
      return {
        ...(isDateInput(custom.from) ? { from: custom.from } : {}),
        ...(isDateInput(custom.to) ? { to: custom.to } : {}),
      };
    case "this-month":
      return { from: ymd(year, month, 1), to: ymd(year, month, lastDay(year, month)) };
    case "last-month": {
      const prev = shiftMonth(year, month, -1);
      return {
        from: ymd(prev.year, prev.month, 1),
        to: ymd(prev.year, prev.month, lastDay(prev.year, prev.month)),
      };
    }
    case "last-12-months": {
      const start = shiftMonth(year, month, -11);
      return { from: ymd(start.year, start.month, 1), to: ymd(year, month, lastDay(year, month)) };
    }
    case "this-year":
      return { from: ymd(year, 1, 1), to: ymd(year, 12, 31) };
  }
}

/** Giorno YYYY-MM-DD spostato di `delta` giorni. */
export function addDays(day: string, delta: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10);
}

/** Giorni da `from` a `to`, estremi compresi. */
export function daysBetween(from: string, to: string): number {
  return (
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
  );
}
