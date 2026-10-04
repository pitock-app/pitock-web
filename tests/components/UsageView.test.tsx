import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsageView } from "@/features/settings";
import type { components } from "@/lib/api/schema";
import { createMockAuthProvider } from "@/lib/auth/mock-auth";
import { server, setupMswServer } from "../helpers/msw-server";
import { renderWithQuery } from "../helpers/render";

type Schemas = components["schemas"];

const provider = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getAuthProvider: () => provider.current,
}));

setupMswServer();

beforeEach(async () => {
  const auth = createMockAuthProvider();
  provider.current = auth;
  await auth.signIn("anna@pitock.test", "x");
});

const summary: Schemas["UsageSummary"] = {
  from: "2026-09-30T22:00:00.000Z",
  to: "2026-10-04T10:00:00.000Z",
  totals: { calls: 7, inputTokens: 12345, outputTokens: 2100, costUsd: 0.0421, unpricedCalls: 2 },
  series: [
    {
      key: "2026-10-01",
      calls: 3,
      inputTokens: 5000,
      outputTokens: 900,
      costUsd: 0.02,
      unpricedCalls: 0,
    },
    {
      key: "2026-10-03",
      calls: 4,
      inputTokens: 7345,
      outputTokens: 1200,
      costUsd: 0.0221,
      unpricedCalls: 2,
    },
  ],
  byModel: [
    {
      provider: "anthropic",
      model: "claude-haiku-4-5",
      calls: 5,
      inputTokens: 9000,
      outputTokens: 1500,
      costUsd: 0.0421,
      unpricedCalls: 0,
    },
    {
      provider: "openrouter",
      model: "meta-llama/llama-4-scout",
      calls: 2,
      inputTokens: 3345,
      outputTokens: 600,
      costUsd: 0,
      unpricedCalls: 2,
    },
  ],
};

describe("UsageView", () => {
  it("mostra i KPI e le tabelle con i valori della risposta", async () => {
    let query: URLSearchParams | undefined;
    server.use(
      http.get("*/v1/usage", ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json(summary);
      }),
    );
    renderWithQuery(<UsageView />);
    const kpis = await screen.findByRole("region", { name: "Totali del periodo" });
    expect(within(kpis).getByText("7")).toBeInTheDocument();
    expect(within(kpis).getByText("12.345")).toBeInTheDocument();
    expect(within(kpis).getByText("2100")).toBeInTheDocument();
    expect(within(kpis).getByText("0,04 USD")).toBeInTheDocument();
    expect(
      within(kpis).getByText("2 chiamate senza prezzo noto non sono incluse."),
    ).toBeInTheDocument();
    expect(query?.get("groupBy")).toBe("day");
    expect(query?.get("from")).toMatch(/^\d{4}-\d{2}-01$/);

    const models = screen.getByRole("table", { name: "Per modello" });
    const rows = within(models).getAllByRole("row");
    expect(within(rows[1]).getByText("claude-haiku-4-5")).toBeInTheDocument();
    expect(within(rows[1]).getByText("10.500")).toBeInTheDocument();
    // Modello senza prezzo: costo non disponibile.
    expect(within(rows[2]).getByText("n/d")).toBeInTheDocument();
  });

  it("cambiando periodo richiede un altro intervallo", async () => {
    const user = userEvent.setup();
    const froms: string[] = [];
    server.use(
      http.get("*/v1/usage", ({ request }) => {
        froms.push(new URL(request.url).searchParams.get("from") ?? "");
        return HttpResponse.json(summary);
      }),
    );
    renderWithQuery(<UsageView />);
    await screen.findByRole("region", { name: "Totali del periodo" });
    await user.selectOptions(screen.getByLabelText("Periodo"), "all");
    await vi.waitFor(() => expect(froms).toContain("2000-01-01"));
  });

  it("mostra le ultime chiamate con il link allo scontrino", async () => {
    renderWithQuery(<UsageView />);
    const calls = await screen.findByRole("table", { name: "Ultime chiamate" });
    const links = within(calls).getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", expect.stringMatching(/^\/receipts\//));
    expect(within(calls).getAllByText("Estrazione").length).toBeGreaterThan(0);
    // Scontrini di esempio letti dall'LLM (i manuali non hanno chiamate): meno di una pagina.
    expect(within(calls).getAllByRole("row").length).toBeGreaterThan(10);
    expect(screen.queryByRole("button", { name: "Carica altre" })).not.toBeInTheDocument();
  });

  it("senza chiamate mostra lo stato vuoto", async () => {
    server.use(
      http.get("*/v1/usage", () =>
        HttpResponse.json({
          ...summary,
          totals: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, unpricedCalls: 0 },
          series: [],
          byModel: [],
        }),
      ),
    );
    renderWithQuery(<UsageView />);
    expect(await screen.findByText("Nessun consumo nel periodo")).toBeInTheDocument();
  });

  it("in caso di errore offre Riprova", async () => {
    server.use(
      http.get("*/v1/usage", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL", message: "boom", requestId: "r1" } },
          { status: 500 },
        ),
      ),
    );
    renderWithQuery(<UsageView />);
    const alert = await screen.findByText("Errore del server. Riprova tra poco.");
    expect(alert.closest("[role=alert]")).not.toBeNull();
  });
});
