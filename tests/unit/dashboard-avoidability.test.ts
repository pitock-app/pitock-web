import { describe, expect, it } from "vitest";
import {
  avoidabilityByCategory,
  avoidabilityByPeriod,
  avoidabilitySummary,
  topSuperfluous,
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

  it("ordina le categorie dalla più evitabile, senza quelle non classificate", () => {
    expect(avoidabilityByCategory(lines).map((r) => [r.category, Math.round(r.index)])).toEqual([
      ["ristorazione", 100],
      ["alimentari", 64],
      ["servizi", 0],
    ]);
  });

  it("elenca i prodotti superflui per spesa, con lo scontrino più recente", () => {
    const more = [...items, item("e", "PATATINE", 3, "superfluo")];
    const all = [...receipts, receipt("e", "2026-10-08T09:00:00Z", 3, "superfluo")];
    const top = topSuperfluous(categoryLines(all, more, receiptAmounts(all, more)));
    expect(top.map((r) => [r.label, r.total, r.count, r.receiptId])).toEqual([
      ["Pizza", 30, 1, "c"],
      ["Patatine", 7, 2, "e"],
    ]);
  });
});
