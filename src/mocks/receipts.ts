import {
  aiProviders,
  categories,
  mimeTypes,
  paymentMethods,
  receiptSources,
  receiptStatuses,
} from "@/lib/api/enums";
import type { components } from "@/lib/api/schema";
import { decodeCursor, encodeCursor } from "./cursor";
import { parseInstant } from "./dates";
import { advance, ownerReceipts, toListItem, toReceiptItems, type MockReceipt } from "./db";

type Schemas = components["schemas"];

const includes = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

export type ListQuery = {
  cursor?: string;
  limit: number;
  from?: number;
  /** Fine dell'intervallo: esclusiva con la sola data (giornata intera), altrimenti compresa. */
  to?: { at: number; exclusive: boolean };
  status?: Schemas["ReceiptStatus"];
  category?: Schemas["Category"];
  source?: Schemas["ReceiptSource"];
  q?: string;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function nextDay(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/** Query di `GET /v1/receipts` validata come nel contratto; null se non è valida. */
export function parseListQuery(params: URLSearchParams): ListQuery | null {
  const get = (name: string) => params.get(name) ?? undefined;
  const limitText = get("limit");
  const limit = limitText === undefined ? 20 : Number(limitText);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return null;

  const query: ListQuery = { limit };
  const cursor = get("cursor");
  if (cursor !== undefined) {
    if (!decodeCursor(cursor)) return null;
    query.cursor = cursor;
  }
  const from = get("from");
  if (from !== undefined) {
    const at = parseInstant(from);
    if (at === null) return null;
    query.from = at;
  }
  const to = get("to");
  if (to !== undefined) {
    if (DATE_ONLY.test(to)) {
      const at = parseInstant(to) === null ? null : parseInstant(nextDay(to));
      if (at === null) return null;
      query.to = { at, exclusive: true };
    } else {
      const at = parseInstant(to);
      if (at === null) return null;
      query.to = { at, exclusive: false };
    }
  }
  for (const [name, list] of [
    ["status", receiptStatuses],
    ["category", categories],
    ["source", receiptSources],
  ] as const) {
    const value = get(name);
    if (value === undefined) continue;
    if (!includes(list, value)) return null;
    Object.assign(query, { [name]: value });
  }
  const q = get("q")?.trim();
  if (q !== undefined) {
    if (!q || q.length > 100) return null;
    query.q = q;
  }
  return query;
}

/** Ordine del backend: dal più recente (createdAt, poi id, decrescenti). */
function compare(a: MockReceipt, b: MockReceipt): number {
  const byDate = b.receipt.createdAt.localeCompare(a.receipt.createdAt);
  return byDate !== 0 ? byDate : b.receipt.id.localeCompare(a.receipt.id);
}

function matches(entry: MockReceipt, query: ListQuery): boolean {
  const { receipt, extraction } = entry;
  if (query.status && receipt.status !== query.status) return false;
  if (query.source && receipt.source !== query.source) return false;
  if (query.category && extraction?.category !== query.category) return false;
  // Come il backend: data d'acquisto, oppure di caricamento se manca.
  const when = Date.parse(extraction?.purchasedAt ?? receipt.createdAt);
  if (query.from !== undefined && when < query.from) return false;
  if (query.to && (query.to.exclusive ? when >= query.to.at : when > query.to.at)) return false;
  if (query.q) {
    const needle = query.q.toLowerCase();
    const haystack = [extraction?.merchantName, receipt.originalFilename];
    if (!haystack.some((text) => text?.toLowerCase().includes(needle))) return false;
  }
  return true;
}

export function listReceipts(owner: string, query: ListQuery): Schemas["ReceiptList"] {
  const entries = ownerReceipts(owner);
  entries.forEach((entry) => advance(entry));
  let sorted = entries.filter((entry) => matches(entry, query)).sort(compare);
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  if (cursor) {
    sorted = sorted.filter(
      ({ receipt }) =>
        receipt.createdAt < cursor.createdAt ||
        (receipt.createdAt === cursor.createdAt && receipt.id < cursor.id),
    );
  }
  const page = sorted.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: page.map(toListItem),
    nextCursor:
      sorted.length > query.limit && last
        ? encodeCursor({ createdAt: last.receipt.createdAt, id: last.receipt.id })
        : null,
  };
}

// ---- correzione e rielaborazione ----

type ExtractionPatch = Partial<
  Omit<Schemas["ExtractionDetail"], "items"> & { items: Schemas["ReceiptItem"][] }
>;

/** Limiti del contratto (`ExtractionPatch`). */
const MAX_AMOUNT = 9999999999.99;
const MAX_QUANTITY = 9999999;

/** Testo come nel backend: senza spazi ai lati, tra 1 e `max` caratteri. */
const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length >= 1 && value.trim().length <= max;
const isNullableText = (value: unknown, max: number) => value === null || isText(value, max);
const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const isNullableAmount = (value: unknown) =>
  value === null || inRange(value, -MAX_AMOUNT, MAX_AMOUNT);
const optional = (value: unknown, check: (v: unknown) => boolean) =>
  value === undefined || check(value);

function isItem(value: unknown): value is NonNullable<Schemas["ExtractionPatch"]["items"]>[number] {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isText(item.description, 500) &&
    optional(item.quantity, (v) => inRange(v, -MAX_QUANTITY, MAX_QUANTITY)) &&
    optional(item.unitPrice, (v) => inRange(v, -MAX_AMOUNT, MAX_AMOUNT)) &&
    optional(item.amount, (v) => inRange(v, -MAX_AMOUNT, MAX_AMOUNT)) &&
    optional(item.vatRate, (v) => inRange(v, 0, 100)) &&
    (item.category === undefined || includes(categories, item.category))
  );
}

/**
 * Corpo di `PATCH /v1/extractions/{id}` validato come `ExtractionPatch`,
 * già convertito nei campi dell'estrazione. Null se non è valido o è vuoto.
 */
export function parseExtractionPatch(body: Record<string, unknown> | null): ExtractionPatch | null {
  if (!body || Object.keys(body).length === 0) return null;
  const patch: ExtractionPatch = {};
  for (const [key, value] of Object.entries(body)) {
    switch (key) {
      case "merchantName":
      case "merchantAddress":
      case "merchantVat": {
        const max = key === "merchantName" ? 200 : key === "merchantVat" ? 32 : 500;
        if (!isNullableText(value, max)) return null;
        patch[key] = typeof value === "string" ? value.trim() : null;
        break;
      }
      case "notes":
        if (!(value === null || (typeof value === "string" && value.length <= 2000))) return null;
        patch.notes = value as string | null;
        break;
      case "purchasedAt": {
        if (value === null) {
          patch.purchasedAt = null;
          break;
        }
        if (typeof value !== "string") return null;
        const at = parseInstant(value);
        if (at === null) return null;
        patch.purchasedAt = new Date(at).toISOString();
        break;
      }
      case "currency":
        if (typeof value !== "string" || !/^[A-Za-z]{3}$/.test(value)) return null;
        patch.currency = value.toUpperCase();
        break;
      case "total":
      case "taxTotal":
        if (!isNullableAmount(value)) return null;
        patch[key] = value as number | null;
        break;
      case "paymentMethod":
        if (value !== null && !includes(paymentMethods, value)) return null;
        patch.paymentMethod = value as Schemas["PaymentMethod"] | null;
        break;
      case "category":
        if (value !== null && !includes(categories, value)) return null;
        patch.category = value as Schemas["Category"] | null;
        break;
      case "items":
        if (!Array.isArray(value) || value.length > 500 || !value.every(isItem)) return null;
        patch.items = toReceiptItems(
          value.map((item) => ({ ...item, description: item.description.trim() })),
        );
        break;
      default:
        // Campo sconosciuto: il backend lo ignorerebbe; qui lo rifiutiamo per scoprire errori.
        return null;
    }
  }
  return patch;
}

/** Corpo di `POST /v1/receipts/{id}/reextract` (`ReextractInput`); null se non è valido. */
export function parseReextractInput(
  body: Record<string, unknown> | null,
): MockReceipt["reextract"] | null {
  if (!body) return null;
  const { provider, model, ...rest } = body;
  if (Object.keys(rest).length > 0) return null;
  if (provider !== undefined && !includes(aiProviders, provider)) return null;
  if (
    model !== undefined &&
    (typeof model !== "string" || model.trim().length < 1 || model.length > 200)
  ) {
    return null;
  }
  return {
    ...(provider !== undefined ? { provider } : {}),
    ...(model !== undefined ? { model: model.trim() } : {}),
  };
}

// ---- inserimento ----

/**
 * Corpo di `POST /v1/receipts/manual` validato come `ManualReceiptInput` del backend
 * (testi ripuliti dagli spazi, data in ISO, valuta maiuscola). Null se non è valido.
 */
export function parseManualInput(
  body: Record<string, unknown> | null,
): Schemas["ManualReceiptInput"] | null {
  if (!body) return null;
  const { merchantName, merchantVat, purchasedAt, currency, total, taxTotal, notes, items } = body;
  if (!isText(merchantName, 200)) return null;
  if (!optional(merchantVat, (v) => isText(v, 32))) return null;
  const at = typeof purchasedAt === "string" ? parseInstant(purchasedAt) : null;
  if (at === null) return null;
  if (!optional(currency, (v) => typeof v === "string" && /^[A-Za-z]{3}$/.test(v))) return null;
  if (!inRange(total, -MAX_AMOUNT, MAX_AMOUNT)) return null;
  if (!optional(taxTotal, (v) => inRange(v, -MAX_AMOUNT, MAX_AMOUNT))) return null;
  if (!includes(paymentMethods, body.paymentMethod) || !includes(categories, body.category)) {
    return null;
  }
  if (!optional(notes, (v) => typeof v === "string" && v.length <= 2000)) return null;
  if (!optional(items, (v) => Array.isArray(v) && v.length <= 500 && v.every(isItem))) {
    return null;
  }
  return {
    merchantName: merchantName.trim(),
    ...(typeof merchantVat === "string" ? { merchantVat: merchantVat.trim() } : {}),
    purchasedAt: new Date(at).toISOString(),
    ...(typeof currency === "string" ? { currency: currency.toUpperCase() } : {}),
    total,
    ...(typeof taxTotal === "number" ? { taxTotal } : {}),
    paymentMethod: body.paymentMethod,
    category: body.category,
    ...(typeof notes === "string" ? { notes } : {}),
    ...(Array.isArray(items)
      ? {
          items: (items as NonNullable<Schemas["ManualReceiptInput"]["items"]>).map((item) => ({
            ...item,
            description: item.description.trim(),
          })),
        }
      : {}),
  };
}

/** Corpo di `POST /v1/receipts/upload-url` validato come `UploadUrlInput`; null se non è valido. */
export function parseUploadUrlInput(
  body: Record<string, unknown> | null,
): Schemas["UploadUrlInput"] | null {
  if (!body) return null;
  const { source, sha256, mimeType, sizeBytes, capturedAt, originalFilename } = body;
  if (source !== "camera" && source !== "file") return null;
  if (typeof sha256 !== "string" || !/^[A-Fa-f0-9]{64}$/.test(sha256)) return null;
  if (!includes(mimeTypes, mimeType)) return null;
  if (typeof sizeBytes !== "number" || !Number.isInteger(sizeBytes) || sizeBytes <= 0) return null;
  const capturedAtMs = typeof capturedAt === "string" ? parseInstant(capturedAt) : null;
  if (capturedAt !== undefined && capturedAtMs === null) return null;
  if (!optional(originalFilename, (v) => isText(v, 255))) return null;
  return {
    source,
    sha256: sha256.toLowerCase(),
    mimeType,
    sizeBytes,
    ...(capturedAtMs !== null ? { capturedAt: new Date(capturedAtMs).toISOString() } : {}),
    ...(typeof originalFilename === "string" ? { originalFilename: originalFilename.trim() } : {}),
  };
}
