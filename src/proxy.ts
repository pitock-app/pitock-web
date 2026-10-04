import { NextResponse, type NextRequest } from "next/server";
import { MOCK_SESSION_COOKIE, parseMockSessionCookie } from "@/lib/auth/mock-session";
import {
  DEFAULT_AUTHENTICATED_PATH,
  isGuestOnlyPath,
  isProtectedPath,
  LOGIN_PATH,
} from "@/lib/auth/routes";
import { isMockMode } from "@/lib/env";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

/**
 * Redirect che conserva i cookie di sessione eventualmente rinnovati.
 * Mai in cache: può contenere Set-Cookie di sessione.
 */
function redirectTo(url: URL, from: NextResponse) {
  const response = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/**
 * La sessione finta vale solo fuori dalla produzione: se NEXT_PUBLIC_API_MOCKING
 * restasse attivo per errore in un deploy di produzione, il proxy usa comunque Supabase.
 */
const useMockSession = isMockMode;

/** Refresh della sessione e protezione delle rotte (in Next 16 sostituisce middleware.ts). */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const { response, isAuthenticated } = useMockSession
    ? {
        response: NextResponse.next({ request }),
        isAuthenticated: Boolean(
          parseMockSessionCookie(request.cookies.get(MOCK_SESSION_COOKIE)?.value),
        ),
      }
    : await updateSupabaseSession(request);

  if (!isAuthenticated && isProtectedPath(pathname)) {
    const url = new URL(LOGIN_PATH, request.url);
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return redirectTo(url, response);
  }

  if (isAuthenticated && isGuestOnlyPath(pathname)) {
    return redirectTo(new URL(DEFAULT_AUTHENTICATED_PATH, request.url), response);
  }

  return response;
}

export const config = {
  matcher: [
    // Tutto tranne asset statici, immagini, manifest e service worker di MSW.
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|mockServiceWorker.js|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)",
  ],
};
