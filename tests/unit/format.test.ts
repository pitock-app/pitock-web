import { describe, expect, it } from "vitest";
import {
  decimalPlaces,
  formatAmountInput,
  formatCurrency,
  parseItalianNumber,
  romeLocalInputToIso,
  toRomeLocalInput,
} from "@/lib/format";

describe("parseItalianNumber", () => {
  it.each([
    ["12,50", 12.5],
    ["1.234,56", 1234.56],
    ["1.234", 1234],
    ["12.5", 12.5],
    ["0,99", 0.99],
    ["-3,20", -3.2],
    [" 7 ", 7],
    ["€ 4,00", 4],
    ["1.000.000,1", 1000000.1],
  ])("%s → %s", (input, expected) => {
    expect(parseItalianNumber(input)).toBe(expected);
  });

  it.each(["", "abc", "1,2,3", "12,", ",5", "1..2", "1.23.4"])("rifiuta %j", (input) => {
    expect(parseItalianNumber(input)).toBeNull();
  });

  it("conta i decimali", () => {
    expect(decimalPlaces("12,345")).toBe(3);
    expect(decimalPlaces("12,3")).toBe(1);
    expect(decimalPlaces("1.234")).toBe(0);
    expect(decimalPlaces("12.50")).toBe(2);
  });
});

describe("date nel fuso di Roma", () => {
  it("converte con l'ora legale (+02:00) e solare (+01:00)", () => {
    expect(romeLocalInputToIso("2026-10-04T12:30")).toBe("2026-10-04T12:30:00+02:00");
    expect(romeLocalInputToIso("2026-01-15T08:05")).toBe("2026-01-15T08:05:00+01:00");
  });

  it("rifiuta valori non validi", () => {
    expect(romeLocalInputToIso("")).toBeNull();
    expect(romeLocalInputToIso("2026-13-01T10:00")).toBeNull();
    expect(romeLocalInputToIso("oggi")).toBeNull();
    expect(romeLocalInputToIso("2026-02-31T10:00")).toBeNull();
  });

  it("formatta un istante per datetime-local nell'ora di Roma", () => {
    expect(toRomeLocalInput(new Date("2026-10-04T10:30:00Z"))).toBe("2026-10-04T12:30");
    expect(toRomeLocalInput(new Date("2026-01-15T07:05:00Z"))).toBe("2026-01-15T08:05");
  });
});

describe("importi", () => {
  it("formatta in euro con locale it-IT", () => {
    expect(formatCurrency(1234.5).replace(/\s/g, " ")).toBe("1234,50 €");
  });

  it("prepara il valore per un input", () => {
    expect(formatAmountInput(12.5)).toBe("12,50");
  });
});
