/** Regole di routing legate all'autenticazione, condivise da proxy e form. */
export const LOGIN_PATH = "/login";
export const DEFAULT_AUTHENTICATED_PATH = "/dashboard";

/** Pagine solo per chi non è autenticato: chi ha già una sessione va alla dashboard. */
const GUEST_ONLY_PATHS = ["/login", "/register"];
/** Pagine accessibili a tutti. */
const PUBLIC_PATHS = ["/auth/callback", "/legal"];

function matches(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isGuestOnlyPath(pathname: string): boolean {
  return GUEST_ONLY_PATHS.some((base) => matches(pathname, base));
}

export function isProtectedPath(pathname: string): boolean {
  return !isGuestOnlyPath(pathname) && !PUBLIC_PATHS.some((base) => matches(pathname, base));
}

const INTERNAL_ORIGIN = "http://internal.invalid";

/**
 * Accetta solo percorsi interni ("/qualcosa"), per evitare open redirect
 * tramite il parametro `next`. L'URL viene risolto come farebbe il browser
 * (che ignora tab e a capo) e deve restare sulla stessa origine.
 */
export function safeRedirectPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return DEFAULT_AUTHENTICATED_PATH;
  let url: URL;
  try {
    url = new URL(next, INTERNAL_ORIGIN);
  } catch {
    return DEFAULT_AUTHENTICATED_PATH;
  }
  if (url.origin !== INTERNAL_ORIGIN || isGuestOnlyPath(url.pathname)) {
    return DEFAULT_AUTHENTICATED_PATH;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
