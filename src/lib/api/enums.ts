// File generato da scripts/api-enums.mjs (pnpm api:types): non modificarlo a mano.
import type { components } from "./schema";

type Schemas = components["schemas"];
/** Errore di compilazione se l'array non contiene esattamente i valori dell'enum. */
type Exact<T, U> = [T] extends [U] ? ([U] extends [T] ? true : never) : never;

export const categories = [
  "alimentari",
  "ristorazione",
  "trasporti",
  "carburante",
  "salute",
  "casa",
  "abbigliamento",
  "tecnologia",
  "svago",
  "servizi",
  "altro",
] as const;
export const categoriesExact: Exact<(typeof categories)[number], Schemas["Category"]> = true;

export const paymentMethods = ["contanti", "carta", "bancomat", "altro", "sconosciuto"] as const;
export const paymentMethodsExact: Exact<(typeof paymentMethods)[number], Schemas["PaymentMethod"]> =
  true;

export const mimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const mimeTypesExact: Exact<(typeof mimeTypes)[number], Schemas["MimeType"]> = true;

export const receiptSources = ["camera", "file", "manual"] as const;
export const receiptSourcesExact: Exact<(typeof receiptSources)[number], Schemas["ReceiptSource"]> =
  true;

export const receiptStatuses = [
  "pending_upload",
  "uploaded",
  "processing",
  "extracted",
  "failed",
] as const;
export const receiptStatusesExact: Exact<
  (typeof receiptStatuses)[number],
  Schemas["ReceiptStatus"]
> = true;

export const aiProviders = ["anthropic", "openai", "openrouter"] as const;
export const aiProvidersExact: Exact<(typeof aiProviders)[number], Schemas["Provider"]> = true;

export const aiModes = ["platform", "byok"] as const;
export const aiModesExact: Exact<(typeof aiModes)[number], Schemas["AiMode"]> = true;
