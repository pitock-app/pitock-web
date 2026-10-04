import { describe, expect, it } from "vitest";
import { AuthError } from "@/lib/auth";
import { createSupabaseAuthProvider, mapSupabaseAuthError } from "@/lib/auth/supabase-auth";

describe("AuthProvider Supabase", () => {
  it("traduce i codici di errore di Supabase", () => {
    expect(mapSupabaseAuthError({ code: "invalid_credentials" }).code).toBe("invalid_credentials");
    expect(mapSupabaseAuthError({ code: "user_already_exists" }).code).toBe("user_exists");
    expect(mapSupabaseAuthError({ code: "weak_password" }).code).toBe("weak_password");
    expect(mapSupabaseAuthError({ status: 429 }).code).toBe("rate_limited");
    expect(mapSupabaseAuthError({ code: "boh" }).code).toBe("unknown");
  });

  it("senza configurazione non ha sessione e il login spiega cosa manca", async () => {
    const auth = createSupabaseAuthProvider(null);
    expect(await auth.getSession()).toBeNull();
    expect(await auth.getAccessToken()).toBeNull();
    expect(await auth.refreshSession()).toBeNull();
    await expect(auth.signIn("a@b.it", "x")).rejects.toEqual(new AuthError("not_configured"));
  });
});
