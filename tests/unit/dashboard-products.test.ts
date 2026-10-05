import { describe, expect, it } from "vitest";
import { filterDataset, receiptAmounts, summarize } from "@/features/dashboard/lib/dataset";
import {
  formatComparison,
  packSize,
  priceChanges,
  productKey,
  productLabel,
  productStats,
  savingsRanking,
  savingTips,
  storeComparison,
  toPurchases,
  type ItemFact,
  type ReceiptFact,
} from "@/features/dashboard/lib/products";

const receipt = (
  id: string,
  date: string,
  merchantName: string | null,
  total = 10,
): ReceiptFact => ({
  id,
  date,
  merchantName,
  merchantOriginal: merchantName,
  total,
  category: "alimentari",
  source: "camera",
});

const item = (
  receiptId: string,
  description: string,
  unitPrice: number | null,
  quantity: number | null = 1,
  amount: number | null = unitPrice !== null && quantity !== null ? unitPrice * quantity : null,
  category: ItemFact["category"] = "alimentari",
): ItemFact => ({
  receiptId,
  description,
  quantity,
  unitPrice,
  amount,
  category,
  normalizedName: null,
  brand: null,
  size: null,
  sizeUnit: null,
});

describe("normalizzazione dei prodotti", () => {
  it("toglie peso, prezzo al kg e quantità ripetuti dalla descrizione", () => {
    expect(productKey("PESCHE NETTARINE 1,468 kg x 2,19 EUR/kg")).toBe("pesche nettarine");
    expect(productKey("INSALATA RICCA Cad 0,79 Pz. 2")).toBe("insalata ricca");
    expect(productKey("Caffè Macinato 250G")).toBe("caffe macinato 250g");
    expect(productLabel("LATTE INTERO 1L")).toBe("Latte intero 1L");
    expect(productLabel("Pane casareccio")).toBe("Pane casareccio");
  });

  it("legge il formato della confezione in kg o litri", () => {
    expect(packSize("CAFFE MACINATO 250G")).toEqual({ value: 0.25, unit: "kg" });
    expect(packSize("LATTE INTERO 0,5L")).toEqual({ value: 0.5, unit: "l" });
    expect(packSize("MELE GOLDEN KG 1,2")).toEqual({ value: 1.2, unit: "kg" });
    expect(packSize("YOGURT 2X125G")).toEqual({ value: 0.25, unit: "kg" });
    expect(packSize("ACQUA 75CL")).toEqual({ value: 0.75, unit: "l" });
    expect(packSize("NUTELLA")).toBeNull();
  });

  it("scarta sconti, cashback, sacchetti, righe generiche e righe senza importo; riconosce i prodotti a peso", () => {
    const purchases = toPurchases(
      [receipt("r1", "2026-10-04T10:00:00Z", "Lidl")],
      [
        item("r1", "BANANE", 0.98, 0.296, 0.29),
        item("r1", "CETRIOLI 0,992 kg x 1,99 EUR/kg", 1.99, 1, 1.97),
        item("r1", "Sconto Lidl Plus", -0.31),
        item("r1", "CASHBACK U!", -0.02),
        item("r1", "SACCHETTO ORTOFRUTTAR", 0.01),
        item("r1", "SHOPPER BIO 34X65", 0.15),
        item("r1", "Articolo 1", 9.5),
        item("r1", "REPARTO 3", 4),
        item("r1", "NETTARINA BIANCA", null, null, null),
        item("r1", "PANE", null, null, 2.3),
      ],
    );
    expect(purchases.map((p) => [p.key, p.unit, p.quantity, p.unitPrice])).toEqual([
      ["banane", "kg", 0.296, 0.98],
      ["cetrioli", "kg", 0.992, 1.99],
      ["pane", "pz", 1, 2.3],
    ]);
    expect(purchases[0].measuredPrice).toEqual({ value: 0.98, unit: "kg" });
  });
});

describe("statistiche di convenienza", () => {
  // Latte: Esselunga 1,49 (x2 il 1/9), Lidl 1,29, Esselunga 1,59 (1/10). Pasta: solo Coop.
  const receipts = [
    receipt("a", "2026-09-01T09:00:00Z", "Esselunga"),
    receipt("b", "2026-09-15T09:00:00Z", "Lidl"),
    receipt("c", "2026-10-01T09:00:00Z", "Esselunga"),
    receipt("d", "2026-10-02T09:00:00Z", "Coop"),
  ];
  const items = [
    item("a", "LATTE INTERO 1L", 1.49, 2),
    item("b", "LATTE INTERO 1L", 1.29),
    item("c", "LATTE INTERO 1L", 1.59),
    item("d", "PASTA PENNE 500G", 0.95),
    item("d", "PASTA PENNE 1KG", 1.6),
    item("d", "DETERSIVO", 2.5, 1, 2.5, "casa"),
  ];
  const products = productStats(toPurchases(receipts, items));
  const milk = products.find((p) => p.key === "latte intero 1l")!;

  it("calcola spesa, prezzo medio e risparmio potenziale sul miglior prezzo registrato", () => {
    expect(milk.totalSpent).toBe(5.86);
    expect(milk.quantity).toBe(4);
    expect(milk.averagePrice).toBe(1.47); // 5,86 / 4 = 1,465
    expect(milk.bestPrice).toBe(1.29);
    expect(milk.bestMerchant).toBe("Lidl");
    // (1,49 − 1,29) × 2 + (1,59 − 1,29) × 1 = 0,70
    expect(milk.potentialSaving).toBe(0.7);
    expect(savingsRanking(products).map((p) => p.key)).toEqual(["latte intero 1l"]);
    expect(products[0].key).toBe("latte intero 1l"); // la spesa più alta in cima
  });

  it("confronta i negozi sul prezzo medio e mette il più economico per primo", () => {
    expect(milk.merchants).toEqual([
      { merchant: "Lidl", averagePrice: 1.29, minPrice: 1.29, purchases: 1 },
      // Esselunga: (1,49 × 2 + 1,59) / 3 = 1,5233
      { merchant: "Esselunga", averagePrice: 1.52, minPrice: 1.49, purchases: 2 },
    ]);
    const [row] = storeComparison(products);
    expect(row.cheapest.merchant).toBe("Lidl");
    // Sui prezzi medi mostrati (arrotondati al centesimo): (1,52 − 1,29) / 1,52.
    expect(row.gap).toBeCloseTo(((1.52 - 1.29) / 1.52) * 100, 5);
  });

  it("misura la variazione tra il primo e l'ultimo giorno d'acquisto", () => {
    expect(milk.firstPrice).toBe(1.49);
    expect(milk.lastPrice).toBe(1.59);
    expect(milk.priceChange).toBeCloseTo(6.71, 2);
    expect(priceChanges(products).map((p) => p.key)).toEqual(["latte intero 1l"]);
  });

  it("confronta i formati dello stesso tipo sul prezzo al kg", () => {
    const [pasta] = formatComparison(products);
    expect(pasta.type).toBe("pasta");
    expect(pasta.products.map((p) => [p.label, p.measuredPrice])).toEqual([
      ["Pasta penne 1kg", { value: 1.6, unit: "kg" }],
      ["Pasta penne 500g", { value: 1.9, unit: "kg" }],
    ]);
    expect(pasta.gap).toBeCloseTo(15.79, 2);
  });

  it("genera consigli ordinati per risparmio stimato", () => {
    const tips = savingTips(products);
    // Negozio: (1,47 − 1,29) × 4 = 0,72 €; rincaro: (1,59 − 1,49) × 4 = 0,40 €;
    // formato: 0,95 € di pasta da 500g × 15,8% = 0,15 €.
    expect(tips.map((tip) => tip.kind)).toEqual(["store", "increase", "format"]);
    expect(tips[0]).toMatchObject({
      product: "Latte intero 1L",
      cheaper: "Lidl",
      pricier: "Esselunga",
    });
  });
});

describe("filtri del dataset", () => {
  const receipts = [
    { ...receipt("a", "2026-10-01T09:00:00Z", "Lidl", 12), category: "alimentari" as const },
    { ...receipt("b", "2026-10-02T09:00:00Z", "Esselunga", 30), category: "casa" as const },
  ];
  const items = [
    item("a", "LATTE", 2),
    item("a", "DETERSIVO", 10, 1, 10, "casa"),
    item("b", "SCOPA", 30, 1, 30, "casa"),
  ];

  it("filtra per negozio e per categoria, contando solo le righe della categoria", () => {
    expect(filterDataset({ receipts, items }, { store: "Lidl" }).receipts.map((r) => r.id)).toEqual(
      ["a"],
    );
    const casa = filterDataset({ receipts, items }, { category: "casa" });
    expect(casa.receipts.map((r) => r.id)).toEqual(["a", "b"]);
    expect(casa.items.map((i) => i.description)).toEqual(["DETERSIVO", "SCOPA"]);
    const amounts = receiptAmounts(casa.receipts, casa.items, "casa");
    expect(Object.fromEntries(amounts)).toEqual({ a: 10, b: 30 });
    const summary = summarize(casa.receipts, amounts, "month");
    expect(summary.totals).toEqual({ total: 40, nReceipts: 2, average: 20 });
    expect(summary.byPeriod).toEqual([{ period: "2026-10", total: 40, nReceipts: 2 }]);
  });

  it("gli scontrini senza negozio formano una voce a parte che chiude il totale", () => {
    const all = [...receipts, receipt("c", "2026-10-03T09:00:00Z", null, 7.5)];
    const amounts = receiptAmounts(all, [], undefined);
    const summary = summarize(all, amounts, "month");
    expect(summary.withoutMerchant).toEqual({ total: 7.5, nReceipts: 1 });
    const stores = summary.topMerchants.reduce((sum, row) => sum + row.total, 0);
    expect(stores + (summary.withoutMerchant?.total ?? 0)).toBe(summary.totals.total);
    expect(
      summarize(receipts, receiptAmounts(receipts, [], undefined), "month").withoutMerchant,
    ).toBeNull();
  });
});

describe("prodotti normalizzati dal modello", () => {
  const norm = (
    receiptId: string,
    description: string,
    unitPrice: number,
    normalizedName: string,
    brand: string | null,
    size: number | null,
    sizeUnit: ItemFact["sizeUnit"],
  ): ItemFact => ({
    ...item(receiptId, description, unitPrice),
    normalizedName,
    brand,
    size,
    sizeUnit,
  });
  const receipts = [
    receipt("a", "2026-09-01T09:00:00Z", "Lidl"),
    receipt("b", "2026-09-02T09:00:00Z", "Esselunga"),
  ];
  const items = [
    // Stesso latte, scritto in due modi diversi.
    norm("a", "LATTE PS UHT GRAN 1L", 1.29, "Latte parzialmente scremato UHT", "Granarolo", 1, "l"),
    norm(
      "b",
      "GRANAROLO LATTE P.S. 1000ML",
      1.59,
      "latte parzialmente scremato UHT",
      "Granarolo",
      1,
      "l",
    ),
    // Stesso tipo, altra marca e formato: confronto al litro.
    norm("b", "PARMALAT PS 500ML", 0.99, "Latte parzialmente scremato UHT", "Parmalat", 500, "ml"),
    // Riga vecchia senza nome normalizzato: resta com'era.
    item("a", "PASTA PENNE 500G", 0.95),
  ];
  const products = productStats(toPurchases(receipts, items));

  it("riconosce lo stesso prodotto in negozi diversi anche con descrizioni diverse", () => {
    const milk = products.find(
      (p) => p.label === "Latte parzialmente scremato UHT · Granarolo · 1 L",
    );
    expect(milk?.merchants.map((m) => m.merchant)).toEqual(["Lidl", "Esselunga"]);
    expect(storeComparison(products)).toHaveLength(1);
    expect(products.some((p) => p.key === "pasta penne 500g")).toBe(true);
  });

  it("confronta marche e formati dello stesso tipo sul prezzo al litro", () => {
    const [group] = formatComparison(products);
    expect(group.type).toBe("latte parzialmente scremato uht");
    expect(group.unit).toBe("l");
    expect(group.products.map((p) => [p.label, p.measuredPrice?.value])).toEqual([
      ["Latte parzialmente scremato UHT · Granarolo · 1 L", 1.44],
      ["Latte parzialmente scremato UHT · Parmalat · 500 ml", 1.98],
    ]);
  });
});
