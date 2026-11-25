import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

// Gli scontrini classificati per evitabilità esistono solo negli handler MSW.
test.skip(!!process.env.E2E_BASE_URL, "Richiede la modalità mock (nessun backend reale).");

const DASHBOARD = "/dashboard?period=custom&from=2025-01-01&to=2026-12-31";

/** Tutte le card della dashboard aperte (nessun chevron chiuso). */
async function expectAllCardsOpen(page: Page) {
  const toggles = page.locator("button[aria-controls$='-body']");
  await expect(toggles.first()).toBeVisible();
  await expect(toggles.and(page.locator("[aria-expanded='false']"))).toHaveCount(0);
}

async function openEssential(page: Page) {
  await login(page, DASHBOARD);
  const card = page.getByRole("region", { name: "Indice di evitabilità" });
  await card.scrollIntoViewIfNeeded();
  await card
    .getByTestId("avoidability-legend")
    .getByRole("button", { name: /Essenziale/ })
    .click();
  await expect(page).toHaveURL(/avoid=essenziale/);
  await expect(card.getByTestId("avoidability-purchases-total")).toBeVisible();
  return card;
}

for (const how of ["pulsante Indietro", "indietro del browser"] as const) {
  test(`dallo scontrino, ${how} riporta al livello aperto con lo stesso scroll`, async ({
    page,
  }) => {
    const card = await openEssential(page);
    const purchase = card.getByRole("link").first();
    await purchase.scrollIntoViewIfNeeded();
    const scrollY = await page.evaluate(() => window.scrollY);
    await purchase.click();
    await expect(page).toHaveURL(/\/receipts\//);

    if (how === "pulsante Indietro") await page.getByRole("button", { name: "Indietro" }).click();
    else await page.goBack();

    await expect(page).toHaveURL(/\/dashboard\?.*avoid=essenziale/);
    await expect(card.getByTestId("avoidability-purchases-total")).toBeVisible();
    await expectAllCardsOpen(page);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollY - 150);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(scrollY + 150);

    // Un altro passo indietro richiude il livello e resta nella dashboard.
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard\?/);
    await expect(page).not.toHaveURL(/avoid=/);
    await expect(card.getByTestId("avoidability-legend")).toBeVisible();
  });
}

test('"Tutti i livelli" chiude il livello come l\'indietro del sistema', async ({ page }) => {
  const historyIndex = () =>
    page.evaluate(
      () =>
        (window as unknown as { navigation: { currentEntry: { index: number } } }).navigation
          .currentEntry.index,
    );
  const card = await openEssential(page);
  const opened = await historyIndex();
  await card.getByRole("button", { name: "Tutti i livelli" }).click();
  await expect(page).not.toHaveURL(/avoid=/);
  await expect(card.getByTestId("avoidability-legend")).toBeVisible();
  // Torna alla voce di prima invece di aggiungerne una: nessun passo doppio nella cronologia.
  expect(await historyIndex()).toBe(opened - 1);
});

test("scontrino aperto da un link diretto: Indietro porta all'elenco", async ({ page }) => {
  await login(page, "/receipts");
  const href = await page.locator("a[href^='/receipts/']").first().getAttribute("href");
  await page.goto("about:blank");
  await page.goto(href!);
  await page.getByRole("button", { name: "Indietro" }).click();
  await expect(page).toHaveURL(/\/receipts$/);
});
