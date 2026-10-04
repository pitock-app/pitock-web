import { describe, expect, it } from "vitest";
import { isDateInput, resolvePeriod } from "@/lib/period";

// 4 ottobre 2026, 10:00 a Roma.
const now = new Date("2026-10-04T08:00:00Z");

describe("resolvePeriod", () => {
  it("calcola i periodi predefiniti nel fuso di Roma", () => {
    expect(resolvePeriod("all", {}, now)).toEqual({});
    expect(resolvePeriod("this-month", {}, now)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(resolvePeriod("last-month", {}, now)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(resolvePeriod("last-12-months", {}, now)).toEqual({
      from: "2025-11-01",
      to: "2026-10-31",
    });
    expect(resolvePeriod("this-year", {}, now)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("gestisce il cambio d'anno e il giorno a Roma diverso da UTC", () => {
    // 31 dicembre 23:30 UTC = 1 gennaio a Roma.
    const newYear = new Date("2026-12-31T23:30:00Z");
    expect(resolvePeriod("this-month", {}, newYear)).toEqual({
      from: "2027-01-01",
      to: "2027-01-31",
    });
    expect(resolvePeriod("last-month", {}, newYear)).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
  });

  it("usa solo le date valide del periodo personalizzato", () => {
    expect(resolvePeriod("custom", { from: "2026-02-01", to: "2026-02-30" }, now)).toEqual({
      from: "2026-02-01",
    });
  });
});

describe("isDateInput", () => {
  it("accetta solo date esistenti AAAA-MM-GG", () => {
    expect(isDateInput("2024-02-29")).toBe(true);
    expect(isDateInput("2026-02-29")).toBe(false);
    expect(isDateInput("2026-1-01")).toBe(false);
    expect(isDateInput(null)).toBe(false);
  });
});
