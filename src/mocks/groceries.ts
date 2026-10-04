import type { components } from "@/lib/api/schema";

type ManualReceiptInput = components["schemas"]["ManualReceiptInput"];

/**
 * Spesa di esempio per la dashboard per prodotto: tre supermercati con prezzi diversi per gli
 * stessi prodotti, formati diversi dello stesso tipo, rincari nel tempo e un abbonamento mensile.
 * Le descrizioni sono uguali tra negozi: nei dati reali spesso non lo sono.
 */
const STORES = [
  { name: "Esselunga", factor: 1 },
  { name: "Lidl", factor: 0.86 },
  { name: "Coop", factor: 0.95 },
] as const;

type Product = {
  description: string;
  price: number;
  /** Variazione del prezzo al mese (0,01 = +1% al mese). */
  drift: number;
  category: components["schemas"]["Category"];
  /** Prodotto a peso: prezzo al kg e quantità in kg. */
  weighed?: boolean;
};

const PRODUCTS: Product[] = [
  { description: "LATTE INTERO 1L", price: 1.49, drift: 0.012, category: "alimentari" },
  { description: "LATTE INTERO 0,5L", price: 0.89, drift: 0.01, category: "alimentari" },
  { description: "PASTA PENNE RIGATE 500G", price: 0.95, drift: 0, category: "alimentari" },
  { description: "PASTA PENNE RIGATE 1KG", price: 1.69, drift: 0, category: "alimentari" },
  { description: "CAFFE MACINATO 250G", price: 3.99, drift: 0.02, category: "alimentari" },
  { description: "CAFFE MACINATO 500G", price: 6.99, drift: 0.015, category: "alimentari" },
  { description: "PARMIGIANO GRATTUGIATO 100G", price: 2.29, drift: 0.005, category: "alimentari" },
  { description: "UOVA FRESCHE 6X60G", price: 2.49, drift: 0.01, category: "alimentari" },
  { description: "OLIO EXTRAVERGINE 1L", price: 8.9, drift: 0.025, category: "alimentari" },
  { description: "YOGURT BIANCO 500G", price: 1.39, drift: -0.01, category: "alimentari" },
  { description: "BANANE", price: 1.79, drift: 0, category: "alimentari", weighed: true },
  { description: "MELE GOLDEN", price: 2.2, drift: 0.008, category: "alimentari", weighed: true },
  { description: "CARTA IGIENICA 4 ROTOLI", price: 2.99, drift: 0, category: "casa" },
  { description: "DETERSIVO PIATTI 1L", price: 1.89, drift: 0.01, category: "casa" },
];

/** Giorni del mese delle visite al supermercato. */
const VISIT_DAYS = [4, 13, 22];
/** Mesi di spesa di esempio prima di quello in corso. */
const MONTHS = 6;

function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const pad = (value: number) => String(value).padStart(2, "0");

/** Scontrini di spesa dal mese di 6 mesi fa a oggi, con `createdAt` uguale all'acquisto. */
export function groceryReceipts(
  owner: string,
  now: number,
): { input: ManualReceiptInput; createdAt: string }[] {
  const today = new Date(now);
  const receipts: { input: ManualReceiptInput; createdAt: string }[] = [];
  let visit = 0;
  for (let monthsAgo = MONTHS; monthsAgo >= 0; monthsAgo -= 1) {
    const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo, 1));
    const prefix = `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}`;
    const elapsed = MONTHS - monthsAgo;

    // Abbonamento in palestra l'8 di ogni mese: una spesa ricorrente per la previsione.
    const gymDay = `${prefix}-08T18:00:00.000Z`;
    if (Date.parse(gymDay) <= now) {
      receipts.push({
        createdAt: gymDay,
        input: {
          merchantName: "Palestra FitLife",
          purchasedAt: gymDay,
          total: 39.9,
          category: "svago",
          paymentMethod: "carta",
          items: [
            { description: "ABBONAMENTO MENSILE", quantity: 1, unitPrice: 39.9, amount: 39.9 },
          ],
        },
      });
    }

    for (const day of VISIT_DAYS) {
      const at = `${prefix}-${pad(day)}T09:30:00.000Z`;
      if (Date.parse(at) > now) continue;
      const store = STORES[visit % STORES.length];
      visit += 1;
      const items = PRODUCTS.filter(
        (product) => hash(`${owner}|${at}|${product.description}`) % 100 < 45,
      ).map((product) => {
        const unitPrice = round(product.price * store.factor * (1 + product.drift * elapsed), 2);
        const quantity = product.weighed
          ? round(0.6 + (hash(`${at}|${product.description}|kg`) % 900) / 1000, 3)
          : 1 + (hash(`${at}|${product.description}|n`) % 4 === 0 ? 1 : 0);
        return {
          description: product.description,
          quantity,
          unitPrice,
          amount: round(unitPrice * quantity, 2),
          category: product.category,
        };
      });
      if (items.length === 0) continue;
      receipts.push({
        createdAt: at,
        input: {
          merchantName: store.name,
          purchasedAt: at,
          total: round(
            items.reduce((sum, item) => sum + item.amount, 0),
            2,
          ),
          category: "alimentari",
          paymentMethod: "bancomat",
          items,
        },
      });
    }
  }
  return receipts;
}
