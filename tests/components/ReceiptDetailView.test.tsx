import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReceiptDetailView, ReceiptViewer } from "@/features/receipts";
import { createMockAuthProvider } from "@/lib/auth/mock-auth";
import { createMockAccessToken } from "@/lib/auth/mock-session";
import type { components } from "@/lib/api/schema";
import { mockTiming } from "@/mocks";
import { server, setupMswServer } from "../helpers/msw-server";
import { renderWithQuery } from "../helpers/render";

type Schemas = components["schemas"];

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const provider = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/env", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...original,
    env: { ...original.env, NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.co" },
  };
});
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getAuthProvider: () => provider.current,
}));

setupMswServer();

// "byok…": l'utente finto ha una chiave per ogni provider (rielaborazione con un altro modello).
const EMAIL = "byok@pitock.test";

beforeEach(async () => {
  vi.clearAllMocks();
  mockTiming.startMs = 0;
  mockTiming.doneMs = 0;
  const auth = createMockAuthProvider();
  provider.current = auth;
  await auth.signIn(EMAIL, "x");
});

/** Id di uno scontrino di esempio con i filtri dati. */
async function sampleId(query: string): Promise<string> {
  const response = await fetch(`http://api.test/v1/receipts?${query}`, {
    headers: { Authorization: `Bearer ${createMockAccessToken(EMAIL)}` },
  });
  const list = (await response.json()) as Schemas["ReceiptList"];
  return list.items[0].id;
}

describe("ReceiptDetailView", () => {
  it("salva la correzione con PATCH e aggiorna lo storico", async () => {
    const user = userEvent.setup();
    const id = await sampleId("source=file&status=extracted");
    let body: unknown;
    server.events.on("request:start", async ({ request }) => {
      if (request.method === "PATCH") body = await request.clone().json();
    });
    renderWithQuery(<ReceiptDetailView id={id} />);

    const total = await screen.findByLabelText("Totale");
    await user.clear(total);
    await user.type(total, "42,10");
    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));

    await waitFor(() => expect(body).toMatchObject({ total: 42.1 }));
    const history = await screen.findByTestId("extraction-history");
    await waitFor(() => expect(within(history).getByText("Modificata")).toBeInTheDocument());
    expect(screen.getByLabelText("Totale")).toHaveValue("42,10");
    server.events.removeAllListeners();
  });

  it("mostra gli errori del form senza chiamare il backend", async () => {
    const user = userEvent.setup();
    const id = await sampleId("status=extracted");
    const patch = vi.fn();
    server.use(http.patch("*/v1/extractions/:id", patch));
    renderWithQuery(<ReceiptDetailView id={id} />);
    const merchant = await screen.findByLabelText("Esercente");
    await user.clear(merchant);
    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));
    expect(await screen.findByText("Inserisci il nome dell'esercente.")).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it("con ?edit=1 porta il focus sul primo campo", async () => {
    const id = await sampleId("status=extracted");
    renderWithQuery(<ReceiptDetailView id={id} edit />);
    const merchant = await screen.findByLabelText("Esercente");
    await waitFor(() => expect(merchant).toHaveFocus());
  });

  it("rilancia l'estrazione con provider e modello scelti", async () => {
    const user = userEvent.setup();
    const id = await sampleId("source=camera&status=extracted");
    let body: unknown;
    server.events.on("request:start", async ({ request }) => {
      if (request.url.endsWith("/reextract")) body = await request.clone().json();
    });
    renderWithQuery(<ReceiptDetailView id={id} />);
    await user.click(await screen.findByRole("button", { name: "Rilancia estrazione" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Provider"), "openrouter");
    await user.type(within(dialog).getByLabelText(/Modello/), "x/modello");
    await user.click(within(dialog).getByRole("button", { name: "Rilancia" }));
    await waitFor(() => expect(body).toEqual({ provider: "openrouter", model: "x/modello" }));
    await waitFor(() => expect(screen.getAllByTestId("extraction-history-item")).toHaveLength(2));
    server.events.removeAllListeners();
  });

  it("elimina dopo la conferma e torna alla lista", async () => {
    const user = userEvent.setup();
    const id = await sampleId("status=extracted");
    renderWithQuery(<ReceiptDetailView id={id} />);
    await user.click(await screen.findByRole("button", { name: "Elimina" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Elimina" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/receipts"));
  });

  it("per uno scontrino fallito mostra il motivo e il link alle impostazioni", async () => {
    const id = await sampleId("status=failed");
    renderWithQuery(<ReceiptDetailView id={id} />);
    expect(await screen.findByText("Estrazione non riuscita")).toBeInTheDocument();
    expect(screen.getByText("Non sembra uno scontrino.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Esercente")).not.toBeInTheDocument();
  });

  it("uno scontrino inesistente mostra il messaggio di non trovato", async () => {
    renderWithQuery(<ReceiptDetailView id="00000000-0000-4000-8000-000000000999" />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Scontrino non trovato" }),
    ).toBeInTheDocument();
  });
});

describe("ReceiptViewer", () => {
  const receipt: Schemas["Receipt"] = {
    id: "r1",
    source: "file",
    status: "extracted",
    originalFilename: "a.jpg",
    sha256: null,
    mimeType: "image/jpeg",
    sizeBytes: 10,
    capturedAt: null,
    errorCode: null,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };

  it("mostra l'immagine con lo zoom", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <ReceiptViewer
        receipt={receipt}
        fileUrl="https://proj.supabase.co/storage/v1/object/sign/receipts/u/a.jpg?token=t"
      />,
    );
    const image = screen.getByRole("img", { name: "Immagine dello scontrino" });
    expect(image).toHaveAttribute(
      "src",
      "https://proj.supabase.co/storage/v1/object/sign/receipts/u/a.jpg?token=t",
    );
    await user.click(screen.getByRole("button", { name: "Ingrandisci" }));
    expect(image).toHaveStyle({ width: "150%" });
    expect(screen.getByText("Zoom 150%")).toBeInTheDocument();
  });

  it("incorpora i PDF", () => {
    renderWithQuery(
      <ReceiptViewer
        receipt={{ ...receipt, mimeType: "application/pdf" }}
        fileUrl="https://proj.supabase.co/storage/v1/object/sign/receipts/u/a.pdf?token=t"
      />,
    );
    expect(screen.getByTitle("PDF dello scontrino")).toHaveAttribute(
      "src",
      "https://proj.supabase.co/storage/v1/object/sign/receipts/u/a.pdf?token=t",
    );
  });

  it("non usa URL non sicuri e riconosce i manuali", () => {
    const { unmount } = renderWithQuery(
      <ReceiptViewer receipt={receipt} fileUrl="https://evil.test/a.jpg" />,
    );
    expect(screen.getByText("File non disponibile")).toBeInTheDocument();
    unmount();
    renderWithQuery(<ReceiptViewer receipt={{ ...receipt, source: "manual" }} />);
    expect(screen.getByText("Inserito a mano")).toBeInTheDocument();
  });
});
