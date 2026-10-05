/** Sotto questa soglia la confidenza è bassa e si avvisa l'utente. */
export const LOW_CONFIDENCE = 0.6;

export function isLowConfidence(confidence: number | null | undefined): boolean {
  return confidence !== null && confidence !== undefined && confidence < LOW_CONFIDENCE;
}

/** Scarto massimo tra somma delle righe e totale, come `SUM_TOLERANCE` del backend. */
export const SUM_TOLERANCE = 0.05;

/** Somma degli importi delle righe; null se nessuna riga ha un importo. */
export function itemsSum(items: readonly { amount: number | null }[]): number | null {
  const amounts = items.map((item) => item.amount).filter((a): a is number => a !== null);
  return amounts.length ? Math.round(amounts.reduce((sum, a) => sum + a, 0) * 100) / 100 : null;
}

/**
 * Differenza tra somma delle righe e totale, se supera la tolleranza: segnala righe lette male,
 * mancanti o ripetute (tipico degli scontrini lunghi). Null se i conti tornano o mancano i dati.
 */
export function itemsTotalMismatch(
  total: number | null | undefined,
  sum: number | null | undefined,
): { total: number; sum: number; difference: number } | null {
  if (total === null || total === undefined || sum === null || sum === undefined) return null;
  const difference = Math.round((sum - total) * 100) / 100;
  return Math.abs(difference) > SUM_TOLERANCE ? { total, sum, difference } : null;
}
