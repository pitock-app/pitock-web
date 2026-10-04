import { describe, expect, it } from "vitest";
import { isGuestOnlyPath, isProtectedPath, safeRedirectPath } from "@/lib/auth/routes";

describe("rotte e autenticazione", () => {
  it("protegge le pagine dell'app ma non login, registrazione e callback", () => {
    for (const path of ["/", "/dashboard", "/add", "/receipts/1", "/settings/ai", "/onboarding"]) {
      expect(isProtectedPath(path)).toBe(true);
    }
    for (const path of ["/login", "/register", "/auth/callback"]) {
      expect(isProtectedPath(path)).toBe(false);
    }
    expect(isGuestOnlyPath("/login")).toBe(true);
    expect(isGuestOnlyPath("/loginx")).toBe(false);
  });

  it("accetta solo redirect interni", () => {
    expect(safeRedirectPath("/receipts?status=failed")).toBe("/receipts?status=failed");
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/login")).toBe("/dashboard");
    expect(safeRedirectPath("/\t/evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\n/evil.example")).toBe("/dashboard");
    expect(safeRedirectPath(decodeURIComponent("/%09/evil.example"))).toBe("/dashboard");
    expect(safeRedirectPath(["/a", "/b"])).toBe("/dashboard");
  });
});
