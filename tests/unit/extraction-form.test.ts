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
  merchantBrand: null,
  merchantVat: "IT01234567890",
  merchantAddress: "Via Roma 1",
  purchasedAt: "2026-10-01T06:15:00.000Z",
  currency: "EUR",
  total: 1234.5,
  taxTotal: null,
  paymentMethod: "carta",
  category: "carburante",
  avoidability: null,
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
      normalizedName: null,
      brand: null,
      size: null,
      sizeUnit: null,
      avoidability: null,
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
      avoidability: "",
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
      avoidability: null,
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

  it("invia la categoria di riga scelta a mano e la omette se segue lo scontrino", () => {
    const values = extractionToFormValues(extraction);
    values.items[0].category = "trasporti";
    expect(toExtractionPatch(extractionFormSchema.parse(values)).items?.[0]).toMatchObject({
      category: "trasporti",
    });
    values.items[0].category = "";
    expect(toExtractionPatch(extractionFormSchema.parse(values)).items?.[0]).not.toHaveProperty(
      "category",
    );
  });

  it("conserva l'evitabilità di scontrino e righe e la cancella se svuotata", () => {
    const classified = {
      ...extraction,
      avoidability: "essenziale" as const,
      items: extraction.items.map((i) => ({ ...i, avoidability: "utile" as const })),
    };
    const values = extractionToFormValues(classified);
    const patch = toExtractionPatch(extractionFormSchema.parse(values));
    expect(patch.avoidability).toBe("essenziale");
    expect(patch.items?.[0]).toMatchObject({ avoidability: "utile" });
    values.avoidability = "";
    values.items[0].avoidability = "superfluo";
    const changed = toExtractionPatch(extractionFormSchema.parse(values));
    expect(changed.avoidability).toBeNull();
    expect(changed.items?.[0]).toMatchObject({ avoidability: "superfluo" });
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

describe("prodotto normalizzato nelle righe corrette", () => {
  const withProduct: Extraction = {
    ...extraction,
    items: [
      {
        ...extraction.items[0],
        normalizedName: "Gasolio",
        brand: null,
        size: null,
        sizeUnit: null,
        avoidability: null,
      },
    ],
  };

  it("lo rimanda invariato se la descrizione non cambia e lo toglie se cambia", () => {
    const values = extractionToFormValues(withProduct);
    const same = toExtractionPatch(extractionFormSchema.parse(values));
    expect(same.items?.[0]).toMatchObject({ description: "Gasolio", normalizedName: "Gasolio" });

    values.items[0].description = "Benzina";
    const changed = toExtractionPatch(extractionFormSchema.parse(values));
    expect(changed.items?.[0]).toMatchObject({ description: "Benzina" });
    expect(changed.items?.[0]).not.toHaveProperty("normalizedName");
  });
});
