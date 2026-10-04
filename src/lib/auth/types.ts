/** Utente autenticato, indipendente dall'implementazione (Supabase o mock). */
export type AuthUser = {
  id: string;
  email: string;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
};

export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "user_exists"
  | "weak_password"
  | "rate_limited"
  | "not_configured"
  | "unknown";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AuthError";
    this.code = code;
  }
}

export type SignUpResult = {
  /** true se Supabase richiede la conferma dell'email prima del login. */
  needsEmailConfirmation: boolean;
};

/**
 * Astrazione dell'autenticazione. Due implementazioni:
 * Supabase (reale) e Mock (utente finto, usata con NEXT_PUBLIC_API_MOCKING=true).
 */
export interface AuthProvider {
  getSession(): Promise<AuthSession | null>;
  getAccessToken(): Promise<string | null>;
  /** Rinnova la sessione e restituisce il nuovo access token, o null se non è possibile. */
  refreshSession(): Promise<string | null>;
  signIn(email: string, password: string): Promise<AuthSession>;
  signUp(email: string, password: string): Promise<SignUpResult>;
  signOut(): Promise<void>;
  /** Notifica i cambi di sessione; restituisce la funzione per annullare l'iscrizione. */
  onSessionChange(listener: (session: AuthSession | null) => void): () => void;
}
