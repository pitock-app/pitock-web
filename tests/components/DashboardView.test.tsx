import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardView } from "@/features/dashboard";
import type { components } from "@/lib/api/schema";
import { createMockAuthProvider } from "@/lib/auth/mock-auth";
import { formatCurrency } from "@/lib/format";
import { server, setupMswServer } from "../helpers/msw-server";
import { renderWithQuery } from "../helpers/render";

type Stats = components["schemas"]["Stats"];

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
  // Intervallo fisso: settembre 2026, confrontato con i 30 giorni prima (2–31 agosto).
  nav.search = new URLSearchParams("period=custom&from=2026-09-01&to=2026-09-30");
  const auth = createMockAuthProvider();
  provider.current = auth;
  await auth.signIn("anna@pitock.test", "x");
});

const stats: Stats = {
  from: "2026-08-31T22:00:00.000Z",
  to: "2026-09-30T22:00:00.000Z",
  granularity: "month",
  totals: { total: 1234.56, nReceipts: 8, average: 154.32 },
  byCategory: [
    { category: "alimentari", total: 800, nReceipts: 4 },
    { category: "carburante", total: 300.56, nReceipts: 2 },
    { category: "ristorazione", total: 134, nReceipts: 2 },
  ],
  byPeriod: [{ period: "2026-09", total: 1234.56, nReceipts: 8 }],
  topMerchants: [
    { merchantName: "Esselunga", total: 500, nReceipts: 2 },
    { merchantName: "Eni", total: 300.56, nReceipts: 2 },
    { merchantName: "Coop", total: 200, nReceipts: 1 },
    { merchantName: "Trattoria da Mario", total: 100, nReceipts: 1 },
    { merchantName: "Bar Roma", total: 34, nReceipts: 1 },
    { merchantName: "Carrefour", total: 100, nReceipts: 1 },
  ],
  bySource: [
    { source: "camera", total: 734.56, nReceipts: 5 },
    { source: "manual", total: 500, nReceipts: 3 },
  ],
};

const emptyStats: Stats = {
  ...stats,
  totals: { total: 0, nReceipts: 0, average: 0 },
  byCategory: [],
  byPeriod: [],
  topMerchants: [],
  bySource: [],
};

/** Risposte per il periodo corrente, quello precedente (agosto) e "tutto" (senza date). */
function mockStats(responses: { current: Stats; previous?: Stats; allTime?: Stats }) {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get("*/v1/stats", ({ request }) => {
      const query = new URL(request.url).searchParams;
      queries.push(query);
      const from = query.get("from");
      if (from === null) return HttpResponse.json(responses.allTime ?? responses.current);
      if (from.startsWith("2026-08")) {
        return HttpResponse.json(
          responses.previous ?? { ...stats, totals: { total: 1000, nReceipts: 5, average: 200 } },
        );
      }
      return HttpResponse.json(responses.current);
    }),
  );
  return queries;
}

describe("DashboardView", () => {
  it("mostra KPI e grafici con i valori della risposta", async () => {
    const queries = mockStats({ current: stats });
    renderWithQuery(<DashboardView />);

    expect(await screen.findByTestId("dashboard-kpi-total")).toHaveTextContent(money(1234.56));
    expect(screen.getByTestId("dashboard-kpi-count")).toHaveTextContent("8");
    expect(screen.getByTestId("dashboard-kpi-average")).toHaveTextContent(money(154.32));
    // (1234,56 − 1000) / 1000 = +23,5%
    await waitFor(() =>
      expect(screen.getByTestId("dashboard-kpi-change")).toHaveTextContent("+23,5%"),
    );
    expect(screen.getByText("rispetto a 2–31 ago 2026")).toBeInTheDocument();

    expect(queries.map((query) => query.toString())).toEqual(
      expect.arrayContaining([
        "from=2026-09-01&to=2026-09-30&granularity=month",
        "from=2026-08-02&to=2026-08-31&granularity=month",
      ]),
    );

    const legend = screen.getByTestId("category-legend");
    expect(within(legend).getByText("Alimentari")).toBeInTheDocument();
    expect(within(legend).getByText(money(800))).toBeInTheDocument();

    // Solo i primi 5 esercenti.
    const merchants = screen.getByRole("region", { name: "Esercenti principali" });
    expect(within(merchants).getAllByRole("listitem")).toHaveLength(5);
    expect(within(merchants).getByText("Esselunga")).toBeInTheDocument();
    expect(within(merchants).queryByText("Carrefour")).not.toBeInTheDocument();

    const sources = screen.getByRole("region", { name: "Per sorgente" });
    expect(within(sources).getByText(money(734.56))).toBeInTheDocument();
    expect(within(sources).getByText(money(500))).toBeInTheDocument();

    const bars = screen.getByRole("region", { name: "Spesa per mese" });
    expect(within(bars).getByRole("rowheader", { name: "settembre 2026" })).toBeInTheDocument();
  });

  it("senza spese nel periodo precedente la variazione è n/d", async () => {
    mockStats({ current: stats, previous: emptyStats });
    renderWithQuery(<DashboardView />);
    await waitFor(() =>
      expect(screen.getByTestId("dashboard-kpi-change")).toHaveTextContent("n/d"),
    );
    expect(screen.getByText("nessuna spesa nel periodo precedente")).toBeInTheDocument();
  });

  it("se il confronto fallisce lo dice e permette di riprovare", async () => {
    const user = userEvent.setup();
    let fail = true;
    server.use(
      http.get("*/v1/stats", ({ request }) => {
        const from = new URL(request.url).searchParams.get("from") ?? "";
        if (!from.startsWith("2026-08")) return HttpResponse.json(stats);
        return fail
          ? HttpResponse.json(
              { error: { code: "INTERNAL", message: "boom", requestId: "r1" } },
              { status: 500 },
            )
          : HttpResponse.json({ ...stats, totals: { total: 1000, nReceipts: 5, average: 200 } });
      }),
    );
    renderWithQuery(<DashboardView />);
    expect(await screen.findByText("Confronto non disponibile.")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-kpi-total")).toHaveTextContent(money(1234.56));
    fail = false;
    await user.click(screen.getByRole("button", { name: "Riprova" }));
    await waitFor(() =>
      expect(screen.getByTestId("dashboard-kpi-change")).toHaveTextContent("+23,5%"),
    );
  });

  it("distingue il periodo vuoto dall'utente senza scontrini", async () => {
    mockStats({ current: emptyStats, allTime: stats });
    const { unmount } = renderWithQuery(<DashboardView />);
    expect(await screen.findByText("Nessuna spesa nel periodo")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-kpi-total")).not.toBeInTheDocument();
    unmount();

    mockStats({ current: emptyStats, allTime: emptyStats });
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
      http.get("*/v1/stats", () =>
        fail
          ? HttpResponse.json(
              { error: { code: "INTERNAL", message: "boom", requestId: "r1" } },
              { status: 500 },
            )
          : HttpResponse.json(stats),
      ),
    );
    renderWithQuery(<DashboardView />);
    const retry = await screen.findByRole("button", { name: "Riprova" });
    fail = false;
    await user.click(retry);
    expect(await screen.findByTestId("dashboard-kpi-total")).toHaveTextContent(money(1234.56));
  });

  it("scrive il periodo scelto nella query string", async () => {
    const user = userEvent.setup();
    mockStats({ current: stats });
    renderWithQuery(<DashboardView />);
    await screen.findByTestId("dashboard-kpi-total");
    await user.selectOptions(screen.getByLabelText("Periodo"), "last-month");
    expect(nav.router.replace).toHaveBeenCalledWith("/dashboard?period=last-month", {
      scroll: false,
    });
    await user.selectOptions(screen.getByLabelText("Periodo"), "this-month");
    expect(nav.router.replace).toHaveBeenLastCalledWith("/dashboard", { scroll: false });
  });

  it("due date di fila non si cancellano a vicenda", async () => {
    nav.search = new URLSearchParams("period=custom");
    mockStats({ current: stats });
    renderWithQuery(<DashboardView />);
    // L'URL (nav.search) non cambia: come subito dopo `router.replace`, prima del nuovo render.
    fireEvent.change(screen.getByLabelText("Dal"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Al"), { target: { value: "2026-09-30" } });
    expect(nav.router.replace).toHaveBeenLastCalledWith(
      "/dashboard?period=custom&from=2026-09-01&to=2026-09-30",
      { scroll: false },
    );
  });

  it("segnala un intervallo personalizzato al contrario senza chiamare l'API", async () => {
    nav.search = new URLSearchParams("period=custom&from=2026-09-30&to=2026-09-01");
    const queries = mockStats({ current: stats });
    renderWithQuery(<DashboardView />);
    expect(
      await screen.findByText("La data finale è prima di quella iniziale."),
    ).toBeInTheDocument();
    expect(queries).toHaveLength(0);
  });
});
