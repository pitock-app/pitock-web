/** Sotto questa soglia la confidenza è bassa e si avvisa l'utente. */
export const LOW_CONFIDENCE = 0.6;

export function isLowConfidence(confidence: number | null | undefined): boolean {
  return confidence !== null && confidence !== undefined && confidence < LOW_CONFIDENCE;
}
