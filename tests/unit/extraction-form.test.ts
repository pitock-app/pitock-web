import { describe, expect, it } from "vitest";
import {
  extractionFormSchema,
  extractionToFormValues,
  toExtractionPatch,
  type Extraction,
} from "@/features/receipts/lib/extraction-form";

const extraction: Extraction = {
  id: "e1",
  receiptId: "r1",
  method: "llm",
  provider: "anthropic",
  model: "claude-haiku-4-5",
  keySource: "platform",
  promptVersion: "v1",
  merchantName: "Eni Station",
  merchantVat: "IT01234567890",
  merchantAddress: "Via Roma 1",
  purchasedAt: "2026-10-01T06:15:00.000Z",
  currency: "EUR",
  total: 1234.5,
  taxTotal: null,
  paymentMethod: "carta",
  category: "carburante",
  confidence: 0.5,
  notes: null,
  isCurrent: true,
  editedByUser: false,
  createdAt: "2026-10-01T06:20:00.000Z",
  items: [
    {
      id: "i1",
      position: 1,
      description: "Gasolio",
      quantity: 30.5,
      unitPrice: 1.8,
      amount: 54.9,
      vatRate: 22,
      category: "carburante",
    },
  ],
};

describe("form di correzione dell'estrazione", () => {
  it("converte l'estrazione nei valori del form (formato italiano, ora di Roma)", () => {
    const values = extractionToFormValues(extraction);
    expect(values).toMatchObject({
      merchantName: "Eni Station",
      purchasedAt: "2026-10-01T08:15",
      total: "1234,50",
      taxTotal: "",
      category: "carburante",
      notes: "",
    });
    expect(values.items[0]).toEqual({
      description: "Gasolio",
      quantity: "30,5",
      unitPrice: "1,8",
      amount: "54,90",
      vatRate: "22",
      category: "carburante",
    });
  });

  it("senza modifiche produce un PATCH coerente, con null per i campi vuoti e le categorie delle righe", () => {
    const parsed = extractionFormSchema.parse(extractionToFormValues(extraction));
    expect(toExtractionPatch(parsed)).toEqual({
      merchantName: "Eni Station",
      purchasedAt: "2026-10-01T08:15:00+02:00",
      total: 1234.5,
      currency: "EUR",
      category: "carburante",
      paymentMethod: "carta",
      merchantVat: "IT01234567890",
      taxTotal: null,
      notes: null,
      items: [
        {
          description: "Gasolio",
          quantity: 30.5,
          unitPrice: 1.8,
          amount: 54.9,
          vatRate: 22,
          category: "carburante",
        },
      ],
    });
  });

  it("chiede di scegliere categoria e pagamento se l'estrazione non li ha", () => {
    const result = extractionFormSchema.safeParse(
      extractionToFormValues({ ...extraction, category: null, paymentMethod: null, total: null }),
    );
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["category", "paymentMethod", "total"]));
  });
});
