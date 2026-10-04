import { describe, expect, it } from "vitest";
import { sha256 } from "@/features/capture/lib/sha256";

describe("sha256", () => {
  it("calcola l'impronta in esadecimale", async () => {
    expect(await sha256(new Blob(["abc"]))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
