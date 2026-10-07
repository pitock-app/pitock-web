import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

// Chiavi, modelli e consumo finti esistono solo negli handler MSW della modalità mock.
test.skip(!!process.env.E2E_BASE_URL, "Richiede la modalità mock (nessun backend reale).");

/**
 * Tutto ciò che nella pagina contiene "sk-": testo, valori dei campi e attributi.
 * Le classi sono escluse perché le icone hanno nomi come "lucide-flask-conical".
 */
function secretsInPage(page: Page) {
  return page.evaluate(() => {
    const found: string[] = [];
    if (document.body.innerText.includes("sk-")) found.push("testo");
    for (const element of document.querySelectorAll("*")) {
      if (element instanceof HTMLInputElement && element.value.includes("sk-")) {
        found.push(`valore di ${element.id}`);
      }
      for (const attribute of element.attributes) {
        if (attribute.name !== "class" && attribute.value.includes("sk-")) {
          found.push(`${attribute.name} di ${element.tagName}`);
        }
      }
    }
    return found;
  });
}

async function openByok(page: Page, provider: string) {
  await login(page, "/settings/ai");
  await page.getByRole("radio", { name: /La mia chiave/ }).check();
  await page.getByLabel("Provider", { exact: true }).selectOption({ label: provider });
}

async function saveKey(page: Page, key: string) {
  await page.getByLabel("Chiave API", { exact: true }).fill(key);
  await page.getByRole("button", { name: "Verifica e salva" }).click();
}

test("una chiave non valida mostra l'errore e non viene salvata", async ({ page }) => {
  await openByok(page, "OpenAI");
  await saveKey(page, "sk-invalid-000000000000");
  await expect(page.getByText("La tua chiave API non è valida.")).toBeVisible();
  await expect(page.getByTestId("api-key-masked")).toHaveCount(0);
  await expect(page.getByText("Salva la chiave per vedere i modelli disponibili.")).toBeVisible();
});

test("dopo il salvataggio il DOM contiene solo le ultime 4 cifre", async ({ page }) => {
  await openByok(page, "OpenAI");
  await saveKey(page, "sk-proj-abcdefghijklmnop4321");
  await expect(page.getByTestId("api-key-masked")).toHaveText("•••• 4321");
  await expect(page.getByLabel("Chiave API", { exact: true })).toHaveCount(0);
  expect(await secretsInPage(page)).toEqual([]);
  // Nemmeno nello storage del browser.
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toContain("sk-");
  const cookies = await page.context().cookies();
  expect(cookies.filter((cookie) => cookie.value.includes("sk-"))).toEqual([]);
});

test("cambiare il modello aggiorna /v1/settings/ai", async ({ page }) => {
  await openByok(page, "OpenAI");
  await saveKey(page, "sk-proj-abcdefghijklmnop4321");
  await expect(page.getByTestId("api-key-masked")).toBeVisible();

  const combobox = page.getByRole("combobox", { name: "Modello preferito" });
  await combobox.click();
  await combobox.fill("gpt-5");
  await page.getByRole("option", { name: /^GPT-5 gpt-5 / }).click();
  await expect(combobox).toHaveValue("GPT-5 (gpt-5)");

  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/v1/settings/ai") && response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Salva impostazioni" }).click();
  const response = await saved;
  expect(await response.json()).toMatchObject({ mode: "byok", provider: "openai", model: "gpt-5" });
  await expect(page.getByText("Impostazioni salvate.")).toBeVisible();

  // Il valore resta salvato tornando sulla pagina (navigazione interna: il mock è in memoria).
  await page.getByRole("link", { name: "Consumo token" }).click();
  await expect(page).toHaveURL(/\/settings\/usage$/);
  await page.getByRole("link", { name: "Provider AI" }).click();
  await expect(page.getByRole("combobox", { name: "Modello preferito" })).toHaveValue(
    "GPT-5 (gpt-5)",
  );
  await expect(page.getByRole("radio", { name: /La mia chiave/ })).toBeChecked();

  // La prova della configurazione finisce nel consumo.
  await page.getByRole("button", { name: "Prova configurazione" }).click();
  await expect(page.getByText(/Funziona: OpenAI · gpt-5/)).toBeVisible();
  await page.getByRole("link", { name: "Consumo token" }).click();
  await expect(
    page
      .getByRole("region", { name: "Ultime chiamate" })
      .getByText("Prova chiave")
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
});

test("consumo token: KPI, grafico, modelli e ultime chiamate", async ({ page }) => {
  await login(page, "/settings/usage");
  await page.getByLabel("Periodo", { exact: true }).selectOption("all");
  const kpis = page.getByRole("region", { name: "Totali del periodo" });
  await expect(kpis.getByText("Chiamate")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Token per giorno" })).toBeVisible();
  // Tabella su desktop, card su mobile: si cerca dentro la sezione.
  await expect(
    page
      .getByRole("region", { name: "Per modello" })
      .getByText("claude-haiku-4-5")
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  const calls = page.getByRole("region", { name: "Ultime chiamate" });
  await calls.getByRole("link").filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/receipts\/[0-9a-f-]{36}$/);
});

test("eliminazione dell'account: conferma ELIMINA, logout e login", async ({ page }) => {
  await login(page, "/settings/account");
  await expect(page.getByText("demo@pitock.test").filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Elimina account" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Scrivi ELIMINA per confermare").fill("ELIMINA");
  await dialog.getByRole("button", { name: "Elimina definitivamente" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("onboarding: due scelte e accesso alle impostazioni AI", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Email").fill("onboarding@pitock.test");
  await page.getByLabel("Password", { exact: true }).fill("password-sicura");
  await page.getByLabel("Conferma password").fill("password-sicura");
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: "Registrati" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Usa Pitock AI" })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    /\d+ \/ 100 scontrini questo mese/,
  );
  await page.getByRole("link", { name: "Configura la chiave" }).click();
  await expect(page).toHaveURL(/\/settings\/ai$/);
  await expect(page.getByRole("radio", { name: /Pitock AI/ })).toBeChecked();
});
