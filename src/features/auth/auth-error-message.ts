import { AuthError } from "@/lib/auth";
import { it } from "@/lib/i18n/it";

const t = it.auth.errors;

/** Messaggio in italiano per un errore di login o registrazione. */
export function authErrorMessage(error: unknown): string {
  if (!(error instanceof AuthError)) return t.generic;
  switch (error.code) {
    case "invalid_credentials":
      return t.invalidCredentials;
    case "email_not_confirmed":
      return t.emailNotConfirmed;
    case "user_exists":
      return t.userExists;
    case "weak_password":
      return t.weakPassword;
    case "rate_limited":
      return t.rateLimited;
    case "not_configured":
      return t.notConfigured;
    default:
      return t.generic;
  }
}
