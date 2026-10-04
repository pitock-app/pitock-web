import { z } from "zod";
import { manualEntrySchema, manualItemSchema } from "@/features/manual-entry";
import { categories } from "@/lib/api/enums";
import type { components } from "@/lib/api/schema";
import { formatAmountInput, toRomeLocalInput } from "@/lib/format";

type Schemas = components["schemas"];
export type Extraction = Schemas["ExtractionDetail"];
export type ExtractionPatch = Schemas["ExtractionPatch"];

/**
 * Form di correzione: gli stessi campi e la stessa validazione dell'inserimento manuale.
 * Le righe conservano la loro categoria (non modificabile dal form) per non perderla
 * quando `items` sostituisce tutte le righe.
 */
export const extractionFormSchema = manualEntrySchema.extend({
  items: z.array(manualItemSchema.extend({ category: z.enum(categories).optional() })).max(500),
});

export type ExtractionFormValues = z.input<typeof extractionFormSchema>;
export type ExtractionFormOutput = z.output<typeof extractionFormSchema>;

/** Numero per un campo di input: virgola decimale, senza arrotondare. */
function numberInput(value: number | null): string {
  return value === null ? "" : String(value).replace(".", ",");
}

function amountInput(value: number | null): string {
  return value === null ? "" : formatAmountInput(value);
}

/** Valori iniziali del form a partire dall'estrazione corrente. */
export function extractionToFormValues(extraction: Extraction): ExtractionFormValues {
  return {
    merchantName: extraction.merchantName ?? "",
    purchasedAt: extraction.purchasedAt ? toRomeLocalInput(new Date(extraction.purchasedAt)) : "",
    total: amountInput(extraction.total),
    currency: extraction.currency || "EUR",
    // Vuote se l'estrazione non le ha: il form chiede di sceglierle.
    category: (extraction.category ?? "") as ExtractionFormValues["category"],
    paymentMethod: (extraction.paymentMethod ?? "") as ExtractionFormValues["paymentMethod"],
    merchantVat: extraction.merchantVat ?? "",
    taxTotal: amountInput(extraction.taxTotal),
    notes: extraction.notes ?? "",
    items: extraction.items.map((item) => ({
      description: item.description,
      quantity: numberInput(item.quantity),
      unitPrice: numberInput(item.unitPrice),
      amount: amountInput(item.amount),
      vatRate: numberInput(item.vatRate),
      ...(item.category ? { category: item.category } : {}),
    })),
  };
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Corpo di `PATCH /v1/extractions/{id}`: i campi facoltativi vuoti diventano null
 * (vengono cancellati), le righe sostituiscono tutte quelle esistenti.
 */
export function toExtractionPatch(values: ExtractionFormOutput): ExtractionPatch {
  return {
    merchantName: values.merchantName,
    purchasedAt: values.purchasedAt,
    total: values.total,
    currency: values.currency,
    category: values.category,
    paymentMethod: values.paymentMethod,
    merchantVat: values.merchantVat ?? null,
    taxTotal: values.taxTotal ?? null,
    notes: values.notes ?? null,
    items: values.items.map((item) => withoutUndefined(item)),
  };
}
