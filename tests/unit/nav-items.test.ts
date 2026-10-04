import { describe, expect, it } from "vitest";
import { isNavItemActive, navItems } from "@/components/layout";

describe("navItems", () => {
  it("segue l'ordine Dashboard · Aggiungi · Scontrini (Impostazioni sta nel menu account)", () => {
    expect(navItems.map((item) => item.href)).toEqual(["/dashboard", "/add", "/receipts"]);
  });

  it("mette in evidenza solo Aggiungi", () => {
    expect(navItems.filter((item) => item.primary).map((item) => item.href)).toEqual(["/add"]);
  });
});

describe("isNavItemActive", () => {
  it("è attiva sulla rotta e sulle sottorotte", () => {
    expect(isNavItemActive("/receipts", "/receipts")).toBe(true);
    expect(isNavItemActive("/receipts/abc", "/receipts")).toBe(true);
    expect(isNavItemActive("/settings/ai", "/settings")).toBe(true);
  });

  it("non confonde rotte con lo stesso prefisso", () => {
    expect(isNavItemActive("/receipts-old", "/receipts")).toBe(false);
    expect(isNavItemActive("/dashboard", "/add")).toBe(false);
  });
});
