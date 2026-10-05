import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardView } from "@/features/dashboard";
import {
  filtersFromSlider,
  serializeDashboardFilters,
} from "@/features/dashboard/lib/dashboard-period";
import type { components } from "@/lib/api/schema";
import { createMockAuthProvider } from "@/lib/auth/mock-auth";
import { formatCurrency, toRomeDateInput } from "@/lib/format";
import { server, setupMswServer } from "../helpers/msw-server";
import { renderWithQuery } from "../helpers/render";

type Stats = components["schemas"]["Stats"];
type Dataset = components["schemas"]["StatsDataset"];

const nav = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  search: new URLSearchParams(),
}));
const provider = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => "/dashboard",
  useSearchParams: () => nav.search,
}));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getAuthProvider: () => provider.current,
}));

setupMswServer();

/** Importo come lo legge Testing Library, che normalizza gli spazi. */
const money = (value: number) => formatCurrency(value).replace(/\s/g, " ");

beforeEach(async () => {
  vi.clearAllMocks();
  // Intervallo fisso: settembre 2026.
  nav.search = new URLSearchParams("period=custom&from=2026-09-01&to=2026-09-30");
  const auth = createMockAuthProvider();
  provider.current = auth;
  await auth.signIn("anna@pitock.test", "x");
});

const receipt = (
  id: string,
  date: string,
  merchantName: string,
  total: number,
  category: Dataset["receipts"][number]["category"],
  source: Dataset["receipts"][number]["source"] = "camera",
) => ({ id, date, merchantName, merchantOriginal: merchantName, total, category, source });

const line = (
  receiptId: string,
  description: string,
  unitPrice: number,
  quantity = 1,
  category: Dataset["items"][number]["category"] = "alimentari",
) => ({
  receiptId,
  description,
  quantity,
  unitPrice,
  amount: unitPrice * quantity,
  category,
  normalizedName: null,
  brand: null,
  size: null,
  sizeUnit: null,
});

/** Settembre 2026: latte in due negozi a prezzi diversi, benzina senza righe. */
const dataset: Dataset = {
  from: "2026-08-31T22:00:00.000Z",
  to: "2026-09-30T22:00:00.000Z",
  truncated: false,
  receipts: [
    receipt("r4", "2026-09-20T09:00:00Z", "Esselunga", 30, "casa", "file"),
    receipt("r3", "2026-09-12T09:00:00Z", "Eni", 60, "carburante", "manual"),
    receipt("r2", "2026-09-10T09:00:00Z", "Lidl", 15, "alimentari"),
    receipt("r1", "2026-09-03T09:00:00Z", "Esselunga", 20, "alimentari"),
  ],
  items: [
    line("r4", "LATTE INTERO 1L", 1.59),
    line("r4", "DETERSIVO PIATTI", 2.5, 1, "casa"),
    line("r2", "LATTE INTERO 1L", 1.29),
    line("r1", "LATTE INTERO 1L", 1.49, 2),
    line("r1", "PASTA PENNE 500G", 0.95),
  ],
};

const emptyDataset: Dataset = { ...dataset, receipts: [], items: [] };

const emptyStats: Stats = {
  from: null,
  to: null,
  granularity: "year",
  totals: { total: 0, nReceipts: 0, average: 0 },
  byCategory: [],
  byPeriod: [],
  topMerchants: [],
  bySource: [],
};

/** Mese in corso (per la previsione): 50 € spesi il primo del mese. */
const thisMonth = `${toRomeDateInput().slice(0, 7)}-01T10:00:00Z`;
const historyDataset: Dataset = {
  ...dataset,
  receipts: [receipt("h1", thisMonth, "Coop", 50, "alimentari")],
  items: [],
};

/**
 * Risposte di `/v1/stats/dataset`: il periodo scelto (settembre) e lo storico della previsione
 * (gli altri intervalli). `/v1/stats` serve solo a capire se l'utente non ha scontrini.
 */
function mockDataset(responses: { current: Dataset; history?: Dataset; allTime?: Stats }) {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get("*/v1/stats/dataset", ({ request }) => {
      const query = new URL(request.url).searchParams;
      queries.push(query);
      if (query.get("from")?.startsWith("2026-09")) return HttpResponse.json(responses.current);
      return HttpResponse.json(responses.history ?? historyDataset);
    }),
    http.get("*/v1/stats", () =>
      HttpResponse.json(
        responses.allTime ?? { ...emptyStats, totals: { total: 1, nReceipts: 1, average: 1 } },
      ),
    ),
  );
  return queries;
}

describe("DashboardView", () => {
  it("mostra previsione, risparmio, KPI e grafici calcolati dalle righe", async () => {
    const queries = mockDataset({ current: dataset });
    renderWithQuery(<DashboardView />);

    expect(await screen.findByTestId("dashboard-kpi-total")).toHaveTextContent(money(125));
    expect(screen.getByTestId("dashboard-kpi-count")).toHaveTextContent("4");
    expect(screen.getByTestId("dashboard-kpi-average")).toHaveTextContent(money(31.25));
    const kpis = screen.getByRole("region", { name: "Riepilogo del periodo" });
    expect(within(kpis).queryByText("Variazione")).not.toBeInTheDocument();
    expect(queries.map((query) => query.toString())).toContain("from=2026-09-01&to=2026-09-30");

    // Previsione sul mese in corso (storico dalla seconda richiesta).
    expect(await screen.findByTestId("forecast-spent")).toHaveTextContent(money(50));
    expect(screen.getByTestId("forecast-indicative")).toHaveTextContent("Stima indicativa");

    // Latte: (1,49 − 1,29) × 2 + (1,59 − 1,29) = 0,70 €.
    expect(screen.getByTestId("savings-total")).toHaveTextContent(money(0.7));
    const comparison = screen.getByRole("region", { name: "Stesso prodotto, negozi diversi" });
    // Il nome compare nel grafico e nella tabella dei dati.
    expect(within(comparison).getAllByText("Latte intero 1L").length).toBeGreaterThan(0);
    expect(within(comparison).getAllByText("Lidl").length).toBeGreaterThan(0);
    expect(screen.getByTestId("savings-tips")).toHaveTextContent(
      /Latte intero 1L costa il \d+% in meno da Lidl che da Esselunga/,
    );

    const legend = screen.getByTestId("category-legend");
    expect(within(legend).getByText("Carburante")).toBeInTheDocument();
    expect(within(legend).getByText(money(60))).toBeInTheDocument();

    const merchants = screen.getByRole("region", { name: "Esercenti principali" });
    expect(within(merchants).getAllByRole("listitem")).toHaveLength(3);
    const sources = screen.getByRole("region", { name: "Per sorgente" });
    expect(within(sources).getByText(money(60))).toBeInTheDocument();
    const bars = screen.getByRole("region", { name: "Spesa per mese" });
    expect(within(bars).getByRole("rowheader", { name: "settembre 2026" })).toBeInTheDocument();
  });

  it("al clic su una categoria mostra i prodotti che la compongono", async () => {
    const user = userEvent.setup();
    mockDataset({ current: dataset });
    renderWithQuery(<DashboardView />);
    const legend = await screen.findByTestId("category-legend");
    await user.click(within(legend).getByRole("button", { name: /Casa/ }));
    const card = screen.getByRole("region", { name: "Per categoria" });
    expect(within(card).getByText("Detersivo piatti")).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Tutte le categorie" }));
    expect(within(card).getByTestId("category-legend")).toBeInTheDocument();
  });

  it("filtra tutti i grafici per negozio e conserva il filtro cambiando periodo", async () => {
    const user = userEvent.setup();
    mockDataset({ current: dataset });
    const first = renderWithQuery(<DashboardView />);
    await screen.findByTestId("dashboard-kpi-total");
    await user.selectOptions(screen.getByLabelText("Negozio"), "Lidl");
    expect(nav.router.replace).toHaveBeenLastCalledWith(
      "/dashboard?period=custom&from=2026-09-01&to=2026-09-30&store=Lidl",
      { scroll: false },
    );
    first.unmount();

    nav.search = new URLSearchParams("period=custom&from=2026-09-01&to=2026-09-30&store=Lidl");
    renderWithQuery(<DashboardView />);
    expect(await screen.findByTestId("dashboard-kpi-total")).toHaveTextContent(money(15));
    expect(screen.getByTestId("dashboard-kpi-count")).toHaveTextContent("1");
    await user.click(screen.getByRole("button", { name: "1 anno" }));
    expect(nav.router.replace).toHaveBeenLastCalledWith(
      "/dashboard?period=last-12-months&store=Lidl",
      { scroll: false },
    );
  });

  it("con la categoria conta solo le righe di quella categoria", async () => {
    nav.search = new URLSearchParams("period=custom&from=2026-09-01&to=2026-09-30&category=casa");
    mockDataset({ current: dataset });
    renderWithQuery(<DashboardView />);
    // Solo lo scontrino r4: la riga del detersivo (2,50 €), non il totale di 30 €.
    expect(await screen.findByTestId("dashboard-kpi-total")).toHaveTextContent(money(2.5));
  });

  it("senza scontrini per i filtri lo dice e permette di toglierli", async () => {
    const user = userEvent.setup();
    nav.search = new URLSearchParams("period=custom&from=2026-09-01&to=2026-09-30&store=Coop");
    mockDataset({ current: dataset });
    renderWithQuery(<DashboardView />);
    expect(await screen.findByText("Nessuno scontrino con questi filtri")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /Togli i filtri/ }).at(-1)!);
    expect(nav.router.replace).toHaveBeenLastCalledWith(
      "/dashboard?period=custom&from=2026-09-01&to=2026-09-30",
      { scroll: false },
    );
  });

  it("distingue il periodo vuoto dall'utente senza scontrini", async () => {
    mockDataset({ current: emptyDataset });
    const { unmount } = renderWithQuery(<DashboardView />);
    expect(await screen.findByText("Nessuna spesa nel periodo")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-kpi-total")).not.toBeInTheDocument();
    unmount();

    mockDataset({ current: emptyDataset, allTime: emptyStats });
    renderWithQuery(<DashboardView />);
    expect(await screen.findByText("Aggiungi il tuo primo scontrino")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aggiungi scontrino" })).toHaveAttribute(
      "href",
      "/add",
    );
    expect(screen.queryByTestId("dashboard-kpi-total")).not.toBeInTheDocument();
  });

  it("mostra l'errore e riprova", async () => {
    const user = userEvent.setup();
    let fail = true;
    server.use(
      http.get("*/v1/stats/dataset", () =>
        fail
          ? HttpResponse.json(
              { error: { code: "INTERNAL", message: "boom", requestId: "r1" } },
              { status: 500 },
            )
          : HttpResponse.json(dataset),
      ),
    );
    renderWithQuery(<DashboardView />);
    const [retry] = await screen.findAllByRole("button", { name: "Riprova" });
    fail = false;
    await user.click(retry);
    expect(await screen.findByTestId("dashboard-kpi-total")).toHaveTextContent(money(125));
  });

  it("scrive il periodo scelto nella query string", async () => {
    const user = userEvent.setup();
    nav.search = new URLSearchParams();
    mockDataset({ current: dataset });
    const first = renderWithQuery(<DashboardView />);
    // Predefinito: questo mese, entrambi i cursori sull'ultimo mese.
    const start = await screen.findByLabelText("Mese iniziale");
    expect(start).toHaveAttribute("aria-valuenow", "11");
    start.focus();
    await user.keyboard("{Home}");
    expect(nav.router.replace).toHaveBeenLastCalledWith("/dashboard?period=last-12-months", {
      scroll: false,
    });
    // Dagli ultimi 12 mesi, il cursore finale indietro di un mese: intervallo di mesi interi.
    nav.search = new URLSearchParams("period=last-12-months");
    first.unmount();
    renderWithQuery(<DashboardView />);
    (await screen.findByLabelText("Mese finale")).focus();
    await user.keyboard("{ArrowLeft}");
    const expected = serializeDashboardFilters(filtersFromSlider([0, 10]));
    expect(expected.get("period")).toBe("custom");
    expect(nav.router.replace).toHaveBeenLastCalledWith(`/dashboard?${expected}`, {
      scroll: false,
    });
  });

  it("le scorciatoie scelgono gli ultimi mesi fino a quello in corso", async () => {
    const user = userEvent.setup();
    nav.search = new URLSearchParams();
    mockDataset({ current: dataset });
    renderWithQuery(<DashboardView />);
    expect(await screen.findByRole("button", { name: "1 mese" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "6 mesi" }));
    expect(nav.router.replace).toHaveBeenLastCalledWith(
      `/dashboard?${serializeDashboardFilters(filtersFromSlider([6, 11]))}`,
      { scroll: false },
    );
    expect(screen.getByRole("button", { name: "6 mesi" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "1 anno" }));
    expect(nav.router.replace).toHaveBeenLastCalledWith("/dashboard?period=last-12-months", {
      scroll: false,
    });
  });

  it("due date di fila non si cancellano a vicenda", async () => {
    nav.search = new URLSearchParams("period=custom");
    mockDataset({ current: dataset });
    renderWithQuery(<DashboardView />);
    // L'URL (nav.search) non cambia: come subito dopo `router.replace`, prima del nuovo render.
    fireEvent.change(screen.getByLabelText("Dal"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Al"), { target: { value: "2026-09-30" } });
    expect(nav.router.replace).toHaveBeenLastCalledWith(
      "/dashboard?period=custom&from=2026-09-01&to=2026-09-30",
      { scroll: false },
    );
  });

  it("segnala un intervallo personalizzato al contrario senza chiedere il periodo", async () => {
    nav.search = new URLSearchParams("period=custom&from=2026-09-30&to=2026-09-01");
    const queries = mockDataset({ current: dataset });
    renderWithQuery(<DashboardView />);
    expect(
      await screen.findByText("La data finale è prima di quella iniziale."),
    ).toBeInTheDocument();
    // Parte solo lo storico della previsione, non il periodo sbagliato.
    expect(queries.map((query) => query.get("from"))).not.toContain("2026-09-30");
  });
});
