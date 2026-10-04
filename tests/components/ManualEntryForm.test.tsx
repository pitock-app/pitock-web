import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManualEntryForm } from "@/features/manual-entry";
import { createMockAuthProvider } from "@/lib/auth/mock-auth";
import { server, setupMswServer } from "../helpers/msw-server";
import { renderWithQuery } from "../helpers/render";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const provider = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getAuthProvider: () => provider.current,
}));

setupMswServer();

beforeEach(async () => {
  vi.clearAllMocks();
  const auth = createMockAuthProvider();
  provider.current = auth;
  await auth.signIn("anna@pitock.test", "x");
});

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Esercente"), "Bar Centrale");
  const date = screen.getByLabelText("Data e ora");
  await user.clear(date);
  await user.type(date, "2026-10-01T08:15");
  await user.type(screen.getByLabelText("Totale"), "3,20");
  await user.selectOptions(screen.getByLabelText("Categoria"), "ristorazione");
  await user.selectOptions(screen.getByLabelText("Metodo di pagamento"), "contanti");
}

describe("ManualEntryForm", () => {
  it("mostra gli errori dei campi obbligatori", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ManualEntryForm />);
    await user.click(screen.getByRole("button", { name: "Salva scontrino" }));
    expect(await screen.findByText("Inserisci il nome dell'esercente.")).toBeVisible();
    expect(screen.getByText("Inserisci il totale.")).toBeVisible();
    expect(screen.getByText("Scegli una categoria.")).toBeVisible();
    expect(screen.getByText("Scegli un metodo di pagamento.")).toBeVisible();
    expect(screen.getByLabelText("Esercente")).toHaveAttribute("aria-invalid", "true");
  });

  it("le categorie e i metodi di pagamento vengono dal contratto", () => {
    renderWithQuery(<ManualEntryForm />);
    const categories = within(screen.getByLabelText("Categoria")).getAllByRole("option");
    expect(categories).toHaveLength(12);
    expect(categories.map((option) => option.getAttribute("value"))).toContain("carburante");
    const methods = within(screen.getByLabelText("Metodo di pagamento")).getAllByRole("option");
    expect(methods.map((option) => option.getAttribute("value"))).toEqual([
      "",
      "contanti",
      "carta",
      "bancomat",
      "altro",
      "sconosciuto",
    ]);
  });

  it("calcola il totale dalle righe e salva convertendo gli importi", async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.events.on("request:start", async ({ request }) => {
      if (request.url.endsWith("/v1/receipts/manual")) body = await request.clone().json();
    });
    renderWithQuery(<ManualEntryForm />);
    await fillRequired(user);

    await user.click(screen.getByRole("button", { name: "Aggiungi riga" }));
    await user.click(screen.getByRole("button", { name: "Aggiungi riga" }));
    const first = screen.getByRole("group", { name: "Riga 1" });
    await user.type(within(first).getByLabelText("Descrizione"), "Caffè");
    await user.type(within(first).getByLabelText("Importo"), "1,20");
    const second = screen.getByRole("group", { name: "Riga 2" });
    await user.type(within(second).getByLabelText("Descrizione"), "Brioche");
    await user.type(within(second).getByLabelText("Quantità"), "2");
    await user.type(within(second).getByLabelText("Prezzo unitario"), "1,05");

    await user.click(screen.getByRole("button", { name: "Calcola totale dalle righe" }));
    expect(screen.getByLabelText("Totale")).toHaveValue("3,30");

    await user.click(screen.getByRole("button", { name: "Salva scontrino" }));
    const link = await screen.findByRole("link", { name: "Apri scontrino" });
    expect(link.getAttribute("href")).toMatch(/^\/receipts\/[0-9a-f-]{36}$/);
    server.events.removeAllListeners();

    expect(body).toEqual({
      merchantName: "Bar Centrale",
      purchasedAt: "2026-10-01T08:15:00+02:00",
      total: 3.3,
      currency: "EUR",
      category: "ristorazione",
      paymentMethod: "contanti",
      items: [
        { description: "Caffè", amount: 1.2 },
        { description: "Brioche", quantity: 2, unitPrice: 1.05 },
      ],
    });
    // Il form è stato svuotato.
    expect(screen.getByLabelText("Esercente")).toHaveValue("");
    expect(screen.queryByRole("group", { name: "Riga 1" })).not.toBeInTheDocument();
  });

  it("mostra l'errore del server in italiano", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("*/v1/receipts/manual", () =>
        HttpResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "bad", requestId: "r" } },
          { status: 400 },
        ),
      ),
    );
    renderWithQuery(<ManualEntryForm />);
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Salva scontrino" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Alcuni dati non sono validi. Controlla i campi e riprova.",
    );
  });
});
