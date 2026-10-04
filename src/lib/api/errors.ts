import { it } from "@/lib/i18n/it";
import type { components } from "./schema";

type ErrorBody = components["schemas"]["Error"];
type DuplicateErrorBody = components["schemas"]["DuplicateError"];
export type ApiErrorCode = keyof typeof it.apiErrors;

const STATUS_CODES: Record<number, ApiErrorCode> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "INVALID_STATE",
  413: "FILE_TOO_LARGE",
  415: "UNSUPPORTED_FILE_TYPE",
  422: "UPLOAD_MISMATCH",
  429: "RATE_LIMITED",
  502: "PROVIDER_UNAVAILABLE",
  503: "SERVICE_UNAVAILABLE",
};

function isKnownCode(code: string): code is ApiErrorCode {
  return Object.hasOwn(it.apiErrors, code);
}

/** Messaggio in italiano per un codice di errore del backend. */
export function apiErrorMessage(code: string): string {
  return isKnownCode(code) ? it.apiErrors[code] : it.apiErrors.UNKNOWN;
}

const AI_SETTINGS_CODES = new Set([
  "USER_KEY_MISSING",
  "USER_KEY_INVALID",
  "USER_KEY_QUOTA",
  "PLATFORM_QUOTA_EXCEEDED",
  "AI_NOT_CONFIGURED",
]);

/** Errori di estrazione per cui serve intervenire nelle impostazioni AI. */
export function needsAiSettings(code: string | null | undefined): boolean {
  return AI_SETTINGS_CODES.has(code ?? "");
}

/** Errori per cui l'azione suggerita è inserire una propria chiave. */
export function suggestsOwnKey(code: string | null | undefined): boolean {
  return code === "PLATFORM_QUOTA_EXCEEDED" || code === "AI_NOT_CONFIGURED";
}

function isDuplicateBody(body: ErrorBody): body is DuplicateErrorBody {
  return (
    body.error.code === "DUPLICATE" &&
    typeof (body.error as { duplicateOf?: unknown }).duplicateOf === "string"
  );
}

function isErrorBody(body: unknown): body is ErrorBody {
  if (typeof body !== "object" || body === null || !("error" in body)) return false;
  const error = (body as { error: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

/** Errore restituito dal backend (`{ error: { code, message, requestId } }`) o di rete. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  readonly duplicateOf?: string;
  /** Messaggio del server, in inglese e tecnico: solo per i log, non per l'utente. */
  readonly serverMessage?: string;

  constructor(options: {
    code: string;
    status: number;
    requestId?: string;
    duplicateOf?: string;
    serverMessage?: string;
  }) {
    super(apiErrorMessage(options.code));
    this.name = "ApiError";
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.duplicateOf = options.duplicateOf;
    this.serverMessage = options.serverMessage;
  }

  static fromResponse(body: unknown, status: number): ApiError {
    if (isErrorBody(body)) {
      return new ApiError({
        code: body.error.code,
        status,
        requestId: body.error.requestId,
        duplicateOf: isDuplicateBody(body) ? body.error.duplicateOf : undefined,
        serverMessage: body.error.message,
      });
    }
    const code = STATUS_CODES[status] ?? (status >= 500 ? "INTERNAL" : "UNKNOWN");
    return new ApiError({ code, status });
  }

  static network(cause?: unknown): ApiError {
    const error = new ApiError({ code: "NETWORK_ERROR", status: 0 });
    if (cause !== undefined) Object.defineProperty(error, "cause", { value: cause });
    return error;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
