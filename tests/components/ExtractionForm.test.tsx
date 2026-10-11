import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExtractionForm } from "@/features/receipts/ExtractionForm";
import type { Extraction } from "@/features/receipts/lib/extraction-form";
import { itemsSum, itemsTotalMismatch } from "@/lib/extraction";
import { renderWithQuery } from "../helpers/render";

const item = (id: string, description: string, amount: number) => ({
  id,
  position: Number(id),
  description,
  quantity: 1,
  unitPrice: amount,
  amount,
  vatRate: null,
  category: null,
  normalizedName: null,
  brand: null,
  size: null,
  sizeUnit: null,
  avoidability: null,
});

const extraction: Extraction = {
  id: "e1",
  receiptId: "r1",
  method: "llm",
  provider: "anthropic",
  model: "modello",
  keySource: "platform",
  promptVersion: "v2",
  merchantName: "Lidl",
  merchantBrand: null,
  merchantVat: null,
  merchantAddress: null,
  purchasedAt: "2026-10-01T06:15:00.000Z",
  currency: "EUR",
  total: 10,
  taxTotal: null,
  paymentMethod: "carta",
  category: "alimentari",
  avoidability: null,
  confidence: 0.5,
  notes: null,
  isCurrent: true,
  editedByUser: false,
  createdAt: "2026-10-01T06:20:00.000Z",
  // Una riga ripetuta alla giunzione tra due pezzi: 4 + 4 + 6 = 14 invece di 10.
  items: [item("1", "Latte", 4), item("2", "Latte", 4), item("3", "Pane", 6)],
};

describe("somma delle righe e totale", () => {
  it("calcola lo scarto solo oltre la tolleranza", () => {
    expect(itemsSum([{ amount: 1.1 }, { amount: null }, { amount: 2.2 }])).toBe(3.3);
    expect(itemsSum([{ amount: null }])).toBeNull();
    expect(itemsTotalMismatch(10, 10.04)).toBeNull();
    expect(itemsTotalMismatch(10, 14)).toEqual({ total: 10, sum: 14, difference: 4 });
    expect(itemsTotalMismatch(null, 14)).toBeNull();
  });

  it("il form avvisa finché righe e totale non tornano", async () => {
    renderWithQuery(<ExtractionForm extraction={extraction} />);
    expect(await screen.findByTestId("items-total-mismatch")).toHaveTextContent(
      /La somma delle righe \(14,00\s€\) non coincide con il totale \(10,00\s€\)/,
    );
    // Il totale corretto a mano fa sparire l'avviso.
    fireEvent.change(screen.getByLabelText(/^Totale/), { target: { value: "14,00" } });
    expect(screen.queryByTestId("items-total-mismatch")).not.toBeInTheDocument();
  });
});

describe("categoria delle righe", () => {
  it("mostra la categoria estratta per ogni riga, vuota se segue lo scontrino", async () => {
    renderWithQuery(
      <ExtractionForm
        extraction={{
          ...extraction,
          items: [{ ...item("1", "Detersivo", 3), category: "casa" }, item("2", "Pane", 7)],
        }}
      />,
    );
    const first = await screen.findByRole("group", { name: "Riga 1" });
    const second = screen.getByRole("group", { name: "Riga 2" });
    expect(within(first).getByLabelText("Categoria prodotto")).toHaveValue("casa");
    expect(within(second).getByLabelText("Categoria prodotto")).toHaveValue("");
    expect(within(second).getByRole("option", { name: "Come lo scontrino" })).toBeInTheDocument();
  });
});
