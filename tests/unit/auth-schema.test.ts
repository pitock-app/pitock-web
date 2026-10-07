import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/features/auth";

describe("schemi dei form di autenticazione", () => {
  it("login: email valida e password presente", () => {
    expect(loginSchema.safeParse({ email: " a@b.it ", password: "x" })).toMatchObject({
      success: true,
      data: { email: "a@b.it" },
    });
    const result = loginSchema.safeParse({ email: "a@", password: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "Inserisci un indirizzo email valido.",
      "Inserisci la password.",
    ]);
  });

  it("registrazione: password di almeno 8 caratteri e conferma uguale", () => {
    expect(
      registerSchema.safeParse({
        email: "a@b.it",
        password: "12345678",
        passwordConfirm: "12345678",
        terms: true,
        health: true,
      }).success,
    ).toBe(true);
    expect(
      registerSchema.safeParse({
        email: "a@b.it",
        password: "12345678",
        passwordConfirm: "12345678",
      }).success,
    ).toBe(false);
    const short = registerSchema.safeParse({
      email: "a@b.it",
      password: "123",
      passwordConfirm: "123",
      terms: true,
      health: true,
    });
    expect(short.error?.issues[0]?.message).toBe("La password deve avere almeno 8 caratteri.");
    const mismatch = registerSchema.safeParse({
      email: "a@b.it",
      password: "12345678",
      passwordConfirm: "12345679",
      terms: true,
      health: true,
    });
    expect(mismatch.error?.issues[0]).toMatchObject({
      path: ["passwordConfirm"],
      message: "Le password non coincidono.",
    });
  });
});
