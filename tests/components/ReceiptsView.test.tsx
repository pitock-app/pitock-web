import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReceiptsView } from "@/features/receipts";
import { createMockAuthProvider } from "@/lib/auth/mock-auth";
import { seededReceiptCount } from "@/mocks";
import { server, setupMswServer } from "../helpers/msw-server";
import { renderWithQuery } from "../helpers/render";

const nav = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  search: new URLSearchParams(),
}));
const provider = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => "/receipts",
  useSearchParams: () => nav.search,
}));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getAuthProvider: () => provider.current,
}));

setupMswServer();

async function signIn(email = "anna@pitock.test") {
  const auth = createMockAuthProvider();
  provider.current = auth;
  await auth.signIn(email, "x");
}

beforeEach(async () => {
  vi.clearAllMocks();
  nav.search = new URLSearchParams();
  await signIn();
});

const table = () => screen.getByTestId("receipt-table");
const rows = () => within(table()).getAllByTestId("receipt-row");

describe("ReceiptsView", () => {
  it("mostra la prima pagina e carica le altre con il cursore", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ReceiptsView />);
    await waitFor(() => expect(rows()).toHaveLength(20));
    expect(within(table()).getAllByRole("link")[0]).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/receipts\/[0-9a-f-]{36}$/),
    );
    // Si carica una pagina alla volta finché il pulsante sparisce.
    const expected = seededReceiptCount("anna@pitock.test");
    for (let page = 2; page <= Math.ceil(expected / 20); page += 1) {
      await user.click(screen.getByRole("button", { name: "Carica altri" }));
      await waitFor(() => expect(rows()).toHaveLength(Math.min(page * 20, expected)));
    }
    expect(screen.queryByRole("button", { name: "Carica altri" })).not.toBeInTheDocument();
  });

  it("usa i filtri della query string e li aggiorna nell'URL", async () => {
    const user = userEvent.setup();
    nav.search = new URLSearchParams("category=carburante");
    renderWithQuery(<ReceiptsView />);
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(screen.getByLabelText("Categoria")).toHaveValue("carburante");

    await user.selectOptions(screen.getByLabelText("Sorgente"), "manual");
    expect(nav.router.replace).toHaveBeenLastCalledWith(
      "/receipts?category=carburante&source=manual",
      { scroll: false },
    );
    await user.click(screen.getByRole("button", { name: "Azzera filtri" }));
    expect(nav.router.replace).toHaveBeenLastCalledWith("/receipts", { scroll: false });
  });

  it("la ricerca aggiorna l'URL dopo una breve pausa", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ReceiptsView />);
    await user.type(screen.getByLabelText("Cerca esercente"), "bar");
    await waitFor(() =>
      expect(nav.router.replace).toHaveBeenCalledWith("/receipts?q=bar", { scroll: false }),
    );
    expect(nav.router.replace).toHaveBeenCalledTimes(1);
  });

  it("senza scontrini invita ad aggiungerne uno", async () => {
    await signIn("vuoto@pitock.test");
    renderWithQuery(<ReceiptsView />);
    expect(await screen.findByRole("heading", { name: "Nessuno scontrino" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aggiungi scontrino" })).toHaveAttribute(
      "href",
      "/add",
    );
  });

  it("con i filtri senza risultati propone di azzerarli", async () => {
    nav.search = new URLSearchParams("q=nessuno");
    renderWithQuery(<ReceiptsView />);
    expect(
      await screen.findByRole("heading", { name: "Nessuno scontrino con questi filtri" }),
    ).toBeInTheDocument();
  });

  it("in caso di errore mostra Riprova", async () => {
    server.use(
      http.get("*/v1/receipts", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL", message: "boom", requestId: "r" } },
          { status: 500 },
        ),
      ),
    );
    renderWithQuery(<ReceiptsView />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Non è stato possibile caricare gli scontrini.",
    );
    expect(screen.getByRole("button", { name: "Riprova" })).toBeInTheDocument();
  });
});
