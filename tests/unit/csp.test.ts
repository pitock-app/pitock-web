import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, createNonce } from "@/lib/csp";

const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1);

describe("Content Security Policy", () => {
  it("ammette gli script solo con il nonce della richiesta, senza 'unsafe-inline'", () => {
    const csp = contentSecurityPolicy("abc123", false);
    expect(directive(csp, "script-src")).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("'unsafe-eval' solo in sviluppo", () => {
    expect(directive(contentSecurityPolicy("n", true), "script-src")).toContain("'unsafe-eval'");
    expect(directive(contentSecurityPolicy("n", false), "script-src")).not.toContain("unsafe-eval");
  });

  it("un nonce diverso a ogni richiesta", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
  });
});
