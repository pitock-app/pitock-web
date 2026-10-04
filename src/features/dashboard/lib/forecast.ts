import { lastDay, shiftMonth, ymd } from "@/lib/period";

/** Una spesa: giorno del calendario di Roma (YYYY-MM-DD), importo ed esercente. */
export type DailySpend = { day: string; amount: number; merchant: string | null };

/** Spesa che si ripete una volta al mese dallo stesso esercente, con importo stabile. */
export type RecurringSpend = { merchant: string; amount: number };

export type ForecastReliability = "low" | "medium" | "good";

export type MonthForecast = {
  /** Mese della previsione ("2026-10"). */
  month: string;
  dayOfMonth: number;
  daysInMonth: number;
  /** Speso dal 1° del mese a oggi compreso. */
  spent: number;
  /** Spesa prevista a fine mese. */
  projected: number;
  /** Ritmo giornaliero usato per i giorni che mancano (spese ricorrenti escluse). */
  dailyRate: number;
  /** Ritmo giornaliero del mese in corso, spese ricorrenti escluse. */
  currentDailyRate: number;
  /** Ritmo giornaliero medio dei mesi passati, spese ricorrenti escluse; null senza storico. */
  historyDailyRate: number | null;
  /** Peso del ritmo del mese in corso (0–1): cresce con i giorni trascorsi. */
  currentWeight: number;
  /** Spese ricorrenti già note ma non ancora comparse questo mese: entrano nella previsione. */
  pendingRecurring: RecurringSpend[];
  /** Totale del mese scorso; null se lo storico non lo copre. */
  previousMonthTotal: number | null;
  /** Media dei totali dei mesi passati completi; null se non ce ne sono. */
  averageMonthTotal: number | null;
  /** Mesi completi su cui è calcolata la media (il primo mese, se iniziato a metà, è escluso). */
  averageMonths: number;
  /** Mesi passati usati come storico. */
  historyMonths: number;
  reliability: ForecastReliability;
  /** Una riga per giorno: speso cumulato (fino a oggi) e proiezione (da oggi a fine mese). */
  series: { day: number; actual: number | null; projected: number | null }[];
};

/** Mesi passati considerati per lo storico. */
export const FORECAST_HISTORY_MONTHS = 6;
/** Mesi recenti in cui cercare le spese ricorrenti. */
const RECURRING_WINDOW = 3;
/** Variazione massima (coefficiente di variazione) perché una spesa conti come ricorrente. */
const RECURRING_MAX_CV = 0.25;

const round2 = (value: number) => Math.round(value * 100) / 100;
const monthKey = (year: number, month: number) => ymd(year, month, 1).slice(0, 7);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const merchantKey = (merchant: string | null) => merchant?.trim().toLowerCase() || null;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Esercenti pagati una sola volta in ciascuno degli ultimi mesi, con importo quasi uguale
 * (bollette, abbonamenti, affitto). `months` va dal più vecchio al più recente.
 */
export function findRecurring(spends: DailySpend[], months: string[]): Map<string, RecurringSpend> {
  const recent = months.slice(-RECURRING_WINDOW);
  const recurring = new Map<string, RecurringSpend>();
  if (recent.length < 2) return recurring;
  const byMerchant = new Map<string, { label: string; byMonth: Map<string, number[]> }>();
  for (const spend of spends) {
    const key = merchantKey(spend.merchant);
    const month = spend.day.slice(0, 7);
    if (!key || !recent.includes(month)) continue;
    const entry = byMerchant.get(key) ?? { label: spend.merchant!.trim(), byMonth: new Map() };
    entry.byMonth.set(month, [...(entry.byMonth.get(month) ?? []), spend.amount]);
    byMerchant.set(key, entry);
  }
  for (const [key, { label, byMonth }] of byMerchant) {
    const perMonth = recent.map((month) => byMonth.get(month) ?? []);
    if (perMonth.some((amounts) => amounts.length !== 1)) continue;
    const amounts = perMonth.map(([amount]) => amount);
    const mean = sum(amounts) / amounts.length;
    if (mean <= 0) continue;
    const deviation = Math.sqrt(sum(amounts.map((a) => (a - mean) ** 2)) / amounts.length);
    if (deviation / mean > RECURRING_MAX_CV) continue;
    recurring.set(key, { merchant: label, amount: round2(median(amounts)) });
  }
  return recurring;
}

/**
 * Previsione della spesa del mese di `today`.
 *
 * - Le spese ricorrenti (stesso esercente una volta al mese, importo stabile) si tolgono dal
 *   ritmo giornaliero; se questo mese non sono ancora arrivate si aggiungono per intero.
 * - Il resto si proietta con un ritmo giornaliero che media quello del mese in corso e quello
 *   dei mesi passati; il peso del mese in corso è la quota di mese trascorsa (a inizio mese
 *   conta quasi solo lo storico, a fine mese quasi solo il mese in corso).
 * - Lo storico parte dal primo scontrino: i giorni prima dell'uso dell'app non contano come
 *   spesa zero. Se il primo mese è iniziato a metà, entra nel ritmo giornaliero solo dal giorno
 *   del primo scontrino e resta fuori dalla media mensile.
 *
 * `spends` può contenere anche spese fuori dallo storico o successive a oggi: si ignorano.
 */
export function forecastMonth(
  spends: DailySpend[],
  today: string,
  historyMonths = FORECAST_HISTORY_MONTHS,
): MonthForecast {
  const [year, month, dayOfMonth] = today.split("-").map(Number);
  const daysInMonth = lastDay(year, month);
  const current = monthKey(year, month);

  const pastKeys = Array.from({ length: historyMonths }, (_, index) => {
    const shifted = shiftMonth(year, month, index - historyMonths);
    return monthKey(shifted.year, shifted.month);
  });
  const monthTotals = new Map<string, number>();
  for (const spend of spends) {
    const key = spend.day.slice(0, 7);
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + spend.amount);
  }
  const firstWithData = pastKeys.findIndex((key) => monthTotals.has(key));
  const history = firstWithData === -1 ? [] : pastKeys.slice(firstWithData);

  const recurring = findRecurring(spends, history);
  const isRecurring = (spend: DailySpend) => {
    const key = merchantKey(spend.merchant);
    return key !== null && recurring.has(key);
  };

  const thisMonth = spends.filter(
    (spend) => spend.day.slice(0, 7) === current && spend.day <= today,
  );
  const spent = sum(thisMonth.map((spend) => spend.amount));
  const variableSpent = sum(thisMonth.filter((s) => !isRecurring(s)).map((s) => s.amount));
  const seenThisMonth = new Set(thisMonth.map((spend) => merchantKey(spend.merchant)));
  const pendingRecurring = [...recurring]
    .filter(([key]) => !seenThisMonth.has(key))
    .map(([, value]) => value)
    .sort((a, b) => b.amount - a.amount);

  const firstDay = spends
    .map((spend) => spend.day)
    .filter((day) => history.includes(day.slice(0, 7)))
    .sort()[0];
  const skippedDays = firstDay ? Number(firstDay.slice(8)) - 1 : 0;
  const historyDays =
    sum(
      history.map((key) => {
        const [y, m] = key.split("-").map(Number);
        return lastDay(y, m);
      }),
    ) - skippedDays;
  const historyVariable = sum(
    spends
      .filter((spend) => history.includes(spend.day.slice(0, 7)) && !isRecurring(spend))
      .map((spend) => spend.amount),
  );
  const historyDailyRate = history.length > 0 ? historyVariable / historyDays : null;
  const currentDailyRate = variableSpent / dayOfMonth;
  const currentWeight = historyDailyRate === null ? 1 : dayOfMonth / daysInMonth;
  const dailyRate =
    currentWeight * currentDailyRate + (1 - currentWeight) * (historyDailyRate ?? 0);

  const remainingDays = daysInMonth - dayOfMonth;
  const pendingTotal = sum(pendingRecurring.map((spend) => spend.amount));
  const projected = spent + dailyRate * remainingDays + pendingTotal;

  const completeMonths = skippedDays > 0 ? history.slice(1) : history;
  const totals = completeMonths.map((key) => monthTotals.get(key) ?? 0);
  const previousKey = pastKeys[pastKeys.length - 1];
  const reliability: ForecastReliability =
    history.length === 0 || (dayOfMonth < 7 && history.length < 2)
      ? "low"
      : history.length < 3 || dayOfMonth < 10
        ? "medium"
        : "good";

  const cumulative = new Map<number, number>();
  for (const spend of thisMonth) {
    const day = Number(spend.day.slice(8));
    cumulative.set(day, (cumulative.get(day) ?? 0) + spend.amount);
  }
  let running = 0;
  const series = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    running += cumulative.get(day) ?? 0;
    const ahead = day - dayOfMonth;
    return {
      day,
      actual: day <= dayOfMonth ? round2(running) : null,
      // Le ricorrenti in arrivo si spalmano sui giorni che mancano: la linea resta continua.
      projected:
        ahead >= 0
          ? round2(
              spent +
                dailyRate * ahead +
                (remainingDays > 0 ? pendingTotal * (ahead / remainingDays) : 0),
            )
          : null,
    };
  });

  return {
    month: current,
    dayOfMonth,
    daysInMonth,
    spent: round2(spent),
    projected: round2(projected),
    dailyRate: round2(dailyRate),
    currentDailyRate: round2(currentDailyRate),
    historyDailyRate: historyDailyRate === null ? null : round2(historyDailyRate),
    currentWeight,
    pendingRecurring,
    previousMonthTotal: history.includes(previousKey)
      ? round2(monthTotals.get(previousKey) ?? 0)
      : null,
    averageMonthTotal: totals.length > 0 ? round2(sum(totals) / totals.length) : null,
    averageMonths: totals.length,
    historyMonths: history.length,
    reliability,
    series,
  };
}
