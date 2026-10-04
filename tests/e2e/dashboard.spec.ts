import { expect, test, type Page, type Response } from "@playwright/test";
import type { components } from "../../src/lib/api/schema";
import { formatCurrency } from "../../src/lib/format";
import { login } from "./helpers";

type Stats = components["schemas"]["Stats"];

// Gli scontrini di esempio e l'utente "vuoto…" esistono solo negli handler MSW.
test.skip(!!process.env.E2E_BASE_URL, "Richiede la modalità mock (nessun backend reale).");

/** Importo come lo mostra la pagina, con gli spazi normalizzati. */
const money = (value: number) => formatCurrency(value).replace(/\s/g, " ");

/** Registra le risposte di `GET /v1/stats` (servite da MSW nel service worker). */
function recordStats(page: Page) {
  const responses: Response[] = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.endsWith("/v1/stats")) responses.push(response);
  });
  return responses;
}

/** La risposta del periodo mostrato: quella con la data iniziale indicata. */
async function statsFor(responses: Response[], from: string): Promise<Stats> {
  await expect
    .poll(() => responses.some((r) => new URL(r.url()).searchParams.get("from") === from))
    .toBe(true);
  const response = responses.findLast((r) => new URL(r.url()).searchParams.get("from") === from)!;
  return (await response.json()) as Stats;
}

async function expectKpis(page: Page, stats: Stats) {
  await expect(page.getByTestId("dashboard-kpi-total")).toHaveText(money(stats.totals.total));
  await expect(page.getByTestId("dashboard-kpi-count")).toHaveText(String(stats.totals.nReceipts));
  await expect(page.getByTestId("dashboard-kpi-average")).toHaveText(money(stats.totals.average));
}

test("i valori mostrati coincidono con quelli della risposta", async ({ page }) => {
  const responses = recordStats(page);
  await login(page, "/dashboard?period=custom&from=2025-01-01&to=2026-12-31");

  const stats = await statsFor(responses, "2025-01-01");
  expect(stats.totals.nReceipts).toBeGreaterThan(0);
  await expectKpis(page, stats);

  const merchants = page.getByRole("region", { name: "Esercenti principali" });
  await expect(merchants.getByRole("listitem")).toHaveCount(Math.min(stats.topMerchants.length, 5));
  for (const merchant of stats.topMerchants.slice(0, 5)) {
    await expect(merchants.getByText(merchant.merchantName, { exact: true })).toBeVisible();
  }

  const sources = page.getByRole("region", { name: "Per sorgente" });
  for (const source of stats.bySource) {
    await expect(sources.getByText(money(source.total), { exact: true })).toBeVisible();
  }

  // Le tabelle dei grafici riportano ogni categoria e ogni mese con spese.
  const categories = page.getByRole("region", { name: "Per categoria" });
  await categories.getByText("Dati del grafico").click();
  await expect(categories.getByRole("table").getByRole("row")).toHaveCount(
    stats.byCategory.length + 1,
  );
  const months = page.getByRole("region", { name: "Spesa per mese" });
  await months.getByText("Dati del grafico").click();
  for (const row of stats.byPeriod) {
    await expect(
      months
        .getByRole("row")
        .filter({ hasText: money(row.total) })
        .first(),
    ).toBeVisible();
  }
});

test("il periodo scelto finisce nell'URL e aggiorna i valori", async ({ page }) => {
  const responses = recordStats(page);
  await login(page, "/dashboard");
  // Il mese in corso può essere vuoto (dipende dalla data): si aspetta solo il selettore.
  await expect(page.getByLabel("Dal", { exact: true })).toBeVisible();

  // Le date personalizzate sono sempre disponibili, anche oltre l'anno dello slider.
  await page.getByLabel("Dal", { exact: true }).fill("2025-01-01");
  await page.getByLabel("Al", { exact: true }).fill("2026-12-31");
  await expect(page).toHaveURL(/period=custom&from=2025-01-01&to=2026-12-31$/);
  await expectKpis(page, await statsFor(responses, "2025-01-01"));
  // Mesi interi: i 24 mesi subito prima, 2023 e 2024.
  await statsFor(responses, "2023-01-01");

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
