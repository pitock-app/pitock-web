/**
 * Lettura delle descrizioni delle righe: chiave ed etichetta del prodotto, formato della
 * confezione, tipo di prodotto. Funzioni pure, senza dipendenze dal resto della dashboard.
 */

// ---- normalizzazione delle descrizioni ----

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
/** "1,468 kg x 2,19 EUR/kg": prodotto a peso con prezzo al kg nella descrizione. */
export const WEIGHED = new RegExp(
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
export const NOT_A_PRODUCT =
  /\b(shopper|sacchett\w*|sacco\.?\s*ortofr\w*|busta|buste)\b|^\s*(articol[oi]|reparto|varie|vari|merce)\b/i;

export const toNumber = (text: string) => Number(text.replace(",", "."));

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
