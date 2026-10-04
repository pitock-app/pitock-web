import { describe, expect, it } from "vitest";
import { needsSettings, queueErrorMessage } from "@/features/capture/lib/queue-messages";

describe("messaggi della coda", () => {
  it.each([
    ["NOT_A_RECEIPT", "Non sembra uno scontrino."],
    ["USER_KEY_INVALID", "La tua chiave API non è valida."],
    ["USER_KEY_MISSING", "Non hai ancora inserito la tua chiave API."],
    [
      "LLM_UNAVAILABLE",
      "Il servizio di lettura non è disponibile in questo momento. Riprova tra poco.",
    ],
    ["PROCESSING_TIMEOUT", expect.stringContaining("più del previsto")],
    ["QUALCOSA_DI_NUOVO", "Si è verificato un errore imprevisto."],
  ])("%s", (code, message) => {
    expect(queueErrorMessage(code)).toEqual(message);
  });

  it("indica quando servono le impostazioni AI", () => {
    for (const code of [
      "USER_KEY_MISSING",
      "USER_KEY_INVALID",
      "USER_KEY_QUOTA",
      "PLATFORM_QUOTA_EXCEEDED",
      "AI_NOT_CONFIGURED",
    ]) {
      expect(needsSettings(code)).toBe(true);
    }
    expect(needsSettings("NOT_A_RECEIPT")).toBe(false);
    expect(needsSettings(undefined)).toBe(false);
  });
});
