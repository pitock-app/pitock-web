/**
 * Sessione finta della modalità mock. Condivisa tra il provider mock (browser),
 * il proxy (server) e gli handler MSW: non dipende da React né da Next.
 */
export const MOCK_SESSION_COOKIE = "pitock-mock-session";
export const MOCK_USER_ID = "00000000-0000-4000-8000-000000000001";

const TOKEN_PREFIX = "mock.";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** Il valore del cookie è l'email codificata; null se manca o non è valido. */
export function parseMockSessionCookie(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const email = decodeURIComponent(value);
    return EMAIL_PATTERN.test(email) ? email : null;
  } catch {
    return null;
  }
}

export function createMockAccessToken(email: string): string {
  return `${TOKEN_PREFIX}${toBase64Url(email)}`;
}

/** Estrae l'email da un token mock; null se il token non è nel formato atteso. */
export function parseMockAccessToken(token: string | undefined | null): string | null {
  if (!token?.startsWith(TOKEN_PREFIX)) return null;
  try {
    const email = fromBase64Url(token.slice(TOKEN_PREFIX.length));
    return EMAIL_PATTERN.test(email) ? email : null;
  } catch {
    return null;
  }
}
