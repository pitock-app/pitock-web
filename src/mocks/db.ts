import type { components } from "@/lib/api/schema";
import { MOCK_USER_ID } from "@/lib/auth/mock-session";
import { forgetMockFile, mockFileUrl, resetMockFiles } from "@/lib/storage/mock-files";
import {
  forgetMockSettings,
  getMockSettings,
  hasMockApiKey,
  PLATFORM_MODEL,
  PLATFORM_MONTHLY_LIMIT,
  PLATFORM_PROVIDER,
  resetMockSettings,
  type Provider,
} from "./settings";
import {
  countMockPlatformCalls,
  detachMockUsageReceipt,
  forgetMockUsage,
  recordMockUsage,
  resetMockUsage,
} from "./usage";

type Schemas = components["schemas"];
type Extraction = Schemas["ExtractionDetail"];
type UsageCall = Schemas["UsageCall"];

/** Tempi dell'elaborazione finta: "processing" dopo `startMs`, finita dopo `doneMs`. */
const DEFAULT_TIMING = { startMs: 500, doneMs: 2500 };
export const mockTiming = { ...DEFAULT_TIMING };

/**
 * Nomi di file che simulano gli esiti del backend, per provare gli errori:
 * - "non-scontrino": il modello risponde, ma non è uno scontrino (`NOT_A_RECEIPT`);
 * - "chiave-non-valida": il provider rifiuta la chiave (`USER_KEY_INVALID` con la chiave
 *   dell'utente, `LLM_UNAVAILABLE` con quella della piattaforma; con il fallback si riprova
 *   sulla piattaforma);
 * - "quota-esaurita": quota della piattaforma finita, nessuna chiamata al modello.
 */
const NOT_A_RECEIPT_FILE = /non-scontrino/i;
const KEY_REJECTED_FILE = /chiave-non-valida/i;
const QUOTA_EXCEEDED_FILE = /quota-esaurita/i;

export type MockReceipt = {
  owner: string;
  receipt: Schemas["Receipt"];
  /** Estrazione corrente (anche il primo elemento di `history`). */
  extraction?: Extraction;
  /** Tutte le estrazioni, dalla più recente. */
  history: Extraction[];
  /** Percorso del file su Storage (scontrini con file). */
  path?: string;
  /** File di esempio da mostrare se il file vero non è in memoria (scontrini di esempio). */
  sampleFile?: "image" | "pdf";
  /** Esercente fisso per gli scontrini di esempio (indice in SAMPLE_MERCHANTS). */
  sampleMerchant?: number;
  /** Provider e modello chiesti dall'ultima rielaborazione. */
  reextract?: { provider?: Provider; model?: string };
  completedAt?: number;
};

const receipts = new Map<string, MockReceipt>();
const seededOwners = new Set<string>();
/** Chiamata riuscita che ha prodotto ciascuna estrazione (`llm_usage.extraction_id`). */
const usageByExtraction = new Map<string, UsageCall>();

export { PLATFORM_PROVIDER };

export function resetMockDb() {
  receipts.clear();
  seededOwners.clear();
  usageByExtraction.clear();
  resetMockSettings();
  resetMockUsage();
  resetMockFiles();
  Object.assign(mockTiming, DEFAULT_TIMING);
}

/** Cancella scontrini, file, impostazioni e consumo dell'utente (`DELETE /v1/account`). */
export function deleteOwnerData(owner: string) {
  for (const entry of [...receipts.values()]) {
    if (entry.owner === owner) deleteReceipt(entry.receipt.id);
  }
  // Un nuovo account con la stessa email riparte dagli scontrini di esempio.
  seededOwners.delete(owner);
  forgetMockSettings(owner);
  forgetMockUsage(owner);
}

export function findReceipt(owner: string, id: string): MockReceipt | undefined {
  const entry = receipts.get(id);
  return entry && entry.owner === owner ? entry : undefined;
}

export function findBySha256(owner: string, sha256: string): MockReceipt | undefined {
  for (const entry of receipts.values()) {
    if (entry.owner === owner && entry.receipt.sha256 === sha256) return entry;
  }
  return undefined;
}

/** Scontrino che contiene l'estrazione indicata, tra quelli dell'utente. */
export function findByExtraction(
  owner: string,
  extractionId: string,
): { entry: MockReceipt; extraction: Extraction } | undefined {
  for (const entry of ownerReceipts(owner)) {
    const extraction = entry.history.find((item) => item.id === extractionId);
    if (extraction) return { entry, extraction };
  }
  return undefined;
}

export function deleteReceipt(id: string) {
  const entry = receipts.get(id);
  if (entry?.path) forgetMockFile(entry.path);
  if (entry) detachMockUsageReceipt(entry.owner, id);
  entry?.history.forEach((extraction) => usageByExtraction.delete(extraction.id));
  receipts.delete(id);
}

/** Scontrini dell'utente (con quelli di esempio alla prima richiesta). */
export function ownerReceipts(owner: string): MockReceipt[] {
  ensureSeeded(owner);
  return [...receipts.values()].filter((entry) => entry.owner === owner);
}

const EXTENSION: Record<Schemas["MimeType"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function createPendingReceipt(owner: string, input: Schemas["UploadUrlInput"]) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const path = `${MOCK_USER_ID}/${id}.${EXTENSION[input.mimeType]}`;
  const entry: MockReceipt = {
    owner,
    path,
    history: [],
    receipt: {
      id,
      source: input.source,
      status: "pending_upload",
      originalFilename: input.originalFilename ?? null,
      sha256: input.sha256,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      capturedAt: input.capturedAt ?? null,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
    },
  };
  receipts.set(id, entry);
  return { entry, path };
}

const SAMPLE_MERCHANTS: {
  name: string;
  category: Schemas["Category"];
  payment: Schemas["PaymentMethod"];
}[] = [
  { name: "Esselunga", category: "alimentari", payment: "bancomat" },
  { name: "Bar Centrale", category: "ristorazione", payment: "contanti" },
  { name: "Farmacia San Carlo", category: "salute", payment: "carta" },
  { name: "Eni Station", category: "carburante", payment: "carta" },
  { name: "Libreria Coop", category: "svago", payment: "bancomat" },
  { name: "Trenitalia", category: "trasporti", payment: "carta" },
  { name: "Leroy Merlin", category: "casa", payment: "bancomat" },
  { name: "Zara", category: "abbigliamento", payment: "carta" },
  { name: "MediaWorld", category: "tecnologia", payment: "carta" },
  { name: "Enel Energia", category: "servizi", payment: "altro" },
];

function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

type AiConfig = { provider: Provider; model: string; keySource: "platform" | "user" };
type AiPlan = AiConfig | { errorCode: string };

const PLATFORM_CONFIG: AiConfig = {
  provider: PLATFORM_PROVIDER,
  model: PLATFORM_MODEL,
  keySource: "platform",
};

function platformPlan(owner: string): AiPlan {
  return countMockPlatformCalls(owner) >= PLATFORM_MONTHLY_LIMIT
    ? { errorCode: "PLATFORM_QUOTA_EXCEEDED" }
    : PLATFORM_CONFIG;
}

/**
 * Come `resolveAiConfig` del backend: con `platform` (e senza override verso un altro
 * provider) si usa la piattaforma, che ignora l'override del modello; con `byok`, o con un
 * altro provider, servono la chiave dell'utente e un modello (altrimenti, con il fallback
 * attivo, si torna alla piattaforma).
 */
function resolveAiPlan(entry: MockReceipt): AiPlan {
  const settings = getMockSettings(entry.owner);
  const byok = settings.mode === "byok";
  const override = entry.reextract ?? {};
  const provider =
    override.provider ?? (byok && settings.provider ? settings.provider : PLATFORM_PROVIDER);
  if (!byok && provider === PLATFORM_PROVIDER) return platformPlan(entry.owner);
  const model = override.model ?? (settings.provider === provider ? settings.model : null);
  const hasKey = hasMockApiKey(entry.owner, provider);
  if (!hasKey || !model) {
    if (settings.fallbackToPlatform) return platformPlan(entry.owner);
    return { errorCode: hasKey ? "AI_NOT_CONFIGURED" : "USER_KEY_MISSING" };
  }
  return { provider, model, keySource: "user" };
}

function fakeExtraction(
  entry: MockReceipt,
  attempt: number,
  plan: AiConfig = PLATFORM_CONFIG,
): Extraction {
  const seed = hash(entry.receipt.id);
  const sample = SAMPLE_MERCHANTS[entry.sampleMerchant ?? seed % SAMPLE_MERCHANTS.length];
  const total = Math.round((seed % 9000) + 150 + attempt * 7) / 100;
  return {
    id: crypto.randomUUID(),
    receiptId: entry.receipt.id,
    method: "llm",
    provider: plan.provider,
    model: plan.model,
    keySource: plan.keySource,
    promptVersion: "v1",
    merchantName: sample.name,
    merchantVat: null,
    merchantAddress: null,
    purchasedAt: entry.receipt.capturedAt ?? entry.receipt.createdAt,
    currency: "EUR",
    total,
    taxTotal: Math.round(total * 18) / 100,
    paymentMethod: sample.payment,
    category: sample.category,
    confidence: 0.92,
    notes: null,
    isCurrent: true,
    editedByUser: false,
    createdAt: new Date().toISOString(),
    items: [],
  };
}

/** Rende corrente una nuova estrazione; le precedenti restano nello storico. */
export function addExtraction(entry: MockReceipt, extraction: Extraction) {
  entry.history = [
    extraction,
    ...entry.history.map((item) => (item.isCurrent ? { ...item, isCurrent: false } : item)),
  ];
  entry.extraction = extraction;
}

/** Sostituisce un'estrazione (es. dopo una correzione) mantenendo lo storico coerente. */
export function replaceExtraction(entry: MockReceipt, extraction: Extraction) {
  entry.history = entry.history.map((item) => (item.id === extraction.id ? extraction : item));
  if (entry.extraction?.id === extraction.id) entry.extraction = extraction;
}

/** Fa avanzare l'elaborazione finta in base al tempo trascorso dal completamento. */
export function advance(entry: MockReceipt, now = Date.now()) {
  const { receipt } = entry;
  if (entry.completedAt === undefined) return;
  if (receipt.status !== "uploaded" && receipt.status !== "processing") return;
  const elapsed = now - entry.completedAt;
  const updatedAt = new Date(now).toISOString();
  if (elapsed >= mockTiming.doneMs) {
    const filename = receipt.originalFilename ?? "";
    const operation = entry.history.length > 0 ? "reextract" : "extract";
    const call = (config: AiConfig, success: boolean, errorCode?: string) =>
      recordMockUsage(entry.owner, {
        ...config,
        operation,
        success,
        ...(errorCode ? { errorCode } : {}),
        receiptId: receipt.id,
        createdAt: updatedAt,
      });
    const fail = (errorCode: string) => {
      entry.receipt = { ...receipt, status: "failed", errorCode, updatedAt };
    };
    let plan = QUOTA_EXCEEDED_FILE.test(filename)
      ? { errorCode: "PLATFORM_QUOTA_EXCEEDED" }
      : resolveAiPlan(entry);
    if (!("errorCode" in plan) && KEY_REJECTED_FILE.test(filename)) {
      // Come il backend: solo un errore della chiave dell'utente può ripiegare sulla piattaforma.
      const user = plan.keySource === "user";
      call(plan, false, user ? "USER_KEY_INVALID" : "LLM_UNAVAILABLE");
      plan =
        user && getMockSettings(entry.owner).fallbackToPlatform
          ? platformPlan(entry.owner)
          : { errorCode: user ? "USER_KEY_INVALID" : "LLM_UNAVAILABLE" };
    }
    if ("errorCode" in plan) {
      // Nessuna estrazione nuova. Come il backend: l'estrazione corrente resta com'è.
      fail(plan.errorCode);
    } else if (NOT_A_RECEIPT_FILE.test(filename)) {
      // La chiamata riesce: è il controllo successivo a scartare il documento.
      call(plan, true);
      fail("NOT_A_RECEIPT");
    } else {
      const extraction = fakeExtraction(entry, entry.history.length, plan);
      usageByExtraction.set(extraction.id, call(plan, true));
      addExtraction(entry, extraction);
      entry.receipt = { ...receipt, status: "extracted", errorCode: null, updatedAt };
    }
    entry.reextract = undefined;
  } else if (elapsed >= mockTiming.startMs && receipt.status === "uploaded") {
    entry.receipt = { ...receipt, status: "processing", updatedAt };
  }
}

export function markUploaded(entry: MockReceipt, now = Date.now()) {
  entry.completedAt = now;
  entry.receipt = { ...entry.receipt, status: "uploaded", errorCode: null };
}

const SAMPLE_FILES = {
  image: "/mock/scontrino-esempio.svg",
  pdf: "/mock/scontrino-esempio.pdf",
};

function sampleUrl(kind: "image" | "pdf"): string {
  const origin = globalThis.location?.origin ?? "http://localhost";
  return new URL(SAMPLE_FILES[kind], origin).toString();
}

/** URL del file come quello firmato del backend: assente finché il caricamento non è completo. */
export function fileUrlOf(entry: MockReceipt): string | undefined {
  if (!entry.path || entry.receipt.status === "pending_upload") return undefined;
  const uploaded = mockFileUrl(entry.path);
  if (uploaded) return uploaded;
  if (entry.sampleFile) return sampleUrl(entry.sampleFile);
  return sampleUrl(entry.receipt.mimeType === "application/pdf" ? "pdf" : "image");
}

/** Come `findForExtraction` del backend: la chiamata riuscita che ha prodotto l'estrazione. */
function usageOf(extraction: Extraction): Pick<Schemas["ReceiptDetail"], "usage"> {
  const call = usageByExtraction.get(extraction.id);
  if (!call) return {};
  const { provider, model, totalTokens, costUsd } = call;
  return { usage: { provider, model, totalTokens, costUsd } };
}

export function toDetail(entry: MockReceipt): Schemas["ReceiptDetail"] {
  const fileUrl = fileUrlOf(entry);
  return {
    receipt: entry.receipt,
    ...(fileUrl ? { fileUrl } : {}),
    ...(entry.extraction
      ? {
          extraction: entry.extraction,
          ...usageOf(entry.extraction),
        }
      : {}),
    items: entry.extraction?.items ?? [],
  };
}

export function toListItem(entry: MockReceipt): Schemas["ReceiptListItem"] {
  const { receipt, extraction } = entry;
  // Come il backend attuale: niente `thumbnailUrl` (facoltativo nel contratto).
  return {
    id: receipt.id,
    source: receipt.source,
    status: receipt.status,
    merchantName: extraction?.merchantName ?? null,
    purchasedAt: extraction?.purchasedAt ?? null,
    total: extraction?.total ?? null,
    currency: extraction?.currency ?? null,
    category: extraction?.category ?? null,
    createdAt: receipt.createdAt,
  };
}

/** Arrotonda come le colonne `numeric` del backend; null se assente. */
function roundTo(value: number | null | undefined, decimals: number): number | null {
  if (value === null || value === undefined) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toItems(items: Schemas["ManualReceiptInput"]["items"]): Schemas["ReceiptItem"][] {
  return (items ?? []).map((item, index) => ({
    id: crypto.randomUUID(),
    position: index,
    description: item.description,
    quantity: roundTo(item.quantity, 3),
    unitPrice: roundTo(item.unitPrice, 2),
    amount: roundTo(item.amount, 2),
    vatRate: roundTo(item.vatRate, 2),
    category: item.category ?? null,
  }));
}

/** Righe nel formato della risposta, a partire da quelle inviate dal client. */
export { toItems as toReceiptItems };

export function createManualReceipt(
  owner: string,
  input: Schemas["ManualReceiptInput"],
  createdAt = new Date().toISOString(),
) {
  const id = crypto.randomUUID();
  const extraction: Extraction = {
    id: crypto.randomUUID(),
    receiptId: id,
    method: "manual",
    provider: null,
    model: null,
    keySource: null,
    promptVersion: null,
    merchantName: input.merchantName,
    merchantVat: input.merchantVat ?? null,
    merchantAddress: null,
    purchasedAt: new Date(input.purchasedAt).toISOString(),
    currency: (input.currency ?? "EUR").toUpperCase(),
    total: input.total,
    taxTotal: input.taxTotal ?? null,
    paymentMethod: input.paymentMethod,
    category: input.category,
    confidence: null,
    notes: input.notes ?? null,
    isCurrent: true,
    editedByUser: false,
    createdAt,
    items: toItems(input.items),
  };
  const entry: MockReceipt = {
    owner,
    history: [extraction],
    extraction,
    receipt: {
      id,
      source: "manual",
      status: "extracted",
      originalFilename: null,
      sha256: null,
      mimeType: null,
      sizeBytes: null,
      capturedAt: null,
      errorCode: null,
      createdAt,
      updatedAt: createdAt,
    },
  };
  receipts.set(id, entry);
  return entry;
}

// ---- scontrini di esempio ----

/** Numero di scontrini di esempio per utente: più di una pagina (20). */
export const SEED_COUNT = 30;
const DAY_MS = 86_400_000;

/** Le email che iniziano con "vuoto" non hanno scontrini di esempio (per provare lo stato vuoto). */
function wantsSeed(owner: string) {
  return !/^vuoto/i.test(owner);
}

function ensureSeeded(owner: string, now = Date.now()) {
  if (seededOwners.has(owner)) return;
  seededOwners.add(owner);
  if (!wantsSeed(owner)) return;
  // Dal più vecchio al più recente, distribuiti su circa 13 mesi.
  for (let index = SEED_COUNT - 1; index >= 0; index -= 1) {
    seedReceipt(owner, index, now);
  }
}

const sha = (owner: string, index: number) =>
  Array.from({ length: 8 }, (_, part) => hash(`${owner}:${index}:${part}`).toString(16))
    .join("")
    .padEnd(64, "0")
    .slice(0, 64);

function seedReceipt(owner: string, index: number, now: number) {
  const sample = SAMPLE_MERCHANTS[index % SAMPLE_MERCHANTS.length];
  const createdAt = new Date(now - index * 13 * DAY_MS - (index % 5) * 3_600_000);
  const purchasedAt = new Date(createdAt.getTime() - 2 * 3_600_000).toISOString();
  const total = Math.round(((index * 937) % 9000) + 250) / 100;
  const items =
    index % 4 === 1
      ? [
          { description: "Articolo 1", quantity: 1, unitPrice: total - 1, amount: total - 1 },
          { description: "Articolo 2", quantity: 2, unitPrice: 0.5, amount: 1, vatRate: 22 },
        ]
      : undefined;
  const source = (["camera", "file", "manual"] as const)[index % 3];

  if (source === "manual") {
    createManualReceipt(
      owner,
      {
        merchantName: sample.name,
        purchasedAt,
        total,
        currency: "EUR",
        category: sample.category,
        paymentMethod: sample.payment,
        ...(items ? { items } : {}),
      },
      createdAt.toISOString(),
    );
    return;
  }

  const isPdf = source === "file" && index % 2 === 0;
  const mimeType: Schemas["MimeType"] = isPdf ? "application/pdf" : "image/jpeg";
  const { entry } = createPendingReceipt(owner, {
    source,
    sha256: sha(owner, index),
    mimeType,
    sizeBytes: 180_000 + index * 1000,
    ...(source === "file"
      ? { originalFilename: `scontrino-${index + 1}.${isPdf ? "pdf" : "jpg"}` }
      : {}),
  });
  entry.sampleFile = isPdf ? "pdf" : "image";
  entry.sampleMerchant = index % SAMPLE_MERCHANTS.length;
  entry.receipt = {
    ...entry.receipt,
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
  };

  if (index === 0) {
    // Il più recente è ancora in elaborazione: la lista si aggiorna da sola.
    markUploaded(entry, now);
    return;
  }
  if (index === 4) {
    entry.receipt = { ...entry.receipt, status: "failed", errorCode: "NOT_A_RECEIPT" };
    recordMockUsage(owner, {
      ...PLATFORM_CONFIG,
      operation: "extract",
      success: true,
      receiptId: entry.receipt.id,
      createdAt: createdAt.toISOString(),
    });
    return;
  }
  entry.receipt = { ...entry.receipt, status: "extracted" };
  const usage = recordMockUsage(owner, {
    ...PLATFORM_CONFIG,
    operation: "extract",
    success: true,
    receiptId: entry.receipt.id,
    createdAt: createdAt.toISOString(),
  });
  const extraction: Extraction = {
    ...fakeExtraction(entry, 0),
    merchantName: sample.name,
    category: sample.category,
    paymentMethod: sample.payment,
    purchasedAt,
    total,
    taxTotal: Math.round(total * 18) / 100,
    confidence: index % 7 === 3 ? 0.45 : 0.92,
    createdAt: createdAt.toISOString(),
    items: toItems(items),
  };
  usageByExtraction.set(extraction.id, usage);
  addExtraction(entry, extraction);
}
