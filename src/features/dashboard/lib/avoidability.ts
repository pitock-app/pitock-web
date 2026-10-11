import { avoidabilities } from "@/lib/api/enums";
import type { CategoryLine } from "./dataset";
import type { Avoidability } from "./products";

/** Livelli in ordine, dal meno al più evitabile, più le voci non ancora classificate. */
export type AvoidabilityBucket = Avoidability | "unclassified";
export const AVOIDABILITY_BUCKETS: AvoidabilityBucket[] = [...avoidabilities, "unclassified"];

/**
 * Peso di ogni livello nell'indice: il superfluo conta per intero, l'utile per metà
 * (si poteva rimandare o spendere meno), l'essenziale per niente.
 */
export const AVOIDABILITY_WEIGHT: Record<Avoidability, number> = {
  essenziale: 0,
  utile: 0.5,
  superfluo: 1,
};

type Amounts = Record<AvoidabilityBucket, number>;

const round2 = (value: number) => Math.round(value * 100) / 100;
const empty = (): Amounts => ({ essenziale: 0, utile: 0, superfluo: 0, unclassified: 0 });
const bucketOf = (line: CategoryLine): AvoidabilityBucket => line.avoidability ?? "unclassified";

function add(amounts: Amounts, line: CategoryLine) {
  amounts[bucketOf(line)] += line.amount;
}

/**
 * Indice di evitabilità (0–100): quota della spesa classificata che si poteva evitare,
 * con l'utile a metà peso. Null se non c'è spesa classificata.
 */
export function avoidabilityIndex(amounts: Amounts): number | null {
  const classified = amounts.essenziale + amounts.utile + amounts.superfluo;
  if (classified <= 0) return null;
  const avoidable = amounts.utile * AVOIDABILITY_WEIGHT.utile + amounts.superfluo;
  return Math.min(Math.max((avoidable / classified) * 100, 0), 100);
}

function finish(amounts: Amounts) {
  const rounded = {
    essenziale: round2(amounts.essenziale),
    utile: round2(amounts.utile),
    superfluo: round2(amounts.superfluo),
    unclassified: round2(amounts.unclassified),
  };
  return {
    amounts: rounded,
    classified: round2(rounded.essenziale + rounded.utile + rounded.superfluo),
    /** Euro evitabili con lo stesso peso dell'indice. */
    avoidable: round2(rounded.utile * AVOIDABILITY_WEIGHT.utile + rounded.superfluo),
    index: avoidabilityIndex(amounts),
  };
}

export type AvoidabilityTotals = ReturnType<typeof finish>;

/** Spesa del periodo per livello di evitabilità, con l'indice. */
export function avoidabilitySummary(lines: CategoryLine[]): AvoidabilityTotals {
  const amounts = empty();
  for (const line of lines) add(amounts, line);
  return finish(amounts);
}

/** Spesa per livello in ogni periodo (`keys` comprende i periodi senza spese). */
export function avoidabilityByPeriod(
  lines: CategoryLine[],
  granularity: "month" | "year",
  keys: string[] | null,
) {
  const byPeriod = new Map<string, Amounts>();
  for (const line of lines) {
    const period = granularity === "year" ? line.day.slice(0, 4) : line.day.slice(0, 7);
    const amounts = byPeriod.get(period) ?? empty();
    add(amounts, line);
    byPeriod.set(period, amounts);
  }
  const periods = keys ?? [...byPeriod.keys()].sort();
  return periods.map((period) => ({ period, ...finish(byPeriod.get(period) ?? empty()) }));
}

/**
 * Voci di un livello, dalla più costosa: quelle di un solo periodo (`YYYY-MM` o `YYYY`) se
 * indicato. La loro somma è il segmento del grafico da cui si arriva.
 */
export function avoidabilityLines(
  lines: CategoryLine[],
  bucket: AvoidabilityBucket,
  period: string | null = null,
) {
  return lines
    .filter((line) => bucketOf(line) === bucket && (!period || line.day.startsWith(period)))
    .sort((a, b) => b.amount - a.amount || b.day.localeCompare(a.day));
}
