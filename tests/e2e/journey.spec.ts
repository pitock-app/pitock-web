import { expect, test, type Page } from "@playwright/test";
import { login, openSettings, visibleUserEmail, E2E_EMAIL } from "./helpers";

/**
 * Percorso completo che non dipende dai dati finti: gira in modalità mock e contro il
 * backend di sviluppo (`E2E_BASE_URL`, `E2E_EMAIL`, `E2E_PASSWORD`). Crea il proprio
 * scontrino con un nome unico e alla fine lo elimina.
 * Si naviga solo dentro l'app: in modalità mock i dati vivono in memoria e un
 * caricamento della pagina li azzererebbe.
 */

/** Navigazione principale visibile (sidebar su desktop, bottom nav su mobile). */
async function goTo(page: Page, section: "Dashboard" | "Scontrini") {
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .filter({ visible: true })
    .getByRole("link", { name: section, exact: true })
    .click();
}

async function searchMerchant(page: Page, merchant: string) {
  await goTo(page, "Scontrini");
  await expect(page).toHaveURL(/\/receipts$/);
  await page.getByLabel("Cerca esercente").fill(merchant);
  await expect(page).toHaveURL(/[?&]q=/);
}

const receiptItems = (page: Page) =>
  page.locator('[data-testid="receipt-row"], [data-testid="receipt-card"]').filter({
    visible: true,
  });

test("inserimento, correzione, lista, dashboard, impostazioni ed eliminazione", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const merchant = `E2E ${testInfo.project.name} ${Date.now()}`;

  await login(page, "/add");
  await expect(visibleUserEmail(page)).toHaveText(E2E_EMAIL.toLowerCase());

  // Inserimento manuale.
  await page.getByRole("tab", { name: "Manuale" }).click();
  await page.getByLabel("Esercente").fill(merchant);
  await page.getByLabel("Totale", { exact: true }).fill("12,34");
  await page.getByLabel("Categoria").selectOption("alimentari");
  await page.getByLabel("Metodo di pagamento").selectOption("bancomat");
  await page.getByRole("button", { name: "Salva scontrino" }).click();
  await page.getByRole("link", { name: "Apri scontrino" }).click();
  await expect(page).toHaveURL(/\/receipts\/[0-9a-f-]{36}$/);

  // Correzione del totale.
  const total = page.getByLabel("Totale", { exact: true });
  await expect(total).toHaveValue("12,34");
  await total.fill("56,78");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByText("Modifiche salvate.")).toBeVisible();

  // La lista, filtrata per esercente, mostra il nuovo totale.
  await searchMerchant(page, merchant);
  await expect(receiptItems(page)).toHaveCount(1);
  await expect(receiptItems(page).first()).toContainText(/56,78\s€/);

  // La dashboard del mese corrente non è vuota.
  await goTo(page, "Dashboard");
  await expect(page.getByTestId("dashboard-kpi-total")).toBeVisible({ timeout: 15_000 });

  // Impostazioni, dal menu account.
  await openSettings(page);
  await expect(page).toHaveURL(/\/settings\/ai$/);
  await expect(page.getByRole("radio", { name: /Pitock AI/ })).toBeVisible();
  const settingsNav = page.getByRole("navigation", { name: "Sezioni delle impostazioni" });
  await settingsNav.getByRole("link", { name: "Consumo token" }).click();
  await expect(page).toHaveURL(/\/settings\/usage$/);
  await settingsNav.getByRole("link", { name: "Account" }).click();
  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(
    page.getByText(E2E_EMAIL.toLowerCase()).filter({ visible: true }).first(),
  ).toBeVisible();

  // Eliminazione.
  await searchMerchant(page, merchant);
  await receiptItems(page).first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/receipts\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Elimina" }).click();
  await page
    .getByRole("alertdialog", { name: "Eliminare lo scontrino?" })
    .getByRole("button", { name: "Elimina" })
    .click();
  await expect(page.getByText("Scontrino eliminato.")).toBeVisible();
  await searchMerchant(page, merchant);
  await expect(page.getByText("Nessuno scontrino con questi filtri")).toBeVisible();
});
