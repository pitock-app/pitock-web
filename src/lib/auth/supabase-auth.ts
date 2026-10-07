import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AuthError, type AuthErrorCode, type AuthProvider, type AuthSession } from "./types";

function toSession(session: Session | null): AuthSession | null {
  if (!session?.user) return null;
  return {
    user: { id: session.user.id, email: session.user.email ?? "" },
    accessToken: session.access_token,
  };
}

/** Converte gli errori di Supabase Auth nei codici dell'app. */
export function mapSupabaseAuthError(error: { code?: string; status?: number }): AuthError {
  const byCode: Record<string, AuthErrorCode> = {
    invalid_credentials: "invalid_credentials",
    email_not_confirmed: "email_not_confirmed",
    user_already_exists: "user_exists",
    email_exists: "user_exists",
    weak_password: "weak_password",
    over_request_rate_limit: "rate_limited",
    over_email_send_rate_limit: "rate_limited",
  };
  const code =
    (error.code && byCode[error.code]) || (error.status === 429 ? "rate_limited" : "unknown");
  return new AuthError(code);
}

/** Autenticazione reale con Supabase Auth; la sessione vive nei cookie (@supabase/ssr). */
export function createSupabaseAuthProvider(
  client: SupabaseClient | null = createSupabaseBrowserClient(),
): AuthProvider {
  const supabase = () => {
    if (!client) throw new AuthError("not_configured");
    return client;
  };

  return {
    async getSession() {
      if (!client) return null;
      const { data } = await client.auth.getSession();
      return toSession(data.session);
    },
    async getAccessToken() {
      if (!client) return null;
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? null;
    },
    async refreshSession() {
      if (!client) return null;
      const { data, error } = await client.auth.refreshSession();
      return error ? null : (data.session?.access_token ?? null);
    },
    async signIn(email, password) {
      const { data, error } = await supabase().auth.signInWithPassword({ email, password });
      if (error) throw mapSupabaseAuthError(error);
      const session = toSession(data.session);
      if (!session) throw new AuthError("unknown");
      return session;
    },
    async signUp(email, password, metadata) {
      const { data, error } = await supabase().auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      });
      if (error) throw mapSupabaseAuthError(error);
      return { needsEmailConfirmation: !data.session };
    },
    async signOut() {
      if (!client) return;
      await client.auth.signOut();
    },
    onSessionChange(listener) {
      if (!client) return () => {};
      const { data } = client.auth.onAuthStateChange((_event, session) =>
        listener(toSession(session)),
      );
      return () => data.subscription.unsubscribe();
    },
  };
}
