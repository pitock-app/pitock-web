import { describe, expect, it } from "vitest";
import { ApiError, apiErrorMessage, isApiError } from "@/lib/api/errors";

describe("ApiError", () => {
  it("legge il formato { error: { code, message, requestId } } e traduce il messaggio", () => {
    const error = ApiError.fromResponse(
      { error: { code: "USER_KEY_INVALID", message: "Invalid key", requestId: "req-1" } },
      422,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("USER_KEY_INVALID");
    expect(error.status).toBe(422);
    expect(error.requestId).toBe("req-1");
    expect(error.serverMessage).toBe("Invalid key");
    expect(error.message).toBe("La tua chiave API non è valida.");
  });

  it("conserva duplicateOf per il 409 DUPLICATE", () => {
    const error = ApiError.fromResponse(
      { error: { code: "DUPLICATE", message: "dup", requestId: "r", duplicateOf: "abc" } },
      409,
    );
    expect(error.duplicateOf).toBe("abc");
    expect(error.message).toBe("Questo scontrino è già stato caricato.");
  });

  it("senza corpo riconoscibile deduce il codice dallo stato HTTP", () => {
    expect(ApiError.fromResponse(undefined, 404).code).toBe("NOT_FOUND");
    expect(ApiError.fromResponse("<html>", 500).code).toBe("INTERNAL");
    expect(ApiError.fromResponse("<html>", 502).code).toBe("PROVIDER_UNAVAILABLE");
    expect(ApiError.fromResponse(undefined, 415).code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(ApiError.fromResponse(undefined, 413).code).toBe("FILE_TOO_LARGE");
    expect(ApiError.fromResponse(undefined, 400).code).toBe("VALIDATION_ERROR");
    expect(ApiError.fromResponse(null, 418).code).toBe("UNKNOWN");
  });

  it("i codici sconosciuti hanno un messaggio generico", () => {
    expect(apiErrorMessage("SOMETHING_NEW")).toBe("Si è verificato un errore imprevisto.");
    expect(apiErrorMessage("toString")).toBe("Si è verificato un errore imprevisto.");
  });

  it("errore di rete", () => {
    const error = ApiError.network(new TypeError("fetch failed"));
    expect(isApiError(error)).toBe(true);
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.status).toBe(0);
  });
});
