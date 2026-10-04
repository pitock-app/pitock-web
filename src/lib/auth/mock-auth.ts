import {
  createMockAccessToken,
  MOCK_SESSION_COOKIE,
  MOCK_USER_ID,
  parseMockSessionCookie,
} from "./mock-session";
import type { AuthProvider, AuthSession } from "./types";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${MOCK_SESSION_COOKIE}=`));
  return parseMockSessionCookie(entry?.slice(MOCK_SESSION_COOKIE.length + 1));
}

function writeCookie(email: string | null) {
  const value = email ? encodeURIComponent(email) : "";
  const maxAge = email ? MAX_AGE_SECONDS : 0;
  document.cookie = `${MOCK_SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function toSession(email: string): AuthSession {
  return { user: { id: MOCK_USER_ID, email }, accessToken: createMockAccessToken(email) };
}

/**
 * Autenticazione finta per la modalità mock: accetta qualunque email e password
 * e tiene la sessione in un cookie, così anche il proxy la vede.
 */
export function createMockAuthProvider(): AuthProvider {
  const listeners = new Set<(session: AuthSession | null) => void>();
  const notify = (session: AuthSession | null) =>
    listeners.forEach((listener) => listener(session));

  const current = () => {
    const email = readCookie();
    return email ? toSession(email) : null;
  };

  return {
    async getSession() {
      return current();
    },
    async getAccessToken() {
      return current()?.accessToken ?? null;
    },
    async refreshSession() {
      return current()?.accessToken ?? null;
    },
    async signIn(email) {
      const normalized = email.trim().toLowerCase();
      writeCookie(normalized);
      const session = toSession(normalized);
      notify(session);
      return session;
    },
    async signUp(email, password) {
      await this.signIn(email, password);
      return { needsEmailConfirmation: false };
    },
    async signOut() {
      writeCookie(null);
      notify(null);
    },
    onSessionChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
