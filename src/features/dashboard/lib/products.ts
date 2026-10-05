import type { components } from "@/lib/api/schema";
import { toRomeDateInput } from "@/lib/format";

type Schemas = components["schemas"];
export type Category = Schemas["Category"];
export type ReceiptFact = Schemas["StatsReceiptFact"];
export type ItemFact = Schemas["StatsItemFact"];

/** Unità del prezzo confrontabile: al pezzo, oppure al kg / litro. */
export type PriceUnit = "pz" | "kg" | "l";

/** Un acquisto di un prodotto: una riga di scontrino ripulita e con il prezzo unitario. */
export type Purchase = {
  /**
   * Chiave del prodotto: nome normalizzato dal modello con marca e formato, oppure (righe
   * vecchie o manuali) la descrizione ripulita.
   */
  key: string;
  label: string;
  /** Tipo di prodotto, per confrontare formati e marche ("latte intero"). */
  typeKey: string | null;
  receiptId: string;
  /** Giorno di Roma (YYYY-MM-DD). */
  day: string;
  merchant: string | null;
  category: Category;
  /** Quantità acquistata, nell'unità `unit` (pezzi o kg). */
  quantity: number;
  /** Importo pagato per la riga. */
  amount: number;
  /** Prezzo per unità acquistata (€/pezzo, o €/kg per i prodotti a peso). */
  unitPrice: number;
  unit: "pz" | "kg";
  /** Prezzo al kg o al litro ricavato dal formato scritto nella descrizione; null se manca. */
  measuredPrice: { value: number; unit: MeasureUnit } | null;
};

/** Unità del prezzo confrontabile tra formati: al kg, al litro o al pezzo della confezione. */
export type MeasureUnit = "kg" | "l" | "pz";

// ---- normalizzazione delle descrizioni ----

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
/** "1,468 kg x 2,19 EUR/kg": prodotto a peso con prezzo al kg nella descrizione. */
const WEIGHED = new RegExp(
  String.raw`(${NUMBER})\s*kg\s*x\s*(${NUMBER})\s*(?:eur|€)\s*/\s*kg`,
  "i",
);
/** "Cad 0,79 Pz. 2": prezzo e quantità ripetuti nella descrizione. */
const PIECES = new RegExp(String.raw`\bcad\.?\s*${NUMBER}\s*pz\.?\s*\d+`, "i");
/** "6x125g", "2 x 1l": confezioni multiple. */
const MULTIPACK = new RegExp(String.raw`\b(\d+)\s*x\s*(${NUMBER})\s*(kg|g|gr|l|lt|ml|cl)\b`, "i");
/** "500g", "1,5 l", "kg 1,2". */
const SIZE = new RegExp(
  String.raw`(?:\b(${NUMBER})\s*(kg|g|gr|l|lt|ml|cl)\b|\b(kg|l|lt)\s*(${NUMBER})\b)`,
  "i",
);
/**
 * Righe che non sono prodotti: sacchetti e buste (costano centesimi e falsano le classifiche) e
 * descrizioni generiche ("Articolo 1", "Reparto 3", "Varie") che in negozi diversi sono cose diverse.
 */
const NOT_A_PRODUCT =
  /\b(shopper|sacchett\w*|sacco\.?\s*ortofr\w*|busta|buste)\b|^\s*(articol[oi]|reparto|varie|vari|merce)\b/i;

const toNumber = (text: string) => Number(text.replace(",", "."));

function stripAccents(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Descrizione senza peso, prezzo e quantità ripetuti: "INSALATA RICCA Cad 0,79 Pz. 2" → "INSALATA RICCA". */
function cleanDescription(description: string) {
  return description.replace(WEIGHED, " ").replace(PIECES, " ").replace(/\s+/g, " ").trim();
}

/** Chiave del prodotto: minuscole, senza accenti né punteggiatura (la virgola dei formati resta). */
export function productKey(description: string): string {
  return stripAccents(cleanDescription(description).toLowerCase())
    .replace(/[^a-z0-9,\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Etichetta leggibile: "LATTE INTERO 1L" → "Latte intero 1L". */
export function productLabel(description: string): string {
  const clean = cleanDescription(description);
  if (clean !== clean.toUpperCase()) return clean;
  const lower = clean
    .toLowerCase()
    .replace(/(\d)(kg|g|gr|l|lt|ml|cl)\b/g, (_, digit, unit) =>
      unit === "l" || unit === "lt" ? `${digit}L` : `${digit}${unit}`,
    );
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Formato della confezione in kg o litri, letto dalla descrizione; null se non c'è. */
export function packSize(description: string): { value: number; unit: "kg" | "l" } | null {
  const text = cleanDescription(description);
  const convert = (amount: number, unit: string) => {
    switch (unit.toLowerCase()) {
      case "kg":
        return { value: amount, unit: "kg" as const };
      case "g":
      case "gr":
        return { value: amount / 1000, unit: "kg" as const };
      case "l":
      case "lt":
        return { value: amount, unit: "l" as const };
      case "cl":
        return { value: amount / 100, unit: "l" as const };
      default:
        return { value: amount / 1000, unit: "l" as const };
    }
  };
  const multi = MULTIPACK.exec(text);
  if (multi) {
    const single = convert(toNumber(multi[2]), multi[3]);
    return { ...single, value: single.value * Number(multi[1]) };
  }
  const size = SIZE.exec(text);
  if (!size) return null;
  const result = size[1]
    ? convert(toNumber(size[1]), size[2])
    : convert(toNumber(size[4]), size[3]);
  return result.value > 0 ? result : null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Acquisti dalle righe degli scontrini. Si scartano le righe senza importo, quelle negative
 * (sconti, cashback: restano nei totali degli scontrini ma non sono prodotti) e i sacchetti.
 */
export function toPurchases(receipts: ReceiptFact[], items: ItemFact[]): Purchase[] {
  const byId = new Map(receipts.map((receipt) => [receipt.id, receipt]));
  const purchases: Purchase[] = [];
  for (const item of items) {
    const receipt = byId.get(item.receiptId);
    if (!receipt || NOT_A_PRODUCT.test(item.description)) continue;
    const normalized = normalizedProduct(item);
    const key = normalized?.key ?? productKey(item.description);
    if (!key) continue;
    const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
    const amount = item.amount ?? (item.unitPrice !== null ? item.unitPrice * quantity : null);
    if (amount === null || amount <= 0) continue;

    const weighed = WEIGHED.exec(item.description);
    let unit: Purchase["unit"] = "pz";
    let unitPrice = item.unitPrice ?? amount / quantity;
    let bought = quantity;
    if (weighed) {
      unit = "kg";
      bought = toNumber(weighed[1]);
      unitPrice = toNumber(weighed[2]);
    } else if (!Number.isInteger(quantity)) {
      // Quantità con decimali: prodotto pesato, il prezzo unitario è al kg.
      unit = "kg";
    }
    if (!(unitPrice > 0)) continue;

    const size =
      unit === "kg"
        ? { value: 1, unit: "kg" as const }
        : (normalized?.size ?? packSize(item.description));
    purchases.push({
      key,
      label: normalized?.label ?? productLabel(item.description),
      typeKey: normalized?.typeKey ?? productType(key),
      receiptId: receipt.id,
      day: toRomeDateInput(new Date(receipt.date)),
      merchant: receipt.merchantName?.trim() || null,
      category: item.category,
      quantity: bought,
      amount: round2(amount),
      unitPrice: round2(unitPrice),
      unit,
      measuredPrice: size ? { value: unitPrice / size.value, unit: size.unit } : null,
    });
  }
  return purchases;
}

const UNIT_LABEL: Record<NonNullable<ItemFact["sizeUnit"]>, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  cl: "cl",
  l: "L",
  pz: "pz",
};

/** Formato letto dal modello in kg, litri o pezzi. */
function sizeOf(size: number | null, unit: ItemFact["sizeUnit"]) {
  if (!size || size <= 0 || !unit) return null;
  switch (unit) {
    case "g":
      return { value: size / 1000, unit: "kg" as const };
    case "kg":
      return { value: size, unit: "kg" as const };
    case "ml":
      return { value: size / 1000, unit: "l" as const };
    case "cl":
      return { value: size / 100, unit: "l" as const };
    case "l":
      return { value: size, unit: "l" as const };
    case "pz":
      return { value: size, unit: "pz" as const };
  }
}

/**
 * Prodotto normalizzato dal modello: stesso nome, marca e formato → stesso prodotto, anche se
 * negozi diversi lo stampano in modo diverso. Null per le righe senza nome normalizzato.
 */
function normalizedProduct(item: ItemFact) {
  const name = item.normalizedName?.trim();
  if (!name) return null;
  const typeKey = productKey(name);
  if (!typeKey) return null;
  const brand = item.brand?.trim() || null;
  const sizeText =
    item.size && item.sizeUnit
      ? `${String(item.size).replace(".", ",")} ${UNIT_LABEL[item.sizeUnit]}`
      : null;
  const label = [name.charAt(0).toUpperCase() + name.slice(1), brand, sizeText]
    .filter(Boolean)
    .join(" · ");
  return {
    key: [typeKey, brand ? productKey(brand) : "", sizeText ? productKey(sizeText) : ""].join("|"),
    label,
    typeKey,
    size: sizeOf(item.size, item.sizeUnit),
  };
}

// ---- statistiche per prodotto ----

export type MerchantPrice = {
  merchant: string;
  /** Prezzo unitario medio pesato sulle quantità. */
  averagePrice: number;
  minPrice: number;
  purchases: number;
};

export type ProductStats = {
  key: string;
  label: string;
  category: Category;
  unit: "pz" | "kg";
  purchases: number;
  /** Giorni diversi in cui è stato comprato. */
  days: number;
  totalSpent: number;
  quantity: number;
  /** Prezzo unitario medio pagato (speso / quantità). */
  averagePrice: number;
  /** Miglior prezzo unitario registrato nel periodo e dove. */
  bestPrice: number;
  bestMerchant: string | null;
  /** Quanto si sarebbe risparmiato pagando sempre `bestPrice`. */
  potentialSaving: number;
  /** Prezzi per esercente (solo esercenti noti), dal più economico. */
  merchants: MerchantPrice[];
  /** Prezzo del primo e dell'ultimo giorno d'acquisto, e variazione %; null con un solo giorno. */
  firstPrice: number;
  lastPrice: number;
  firstDay: string;
  lastDay: string;
  priceChange: number | null;
  /** Tipo di prodotto, per il confronto tra formati e marche. */
  typeKey: string | null;
  /** Prezzo al kg, al litro o al pezzo medio, se il formato è noto. */
  measuredPrice: { value: number; unit: MeasureUnit } | null;
};

const average = (purchases: Purchase[]) => {
  const quantity = purchases.reduce((sum, p) => sum + p.quantity, 0);
  const spent = purchases.reduce((sum, p) => sum + p.unitPrice * p.quantity, 0);
  return quantity > 0 ? spent / quantity : 0;
};

/** Statistiche di ogni prodotto, ordinate per spesa decrescente. */
export function productStats(purchases: Purchase[]): ProductStats[] {
  const groups = new Map<string, Purchase[]>();
  for (const purchase of purchases) {
    groups.set(purchase.key, [...(groups.get(purchase.key) ?? []), purchase]);
  }
  const result: ProductStats[] = [];
  for (const [key, all] of groups) {
    // Prezzi confrontabili solo nella stessa unità: si usa quella più frequente.
    const kgCount = all.filter((p) => p.unit === "kg").length;
    const unit = kgCount > all.length - kgCount ? "kg" : "pz";
    const comparable = all.filter((p) => p.unit === unit);
    const sorted = [...comparable].sort((a, b) => a.day.localeCompare(b.day));
    const best = sorted.reduce((min, p) => (p.unitPrice < min.unitPrice ? p : min), sorted[0]);
    const firstDay = sorted[0].day;
    const lastDay = sorted[sorted.length - 1].day;
    const firstPrice = average(sorted.filter((p) => p.day === firstDay));
    const lastPrice = average(sorted.filter((p) => p.day === lastDay));

    const byMerchant = new Map<string, Purchase[]>();
    for (const p of comparable) {
      if (p.merchant) byMerchant.set(p.merchant, [...(byMerchant.get(p.merchant) ?? []), p]);
    }
    const measured = comparable.filter((p) => p.measuredPrice);

    result.push({
      key,
      label: all[all.length - 1].label,
      typeKey: all[all.length - 1].typeKey,
      category: all[all.length - 1].category,
      unit,
      purchases: all.length,
      days: new Set(all.map((p) => p.day)).size,
      totalSpent: round2(all.reduce((sum, p) => sum + p.amount, 0)),
      quantity: round2(comparable.reduce((sum, p) => sum + p.quantity, 0)),
      averagePrice: round2(average(comparable)),
      bestPrice: best.unitPrice,
      bestMerchant: best.merchant,
      potentialSaving: round2(
        comparable.reduce((sum, p) => sum + (p.unitPrice - best.unitPrice) * p.quantity, 0),
      ),
      merchants: [...byMerchant]
        .map(([merchant, list]) => ({
          merchant,
          averagePrice: round2(average(list)),
          minPrice: Math.min(...list.map((p) => p.unitPrice)),
          purchases: list.length,
        }))
        .sort((a, b) => a.averagePrice - b.averagePrice || a.merchant.localeCompare(b.merchant)),
      firstPrice: round2(firstPrice),
      lastPrice: round2(lastPrice),
      firstDay,
      lastDay,
      priceChange:
        firstDay === lastDay || firstPrice <= 0
          ? null
          : ((lastPrice - firstPrice) / firstPrice) * 100,
      measuredPrice:
        measured.length > 0
          ? {
              value: measured.reduce((sum, p) => sum + p.measuredPrice!.value, 0) / measured.length,
              unit: measured[0].measuredPrice!.unit,
            }
          : null,
    });
  }
  return result.sort((a, b) => b.totalSpent - a.totalSpent || a.label.localeCompare(b.label));
}

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

/** Parole che non identificano il tipo di prodotto. */
const STOPWORDS = new Set([
  "con",
  "per",
  "senza",
  "alla",
  "allo",
  "alle",
  "del",
  "della",
  "dei",
  "bio",
]);

/** Tipo di prodotto: la prima parola significativa della descrizione ("latte", "pasta"). */
export function productType(key: string): string | null {
  for (const word of key.split(" ")) {
    if (word.length >= 4 && /^[a-z]+$/.test(word) && !STOPWORDS.has(word)) return word;
  }
  return null;
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
