import type { components } from "@/lib/api/schema";
import { toRomeDateInput } from "@/lib/format";
import {
  NOT_A_PRODUCT,
  packSize,
  productKey,
  productLabel,
  productType,
  toNumber,
  WEIGHED,
} from "./product-text";

type Schemas = components["schemas"];
export type Category = Schemas["Category"];
export type ReceiptFact = Schemas["StatsReceiptFact"];
export type ItemFact = Schemas["StatsItemFact"];
export type Avoidability = Schemas["Avoidability"];

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

export const round2 = (value: number) => Math.round(value * 100) / 100;

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
    let bought = quantity;
    if (weighed) {
      unit = "kg";
      bought = toNumber(weighed[1]);
    } else if (!Number.isInteger(quantity)) {
      // Quantità con decimali: prodotto pesato, il prezzo unitario è al kg.
      unit = "kg";
    }
    // Dall'importo pagato, già al netto degli sconti: il prezzo stampato è quello pieno.
    const unitPrice = round2(amount / bought);
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
      unitPrice,
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

export const average = (purchases: Purchase[]) => {
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
