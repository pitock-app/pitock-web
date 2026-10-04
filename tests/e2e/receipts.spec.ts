import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

// Gli scontrini di esempio e gli handler MSW esistono solo in modalità mock.
test.skip(!!process.env.E2E_BASE_URL, "Richiede la modalità mock (nessun backend reale).");

/** Righe della tabella (desktop) o card (mobile), solo quelle visibili. */
const receiptItems = (page: Page) =>
  page.locator('[data-testid="receipt-row"], [data-testid="receipt-card"]').filter({
    visible: true,
  });

async function openFirstReceipt(page: Page, status = "extracted") {
  const item = receiptItems(page)
    .and(page.locator(`[data-status="${status}"]`))
    .first();
  await item.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/receipts\/[0-9a-f-]{36}$/);
}

test("modifica del totale: la lista mostra il nuovo valore", async ({ page }) => {
  await login(page, "/receipts");
  await expect(receiptItems(page)).toHaveCount(20);
  await openFirstReceipt(page);

  const total = page.getByLabel("Totale", { exact: true });
  await expect(total).toBeVisible();
  await total.fill("123,45");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByText("Modifiche salvate.")).toBeVisible();
  await expect(page.getByTestId("extraction-history-item").first()).toContainText("Modificata");

  await page
    .getByRole("link", { name: "Scontrini", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/receipts$/);
  await expect(receiptItems(page).filter({ hasText: /123,45\s€/ })).toHaveCount(1);
});

test("rilancio con un altro modello: nuova estrazione nello storico", async ({ page }) => {
  // "byok…": l'utente finto ha una chiave API per ogni provider.
  await login(page, "/receipts?source=file&status=extracted", "byok@pitock.test");
  await openFirstReceipt(page);
  const history = page.getByTestId("extraction-history-item");
  await expect(history).toHaveCount(1);

  await page.getByRole("button", { name: "Rilancia estrazione" }).click();
  const dialog = page.getByRole("dialog", { name: "Rilancia estrazione" });
  await dialog.getByLabel("Provider").selectOption("openai");
  await dialog.getByLabel(/Modello/).fill("gpt-test-e2e");
  await dialog.getByRole("button", { name: "Rilancia" }).click();
  await expect(dialog).toBeHidden();

  await expect(history).toHaveCount(2, { timeout: 15_000 });
  await expect(history.first()).toContainText("gpt-test-e2e");
  await expect(history.first()).toContainText("Corrente");
  await expect(page.getByLabel("Totale", { exact: true })).toBeVisible();
});

test("senza la chiave del provider scelto il rilancio fallisce con il motivo", async ({ page }) => {
  await login(page, "/receipts?source=camera&status=extracted");
  await openFirstReceipt(page);
  await page.getByRole("button", { name: "Rilancia estrazione" }).click();
  const dialog = page.getByRole("dialog", { name: "Rilancia estrazione" });
  await dialog.getByLabel("Provider").selectOption("openai");
  await dialog.getByRole("button", { name: "Rilancia" }).click();

  await expect(page.getByText("Estrazione non riuscita")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Non hai ancora inserito la tua chiave API.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Vai alle impostazioni" })).toBeVisible();
  // L'estrazione precedente resta e si può ancora correggere.
  await expect(page.getByTestId("extraction-history-item")).toHaveCount(1);
  await expect(page.getByLabel("Totale", { exact: true })).toBeVisible();
});

test("i filtri stanno nell'URL e sopravvivono al ricaricamento", async ({ page }) => {
  await login(page, "/receipts");
  await expect(receiptItems(page)).toHaveCount(20);

  await page.getByLabel("Categoria").selectOption("carburante");
  await expect(page).toHaveURL(/category=carburante/);
  await expect(receiptItems(page)).toHaveCount(3);
  for (const item of await receiptItems(page).all()) {
    await expect(item).toContainText("Carburante");
  }

  await page.getByLabel("Cerca esercente").fill("eni");
  await expect(page).toHaveURL(/q=eni/);

  await page.reload();
  await expect(page.getByLabel("Categoria")).toHaveValue("carburante");
  await expect(page.getByLabel("Cerca esercente")).toHaveValue("eni");
  await expect(receiptItems(page)).toHaveCount(3);

  await page.getByRole("button", { name: "Azzera filtri" }).click();
  await expect(page).toHaveURL(/\/receipts$/);
  await expect(receiptItems(page)).toHaveCount(20);
});

test("carica altri scontrini con il cursore", async ({ page }) => {
  await login(page, "/receipts");
  await expect(receiptItems(page)).toHaveCount(20);
  await page.getByRole("button", { name: "Carica altri" }).click();
  await expect(receiptItems(page)).toHaveCount(30);
  await expect(page.getByRole("button", { name: "Carica altri" })).toHaveCount(0);
  // Lo scontrino in elaborazione si aggiorna da solo.
  await expect(receiptItems(page).first()).toHaveAttribute("data-status", "extracted", {
    timeout: 15_000,
  });
});

test("eliminazione con conferma", async ({ page }) => {
  await login(page, "/receipts");
  await openFirstReceipt(page);
  const detailPath = new URL(page.url()).pathname;

  await page.getByRole("button", { name: "Elimina" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Eliminare lo scontrino?" });
  await dialog.getByRole("button", { name: "Elimina" }).click();

  await expect(page).toHaveURL(/\/receipts$/);
  await expect(page.getByText("Scontrino eliminato.")).toBeVisible();
  await expect(receiptItems(page)).toHaveCount(20);
  await expect(page.locator(`a[href="${detailPath}"]`)).toHaveCount(0);
});

test("uno scontrino manuale non si rielabora", async ({ page }) => {
  await login(page, "/receipts?source=manual");
  await openFirstReceipt(page);
  await expect(page.getByText("Inserito a mano")).toBeVisible();
  await expect(page.getByLabel("Esercente")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rilancia estrazione" })).toHaveCount(0);
});

test("senza scontrini la lista invita ad aggiungerne uno", async ({ page }) => {
  await login(page, "/receipts", "vuoto@pitock.test");
  await expect(page.getByRole("heading", { name: "Nessuno scontrino" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Aggiungi scontrino" }).click();
  await expect(page).toHaveURL(/\/add$/);
});

test("uno scontrino inesistente mostra un messaggio", async ({ page }) => {
  await login(page, "/receipts/00000000-0000-4000-8000-000000000999");
  await expect(page.getByRole("heading", { name: "Scontrino non trovato" })).toBeVisible();
});
