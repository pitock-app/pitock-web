import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Rinnova la sessione Supabase nei cookie e dice se l'utente è autenticato.
 * Da usare solo nel proxy.
 */
export async function updateSupabaseSession(
  request: NextRequest,
): Promise<{ response: NextResponse; isAuthenticated: boolean }> {
  let response = NextResponse.next({ request });

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { response, isAuthenticated: false };
  }

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // getClaims verifica il JWT: non fidarsi di getSession lato server.
  const { data, error } = await supabase.auth.getClaims();
  return { response, isAuthenticated: !error && Boolean(data?.claims?.sub) };
}
