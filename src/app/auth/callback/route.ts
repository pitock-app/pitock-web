import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, safeRedirectPath } from "@/lib/auth/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Destinazione del link di conferma email di Supabase: scambia il codice con la sessione. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
}
