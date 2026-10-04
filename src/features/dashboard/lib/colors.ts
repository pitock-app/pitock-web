import type { Category } from "./products";

/** Serie categoriche in ordine fisso (`--series-1…6` in globals.css). */
export const SERIES = Array.from({ length: 6 }, (_, index) => `var(--series-${index + 1})`);
/** Tutto ciò che non ha un colore proprio ("Altri", categorie minori). */
export const NEUTRAL = "var(--muted-foreground)";
export const SAVING = "var(--saving)";
export const INCREASE = "var(--increase)";

/**
 * Colore fisso di ogni categoria, uguale in tutti i grafici. Le categorie meno frequenti
 * restano grigie: oltre 6 colori (verde e rosso sono per risparmi e rincari) non si distinguono più.
 */
const CATEGORY_COLORS: Partial<Record<Category, string>> = {
  alimentari: SERIES[0],
  ristorazione: SERIES[1],
  carburante: SERIES[2],
  casa: SERIES[3],
  salute: SERIES[4],
  svago: SERIES[5],
};

export function categoryColor(category: Category): string {
  return CATEGORY_COLORS[category] ?? NEUTRAL;
}

/**
 * Colori dei negozi: i 6 con la spesa più alta in `ranking` (calcolato senza filtri) hanno
 * un colore proprio, gli altri sono grigi. Il colore segue il negozio: filtrare non lo cambia.
 */
export function storeColors(ranking: string[]): (store: string | null) => string {
  const colors = new Map(
    ranking.slice(0, SERIES.length).map((store, index) => [store, SERIES[index]]),
  );
  return (store) => (store ? (colors.get(store) ?? NEUTRAL) : NEUTRAL);
}
