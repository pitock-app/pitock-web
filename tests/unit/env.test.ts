import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("applica i default quando le variabili mancano o sono vuote", () => {
    const env = parseEnv({ NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_API_MOCKING: "" });
    expect(env).toEqual({
      NEXT_PUBLIC_API_URL: "http://localhost:8787",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      NEXT_PUBLIC_API_MOCKING: false,
    });
  });

  it("converte NEXT_PUBLIC_API_MOCKING in booleano", () => {
    expect(parseEnv({ NEXT_PUBLIC_API_MOCKING: "true" }).NEXT_PUBLIC_API_MOCKING).toBe(true);
  });

  it("rifiuta un URL dell'API non valido", () => {
    expect(() => parseEnv({ NEXT_PUBLIC_API_URL: "non-un-url" })).toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it("rifiuta un valore di mocking non previsto", () => {
    expect(() => parseEnv({ NEXT_PUBLIC_API_MOCKING: "forse" })).toThrow(/NEXT_PUBLIC_API_MOCKING/);
  });

  it("accetta solo gli ambienti di Vercel previsti", () => {
    expect(parseEnv({ NEXT_PUBLIC_VERCEL_ENV: "production" }).NEXT_PUBLIC_VERCEL_ENV).toBe(
      "production",
    );
    expect(() => parseEnv({ NEXT_PUBLIC_VERCEL_ENV: "prod" })).toThrow(/NEXT_PUBLIC_VERCEL_ENV/);
  });
});
