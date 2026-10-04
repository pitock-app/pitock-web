import { z } from "zod";
import { categories, paymentMethods } from "@/lib/api/enums";
import type { components } from "@/lib/api/schema";
import { decimalPlaces, parseItalianNumber, romeLocalInputToIso } from "@/lib/format";
import { it } from "@/lib/i18n/it";

export type ManualReceiptInput = components["schemas"]["ManualReceiptInput"];

const e = it.manualEntry.errors;

/** Limiti del contratto (`ManualReceiptInput`). */
const MAX_AMOUNT = 9999999999.99;
const MAX_QUANTITY = 9999999;

/** Numero facoltativo in formato italiano: "" → undefined. */
function optionalNumber(options: {
  max: number;
  min?: number;
  decimals: number;
  messages: { invalid: string; decimals: string; range: string };
}) {
  const { max, min = -max, decimals, messages } = options;
  return z.string().transform((value, ctx) => {
    if (!value.trim()) return undefined;
    const parsed = parseItalianNumber(value);
    const issue =
      parsed === null
        ? messages.invalid
        : decimalPlaces(value) > decimals
          ? messages.decimals
          : parsed < min || parsed > max
            ? messages.range
            : null;
    if (issue) {
      ctx.addIssue({ code: "custom", message: issue });
      return z.NEVER;
    }
    return parsed ?? undefined;
  });
}

const optionalAmount = () =>
  optionalNumber({
    max: MAX_AMOUNT,
    decimals: 2,
    messages: { invalid: e.amountInvalid, decimals: e.amountDecimals, range: e.amountRange },
  });

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || undefined);

export const manualItemSchema = z.object({
  description: z.string().trim().min(1, e.descriptionRequired).max(500, e.descriptionTooLong),
  // Decimali come le colonne del backend: quantità numeric(10,3), prezzi e aliquota a 2.
  quantity: optionalNumber({
    max: MAX_QUANTITY,
    decimals: 3,
    messages: { invalid: e.numberInvalid, decimals: e.quantityDecimals, range: e.quantityRange },
  }),
  unitPrice: optionalAmount(),
  amount: optionalAmount(),
  vatRate: optionalNumber({
    min: 0,
    max: 100,
    decimals: 2,
    messages: { invalid: e.numberInvalid, decimals: e.amountDecimals, range: e.vatRateRange },
  }),
});

/**
 * Form dell'inserimento manuale. I campi sono stringhe (come negli input) e lo schema
 * li converte nel corpo di `POST /v1/receipts/manual`.
 */
export const manualEntrySchema = z.object({
  merchantName: z.string().trim().min(1, e.merchantRequired).max(200, e.merchantTooLong),
  purchasedAt: z
    .string()
    .min(1, e.dateRequired)
    .transform((value, ctx) => {
      const iso = romeLocalInputToIso(value);
      if (!iso) {
        ctx.addIssue({ code: "custom", message: e.dateInvalid });
        return z.NEVER;
      }
      // Un minuto di tolleranza per gli orologi non sincronizzati.
      if (Date.parse(iso) > Date.now() + 60_000) {
        ctx.addIssue({ code: "custom", message: e.dateFuture });
        return z.NEVER;
      }
      return iso;
    }),
  total: optionalAmount().pipe(z.number({ error: e.amountRequired })),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, e.currencyInvalid)
    .transform((value) => value.toUpperCase()),
  category: z.enum(categories, { error: e.categoryRequired }),
  paymentMethod: z.enum(paymentMethods, { error: e.paymentMethodRequired }),
  merchantVat: optionalText(32, e.vatTooLong),
  taxTotal: optionalAmount(),
  notes: optionalText(2000, e.notesTooLong),
  items: z.array(manualItemSchema).max(500),
});

export type ManualEntryValues = z.input<typeof manualEntrySchema>;
export type ManualEntryOutput = z.output<typeof manualEntrySchema>;

export const emptyItem: ManualEntryValues["items"][number] = {
  description: "",
  quantity: "",
  unitPrice: "",
  amount: "",
  vatRate: "",
};

/** Valori iniziali: data e ora di adesso (fuso di Roma), valuta EUR. */
export function defaultManualEntryValues(now: string): ManualEntryValues {
  return {
    merchantName: "",
    purchasedAt: now,
    total: "",
    currency: "EUR",
    // Le select partono vuote: lo schema chiede di scegliere.
    category: "" as ManualEntryValues["category"],
    paymentMethod: "" as ManualEntryValues["paymentMethod"],
    merchantVat: "",
    taxTotal: "",
    notes: "",
    items: [],
  };
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/** Corpo della richiesta: i campi facoltativi vuoti non vengono inviati. */
export function toManualReceiptInput(values: ManualEntryOutput): ManualReceiptInput {
  const { items, ...rest } = values;
  return withoutUndefined({
    ...rest,
    items: items.length ? items.map((item) => withoutUndefined(item)) : undefined,
  });
}

/**
 * Totale delle righe: somma degli importi, oppure quantità × prezzo unitario
 * se l'importo manca. Null se nessuna riga ha valori utilizzabili.
 */
export function totalFromItems(items: ManualEntryValues["items"]): number | null {
  let sum = 0;
  let found = false;
  for (const item of items) {
    const amount = parseItalianNumber(item.amount);
    if (amount !== null) {
      sum += amount;
      found = true;
      continue;
    }
    const unitPrice = parseItalianNumber(item.unitPrice);
    if (unitPrice === null) continue;
    const quantity = parseItalianNumber(item.quantity) ?? 1;
    sum += quantity * unitPrice;
    found = true;
  }
  return found ? Math.round(sum * 100) / 100 : null;
}
