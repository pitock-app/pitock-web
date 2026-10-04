import { apiErrorMessage, needsAiSettings } from "@/lib/api/errors";
import { it } from "@/lib/i18n/it";

const captureErrors: Record<string, string> = it.capture.errors;

/** Messaggio in italiano per l'errore di un elemento della coda. */
export function queueErrorMessage(code: string | undefined): string {
  if (code && Object.hasOwn(captureErrors, code)) return captureErrors[code];
  return apiErrorMessage(code ?? "UNKNOWN");
}

/** Errori per cui serve intervenire nelle impostazioni AI. */
export const needsSettings = needsAiSettings;
