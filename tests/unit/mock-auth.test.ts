import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockAuthProvider } from "@/lib/auth/mock-auth";
import {
  createMockAccessToken,
  MOCK_SESSION_COOKIE,
  parseMockAccessToken,
  parseMockSessionCookie,
} from "@/lib/auth/mock-session";

afterEach(() => {
  document.cookie = `${MOCK_SESSION_COOKIE}=; Path=/; Max-Age=0`;
});

describe("sessione mock", () => {
  it("il token codifica l'email e si rilegge", () => {
    const token = createMockAccessToken("zoë@pitock.test");
    expect(token.startsWith("mock.")).toBe(true);
    expect(parseMockAccessToken(token)).toBe("zoë@pitock.test");
    expect(parseMockAccessToken("eyJhbGciOi.jwt.vero")).toBeNull();
    expect(parseMockAccessToken("mock.!!!")).toBeNull();
    expect(parseMockAccessToken(null)).toBeNull();
  });

  it("il cookie è valido solo se contiene un'email", () => {
    expect(parseMockSessionCookie(encodeURIComponent("a@b.it"))).toBe("a@b.it");
    expect(parseMockSessionCookie("x")).toBeNull();
    expect(parseMockSessionCookie("%E0%A4%A")).toBeNull();
    expect(parseMockSessionCookie(undefined)).toBeNull();
  });
});

describe("AuthProvider mock", () => {
  it("accetta qualunque email, salva la sessione nel cookie e notifica i cambi", async () => {
    const auth = createMockAuthProvider();
    const listener = vi.fn();
    const unsubscribe = auth.onSessionChange(listener);

    expect(await auth.getSession()).toBeNull();
    const session = await auth.signIn(" Anna@Pitock.test ", "qualsiasi");

    expect(session.user.email).toBe("anna@pitock.test");
    expect(document.cookie).toContain(`${MOCK_SESSION_COOKIE}=anna%40pitock.test`);
    expect(await auth.getAccessToken()).toBe(createMockAccessToken("anna@pitock.test"));
    expect(await auth.refreshSession()).toBe(session.accessToken);
    expect(listener).toHaveBeenLastCalledWith(session);

    await auth.signOut();
    expect(await auth.getSession()).toBeNull();
    expect(await auth.refreshSession()).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null);

    unsubscribe();
    await auth.signIn("b@pitock.test", "x");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("la registrazione mock non chiede conferma dell'email", async () => {
    const auth = createMockAuthProvider();
    expect(await auth.signUp("c@pitock.test", "password1")).toEqual({
      needsEmailConfirmation: false,
    });
    expect((await auth.getSession())?.user.email).toBe("c@pitock.test");
  });
});
