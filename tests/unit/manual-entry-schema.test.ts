import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultManualEntryValues,
  manualEntrySchema,
  toManualReceiptInput,
  totalFromItems,
  type ManualEntryValues,
} from "@/features/manual-entry";

const valid = (overrides: Partial<ManualEntryValues> = {}): ManualEntryValues => ({
  ...defaultManualEntryValues("2026-10-04T12:30"),
  merchantName: "Bar Centrale",
  total: "1.234,50",
  category: "ristorazione",
  paymentMethod: "contanti",
  ...overrides,
});

describe("manualEntrySchema", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T08:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("converte importi italiani e data di Roma nel corpo della richiesta", () => {
    const parsed = manualEntrySchema.parse(
      valid({
        taxTotal: "4,5",
        currency: "eur",
        merchantVat: " IT01234567890 ",
        items: [
          { description: "Caffè", quantity: "2", unitPrice: "1,20", amount: "2,40", vatRate: "10" },
          { description: "Brioche", quantity: "", unitPrice: "", amount: "", vatRate: "" },
        ],
      }),
    );
    expect(toManualReceiptInput(parsed)).toEqual({
      merchantName: "Bar Centrale",
      purchasedAt: "2026-10-04T12:30:00+02:00",
      total: 1234.5,
      currency: "EUR",
      category: "ristorazione",
      paymentMethod: "contanti",
      merchantVat: "IT01234567890",
      taxTotal: 4.5,
      items: [
        { description: "Caffè", quantity: 2, unitPrice: 1.2, amount: 2.4, vatRate: 10 },
        { description: "Brioche" },
      ],
    });
  });

  it("non invia i campi facoltativi vuoti", () => {
    const input = toManualReceiptInput(manualEntrySchema.parse(valid()));
    expect(input).toEqual({
      merchantName: "Bar Centrale",
      purchasedAt: "2026-10-04T12:30:00+02:00",
      total: 1234.5,
      currency: "EUR",
      category: "ristorazione",
      paymentMethod: "contanti",
    });
  });

  it("segnala i campi obbligatori mancanti", () => {
    const result = manualEntrySchema.safeParse(defaultManualEntryValues("2026-10-04T12:30"));
    expect(result.success).toBe(false);
    const messages = Object.fromEntries(
      result.error!.issues.map((issue) => [issue.path.join("."), issue.message]),
    );
    expect(messages).toMatchObject({
      merchantName: "Inserisci il nome dell'esercente.",
      total: "Inserisci il totale.",
      category: "Scegli una categoria.",
      paymentMethod: "Scegli un metodo di pagamento.",
    });
  });

  it("rifiuta importi non validi, con troppi decimali, aliquote e date future", () => {
    const issues = (values: ManualEntryValues) =>
      manualEntrySchema.safeParse(values).error?.issues.map((issue) => issue.message) ?? [];
    expect(issues(valid({ total: "dodici" }))).toContain(
      "Importo non valido: usa il formato 12,50.",
    );
    expect(issues(valid({ total: "12,345" }))).toContain("Massimo 2 decimali.");
    const item = {
      description: "x",
      quantity: "1,0005",
      unitPrice: "1,799",
      amount: "",
      vatRate: "22,555",
    };
    expect(issues(valid({ items: [item] }))).toEqual(
      expect.arrayContaining(["Massimo 3 decimali.", "Massimo 2 decimali."]),
    );
    const huge = { ...item, quantity: "10000000", unitPrice: "", vatRate: "" };
    expect(issues(valid({ items: [huge] }))).toContain("Quantità fuori dai limiti consentiti.");
    expect(
      issues(
        valid({
          items: [{ description: "x", quantity: "", unitPrice: "", amount: "", vatRate: "120" }],
        }),
      ),
    ).toContain("L'aliquota deve essere tra 0 e 100.");
    expect(
      issues(
        valid({
          items: [{ description: " ", quantity: "", unitPrice: "", amount: "", vatRate: "" }],
        }),
      ),
    ).toContain("Inserisci la descrizione della riga.");
    expect(issues(valid({ purchasedAt: "2999-01-01T10:00" }))).toContain(
      "La data non può essere nel futuro.",
    );
    expect(issues(valid({ currency: "EURO" }))).toContain("Usa un codice di 3 lettere, es. EUR.");
  });
});

describe("totalFromItems", () => {
  it("somma gli importi o quantità × prezzo", () => {
    expect(
      totalFromItems([
        { description: "a", quantity: "", unitPrice: "", amount: "2,40", vatRate: "" },
        { description: "b", quantity: "3", unitPrice: "0,10", amount: "", vatRate: "" },
        { description: "c", quantity: "", unitPrice: "1,05", amount: "", vatRate: "" },
      ]),
    ).toBe(3.75);
  });

  it("restituisce null senza importi", () => {
    expect(
      totalFromItems([{ description: "a", quantity: "2", unitPrice: "", amount: "", vatRate: "" }]),
    ).toBeNull();
    expect(totalFromItems([])).toBeNull();
  });
});
