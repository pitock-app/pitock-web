import { isMockMode } from "@/lib/env";
import { createMockAuthProvider } from "./mock-auth";
import { createSupabaseAuthProvider } from "./supabase-auth";
import type { AuthProvider } from "./types";

export {
  AuthError,
  type AuthErrorCode,
  type AuthProvider,
  type AuthSession,
  type AuthUser,
} from "./types";
export { safeRedirectPath } from "./routes";

let provider: AuthProvider | null = null;

/** Provider di autenticazione dell'app: mock con NEXT_PUBLIC_API_MOCKING=true, altrimenti Supabase. */
export function getAuthProvider(): AuthProvider {
  provider ??= isMockMode ? createMockAuthProvider() : createSupabaseAuthProvider();
  return provider;
}
