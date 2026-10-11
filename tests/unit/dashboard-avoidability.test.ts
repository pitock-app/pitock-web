import { describe, expect, it } from "vitest";
import {
  avoidabilityLines,
  avoidabilityByPeriod,
  avoidabilitySummary,
} from "@/features/dashboard/lib/avoidability";
import { categoryLines, receiptAmounts } from "@/features/dashboard/lib/dataset";
import type { ItemFact, ReceiptFact } from "@/features/dashboard/lib/products";

const receipt = (
  id: string,
  date: string,
  total: number,
  avoidability: ReceiptFact["avoidability"],
  category: ReceiptFact["category"] = "alimentari",
): ReceiptFact => ({
  id,
  date,
  merchantName: "Negozio",
  merchantOriginal: "Negozio",
  total,
  category,
  avoidability,
  source: "camera",
});

const item = (
  receiptId: string,
  description: string,
  amount: number,
  avoidability: ItemFact["avoidability"],
  category: ItemFact["category"] = "alimentari",
): ItemFact => ({
  receiptId,
  description,
  quantity: 1,
  unitPrice: amount,
  amount,
  category,
  normalizedName: null,
  brand: null,
  size: null,
  sizeUnit: null,
  avoidability,
});

const receipts = [
  // Spesa: pane essenziale, patatine superflue, il resto (sconto) segue lo scontrino.
  receipt("a", "2026-10-05T09:00:00Z", 11, "essenziale"),
  // Bolletta senza righe.
  receipt("b", "2026-09-20T09:00:00Z", 40, "essenziale", "servizi"),
  // Cena fuori.
  receipt("c", "2026-09-10T20:00:00Z", 30, "superfluo", "ristorazione"),
  // Estrazione vecchia: niente evitabilità.
  receipt("d", "2026-09-01T09:00:00Z", 20, null),
];
const items = [
  item("a", "PANE", 2, "essenziale"),
  item("a", "PATATINE", 4, "superfluo"),
  item("a", "BISCOTTI", 6, "utile"),
  item("c", "PIZZA", 30, "superfluo", "ristorazione"),
];
const lines = categoryLines(receipts, items, receiptAmounts(receipts, items));

describe("indice di evitabilità", () => {
  it("somma la spesa per livello e tiene fuori dall'indice il non classificato", () => {
    const summary = avoidabilitySummary(lines);
    // Il resto di "a" (11 − 12 = −1) segue lo scontrino: essenziale.
    expect(summary.amounts).toEqual({ essenziale: 41, utile: 6, superfluo: 34, unclassified: 20 });
    expect(summary.classified).toBe(81);
    expect(summary.avoidable).toBe(37);
    expect(summary.index).toBeCloseTo((37 / 81) * 100, 5);
  });

  it("senza spesa classificata l'indice è null", () => {
    const old = categoryLines([receipts[3]], [], receiptAmounts([receipts[3]], []));
    expect(avoidabilitySummary(old).index).toBeNull();
  });

  it("divide per mese, compresi i mesi senza spese", () => {
    const rows = avoidabilityByPeriod(lines, "month", ["2026-08", "2026-09", "2026-10"]);
    expect(rows.map((r) => [r.period, r.amounts.superfluo, r.amounts.unclassified])).toEqual([
      ["2026-08", 0, 0],
      ["2026-09", 30, 20],
      ["2026-10", 4, 0],
    ]);
    expect(rows[0]?.index).toBeNull();
  });

  it("elenca le voci di un livello dalla più costosa, anche per un solo periodo", () => {
    const superfluous = avoidabilityLines(lines, "superfluo");
    expect(superfluous.map((l) => l.amount)).toEqual([30, 4]);
    expect(avoidabilityLines(lines, "superfluo", "2026-10").map((l) => l.amount)).toEqual([4]);
    const sum = (bucket: Parameters<typeof avoidabilityLines>[1]) =>
      avoidabilityLines(lines, bucket).reduce((total, l) => total + l.amount, 0);
    const summary = avoidabilitySummary(lines);
    for (const bucket of ["essenziale", "utile", "superfluo", "unclassified"] as const) {
      expect(sum(bucket)).toBeCloseTo(summary.amounts[bucket], 2);
    }
  });
});
