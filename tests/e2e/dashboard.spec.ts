import { expect, test, type Page, type Response } from "@playwright/test";
import type { components } from "../../src/lib/api/schema";
import { formatCurrency } from "../../src/lib/format";
import { login } from "./helpers";

type Dataset = components["schemas"]["StatsDataset"];

// Gli scontrini di esempio e l'utente "vuoto…" esistono solo negli handler MSW.
test.skip(!!process.env.E2E_BASE_URL, "Richiede la modalità mock (nessun backend reale).");

/** Importo come lo mostra la pagina, con gli spazi normalizzati. */
const money = (value: number) => formatCurrency(value).replace(/\s/g, " ");
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Registra le risposte di `GET /v1/stats/dataset` (servite da MSW nel service worker). */
function recordDatasets(page: Page) {
  const responses: Response[] = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.endsWith("/v1/stats/dataset")) responses.push(response);
  });
  return responses;
}

/** La risposta del periodo mostrato: quella con la data iniziale indicata. */
async function datasetFor(responses: Response[], from: string): Promise<Dataset> {
  await expect
    .poll(() => responses.some((r) => new URL(r.url()).searchParams.get("from") === from))
    .toBe(true);
  const response = responses.findLast((r) => new URL(r.url()).searchParams.get("from") === from)!;
  return (await response.json()) as Dataset;
}

async function expectKpis(page: Page, dataset: Dataset) {
  const total = round2(dataset.receipts.reduce((sum, r) => sum + (r.total ?? 0), 0));
  const count = dataset.receipts.length;
  await expect(page.getByTestId("dashboard-kpi-total")).toHaveText(money(total));
  await expect(page.getByTestId("dashboard-kpi-count")).toHaveText(String(count));
  await expect(page.getByTestId("dashboard-kpi-average")).toHaveText(money(round2(total / count)));
}

test("i valori mostrati coincidono con quelli della risposta", async ({ page }) => {
  const responses = recordDatasets(page);
  await login(page, "/dashboard?period=custom&from=2025-01-01&to=2026-12-31");

  const dataset = await datasetFor(responses, "2025-01-01");
  expect(dataset.receipts.length).toBeGreaterThan(0);
  await expectKpis(page, dataset);

  // In alto previsione e risparmio potenziale, poi le sezioni.
  await expect(page.getByTestId("forecast-projected")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Risparmio potenziale" })).toBeVisible();
  for (const name of ["In sintesi", "Andamento generale", "Prodotto per prodotto"]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }

  // Gli scontrini di esempio hanno solo righe generiche ("Articolo 1"): niente prodotti da
  // confrontare, e i grafici per prodotto lo dicono invece di inventare dati.
  const products = page.getByRole("region", { name: "Dove finiscono i soldi" });
  await expect(products.getByText(/Nessuna riga prodotto nel periodo/)).toBeVisible();

  // Le tabelle dei grafici riportano ogni mese con spese.
  const months = page.getByRole("region", { name: "Spesa per mese" });
  await months.getByText("Dati del grafico").click();
  await expect(months.getByRole("row").nth(1)).toBeVisible();
});

test("il periodo e i filtri finiscono nell'URL e aggiornano i valori", async ({ page }) => {
  const responses = recordDatasets(page);
  await login(page, "/dashboard");
  // Il mese in corso può essere vuoto (dipende dalla data): si aspetta solo il selettore.
  await expect(page.getByLabel("Dal", { exact: true })).toBeVisible();

  // Le date personalizzate sono sempre disponibili, anche oltre l'anno dello slider.
  await page.getByLabel("Dal", { exact: true }).fill("2025-01-01");
  await page.getByLabel("Al", { exact: true }).fill("2026-12-31");
  await expect(page).toHaveURL(/period=custom&from=2025-01-01&to=2026-12-31$/);
  const dataset = await datasetFor(responses, "2025-01-01");
  await expectKpis(page, dataset);

  // Filtro per negozio: tutti i valori si ricalcolano e il filtro va nell'URL.
  await page.getByLabel("Negozio").selectOption("Esselunga");
  await expect(page).toHaveURL(/store=Esselunga/);
  await expectKpis(page, {
    ...dataset,
    receipts: dataset.receipts.filter((r) => r.merchantName === "Esselunga"),
  });
  await page
    .getByRole("button", { name: /Togli i filtri/ })
    .first()
    .click();
  await expect(page).not.toHaveURL(/store=/);

  // Lo slider copre l'ultimo anno: cursori sul mese in corso, poi l'iniziale in fondo a sinistra.
  const start = page.getByRole("slider", { name: "Mese iniziale" });
  await start.focus();
  await page.keyboard.press("End");
  await expect(page).toHaveURL(/\/dashboard$/);
  await start.focus();
  await page.keyboard.press("Home");
  await expect(page).toHaveURL(/\/dashboard\?period=last-12-months$/);
  await expect(page.getByRole("heading", { name: "Spesa per mese" })).toBeVisible();
});

test("senza scontrini invita ad aggiungere il primo", async ({ page }) => {
  await login(page, "/dashboard", "vuoto-dashboard@pitock.test");
  await expect(
    page.getByRole("heading", { name: "Aggiungi il tuo primo scontrino" }),
  ).toBeVisible();
  await expect(page.getByTestId("dashboard-kpi-total")).toHaveCount(0);
  await page.getByRole("main").getByRole("link", { name: "Aggiungi scontrino" }).click();
  await expect(page).toHaveURL(/\/add$/);
});
