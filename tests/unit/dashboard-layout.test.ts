import { describe, expect, it } from "vitest";
import { applyOrder } from "@/features/dashboard/lib/layout";

describe("ordine delle card della dashboard", () => {
  const defaults = ["a", "b", "c", "d"];

  it("senza ordine salvato usa quello di default", () => {
    expect(applyOrder(defaults, undefined)).toEqual(defaults);
  });

  it("toglie le card che non esistono più e mette in coda quelle nuove", () => {
    expect(applyOrder(defaults, ["c", "x", "a"])).toEqual(["c", "a", "b", "d"]);
  });
});
