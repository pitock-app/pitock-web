/** Classifiche, confronti e consigli di risparmio calcolati dalle statistiche dei prodotti. */

import {
  average,
  round2,
  type Category,
  type MeasureUnit,
  type ProductStats,
  type Purchase,
} from "./products";

/** Prodotti dove si è pagato più del miglior prezzo registrato, dal risparmio più alto. */
export function savingsRanking(products: ProductStats[]): ProductStats[] {
  return products
    .filter((p) => p.potentialSaving >= 0.01)
    .sort((a, b) => b.potentialSaving - a.potentialSaving || a.label.localeCompare(b.label));
}

/** Prodotti comprati in almeno due esercenti, dalla differenza di prezzo più alta. */
export function storeComparison(products: ProductStats[]) {
  return products
    .filter((p) => p.merchants.length >= 2)
    .map((p) => {
      const cheapest = p.merchants[0];
      const priciest = p.merchants[p.merchants.length - 1];
      return {
        product: p,
        cheapest,
        priciest,
        /** Quanto costa in meno (%) il più economico rispetto al più caro. */
        gap: ((priciest.averagePrice - cheapest.averagePrice) / priciest.averagePrice) * 100,
      };
    })
    .filter((row) => row.gap > 0)
    .sort((a, b) => b.gap - a.gap);
}

/** Prodotti comprati in giorni diversi, dalla variazione di prezzo più alta in valore assoluto. */
export function priceChanges(products: ProductStats[]) {
  return products
    .filter((p): p is ProductStats & { priceChange: number } => p.priceChange !== null)
    .filter((p) => Math.abs(p.priceChange) >= 0.5)
    .sort((a, b) => b.priceChange - a.priceChange);
}

/**
 * Formati e marche dello stesso tipo di prodotto messi a confronto sul prezzo al kg o al litro.
 * Solo tipi con almeno due prodotti diversi nella stessa unità.
 */
export function formatComparison(products: ProductStats[]) {
  const groups = new Map<string, ProductStats[]>();
  for (const product of products) {
    const type = product.typeKey;
    if (!type || !product.measuredPrice) continue;
    const id = `${type}:${product.measuredPrice.unit}`;
    groups.set(id, [...(groups.get(id) ?? []), product]);
  }
  return (
    [...groups]
      .filter(([, list]) => list.length >= 2)
      .map(([id, list]) => {
        const sorted = [...list].sort((a, b) => a.measuredPrice!.value - b.measuredPrice!.value);
        const cheapest = sorted[0].measuredPrice!.value;
        const priciest = sorted[sorted.length - 1].measuredPrice!.value;
        return {
          id,
          type: id.split(":")[0],
          unit: sorted[0].measuredPrice!.unit,
          products: sorted,
          gap: ((priciest - cheapest) / priciest) * 100,
        };
      })
      // Stesso prezzo al kg: niente da scegliere.
      .filter((group) => group.gap >= 1)
      .sort((a, b) => b.gap - a.gap)
  );
}

/** Storico dei prezzi di un prodotto: un punto per giorno ed esercente. */
export function priceHistory(purchases: Purchase[], key: string, unit: "pz" | "kg") {
  const points = new Map<string, Purchase[]>();
  for (const p of purchases) {
    if (p.key !== key || p.unit !== unit) continue;
    const id = `${p.day}|${p.merchant ?? ""}`;
    points.set(id, [...(points.get(id) ?? []), p]);
  }
  return [...points]
    .map(([, list]) => ({
      day: list[0].day,
      merchant: list[0].merchant,
      price: round2(average(list)),
    }))
    .sort(
      (a, b) => a.day.localeCompare(b.day) || (a.merchant ?? "").localeCompare(b.merchant ?? ""),
    );
}

/** Spesa per prodotto di una categoria (righe con quella categoria), dalla più alta. */
export function categoryProducts(products: ProductStats[], category: Category) {
  return products.filter((p) => p.category === category);
}

// ---- consigli ----

export type SavingTip =
  | {
      kind: "store";
      product: string;
      cheaper: string;
      pricier: string;
      gap: number;
      impact: number;
    }
  | {
      kind: "format";
      type: string;
      cheaper: string;
      pricier: string;
      unit: MeasureUnit;
      gap: number;
      impact: number;
    }
  | { kind: "increase"; product: string; change: number; since: string; impact: number }
  | {
      kind: "best-price";
      product: string;
      price: number;
      unit: "pz" | "kg";
      merchant: string | null;
      saving: number;
      impact: number;
    };

/**
 * Consigli di risparmio ricavati dai dati, dal più conveniente. `impact` è una stima in euro
 * sul periodo: serve solo a ordinarli.
 */
export function savingTips(products: ProductStats[], limit = 6): SavingTip[] {
  const tips: SavingTip[] = [];
  const covered = new Set<string>();
  for (const row of storeComparison(products)) {
    if (row.gap < 5) continue;
    covered.add(row.product.key);
    tips.push({
      kind: "store",
      product: row.product.label,
      cheaper: row.cheapest.merchant,
      pricier: row.priciest.merchant,
      gap: row.gap,
      impact: (row.product.averagePrice - row.cheapest.averagePrice) * row.product.quantity,
    });
  }
  for (const group of formatComparison(products)) {
    if (group.gap < 10) continue;
    const cheaper = group.products[0];
    const pricier = group.products[group.products.length - 1];
    tips.push({
      kind: "format",
      type: group.type,
      cheaper: cheaper.label,
      pricier: pricier.label,
      unit: group.unit,
      gap: group.gap,
      impact: pricier.totalSpent * (group.gap / 100),
    });
  }
  for (const product of priceChanges(products)) {
    if (product.priceChange < 5) continue;
    tips.push({
      kind: "increase",
      product: product.label,
      change: product.priceChange,
      since: product.firstDay,
      impact: (product.lastPrice - product.firstPrice) * product.quantity,
    });
  }
  for (const product of savingsRanking(products)) {
    if (covered.has(product.key) || product.potentialSaving < 0.5) continue;
    tips.push({
      kind: "best-price",
      product: product.label,
      price: product.bestPrice,
      unit: product.unit,
      merchant: product.bestMerchant,
      saving: product.potentialSaving,
      impact: product.potentialSaving,
    });
  }
  return tips.sort((a, b) => b.impact - a.impact).slice(0, limit);
}
