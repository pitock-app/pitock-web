import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

// Gli upload finti e gli handler MSW esistono solo in modalità mock.
test.skip(!!process.env.E2E_BASE_URL, "Richiede la modalità mock (nessun backend reale).");

const publicFile = (name: string) => readFileSync(path.join(process.cwd(), "public", name));

const fixtures = {
  png: { name: "spesa.png", mimeType: "image/png", buffer: publicFile("logo.png") },
  png2: { name: "bar.png", mimeType: "image/png", buffer: publicFile("icons/icon-512.png") },
  pdf: {
    name: "farmacia.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% scontrino di prova e2e\n%%EOF\n"),
  },
};

async function openTab(page: Page, name: "Foto" | "File" | "Manuale") {
  await page.getByRole("tab", { name }).click();
  await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
}

const queueItems = (page: Page) => page.getByTestId("upload-queue-item");

test.beforeEach(async ({ page }) => {
  await login(page, "/add");
});

test("tre file passano da elaborazione a pronto", async ({ page }) => {
  await openTab(page, "File");
  await page.getByTestId("file-input").setInputFiles([fixtures.png, fixtures.png2, fixtures.pdf]);

  await expect(queueItems(page)).toHaveCount(3);
  for (const item of await queueItems(page).all()) {
    await expect(item.getByText("In elaborazione")).toBeVisible();
  }
  for (const item of await queueItems(page).all()) {
    await expect(item.getByText("Pronto")).toBeVisible({ timeout: 15_000 });
    await expect(item.getByRole("link", { name: "Apri" })).toBeVisible();
    await expect(item.getByRole("link", { name: "Correggi" })).toBeVisible();
  }
  await expect(queueItems(page).filter({ hasText: "spesa.jpg" })).toHaveCount(0);
});

test("lo stesso file caricato due volte risulta duplicato", async ({ page }) => {
  await openTab(page, "File");
  const input = page.getByTestId("file-input");
  await input.setInputFiles([fixtures.pdf]);
  await expect(queueItems(page).first().getByText("Pronto")).toBeVisible({ timeout: 15_000 });

  await input.setInputFiles([fixtures.pdf]);
  const second = queueItems(page).nth(1);
  await expect(second.getByText("Duplicato")).toBeVisible({ timeout: 15_000 });
  await expect(second.getByRole("link", { name: "Vedi lo scontrino già caricato" })).toBeVisible();
});

test("i file non ammessi vengono scartati con un messaggio", async ({ page }) => {
  await openTab(page, "File");
  await page
    .getByTestId("file-input")
    .setInputFiles([{ name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("ciao") }]);
  await expect(
    page.getByRole("alert").filter({ hasText: "Alcuni file non sono stati aggiunti" }),
  ).toContainText("note.txt: tipo di file non ammesso");
  await expect(queueItems(page)).toHaveCount(0);
});

test("un errore di estrazione mostra il motivo e permette di eliminare", async ({ page }) => {
  await openTab(page, "File");
  await page
    .getByTestId("file-input")
    .setInputFiles([{ ...fixtures.pdf, name: "non-scontrino.pdf" }]);
  const item = queueItems(page).first();
  await expect(item.getByText("Non sembra uno scontrino.")).toBeVisible({ timeout: 15_000 });
  await item.getByRole("button", { name: "Elimina" }).click();
  await expect(queueItems(page)).toHaveCount(0);
});

test("dal tab Foto una foto entra nella coda come Foto", async ({ page }) => {
  await openTab(page, "Foto");
  await page.getByLabel("Carica una foto").setInputFiles([fixtures.png]);
  await expect(page.getByRole("img", { name: "Anteprima della foto" })).toBeVisible();
  await page.getByRole("button", { name: "Ruota 90°" }).click();
  await page.getByRole("button", { name: "Usa questa foto" }).click();

  const item = queueItems(page).first();
  await expect(item).toContainText("Foto ·");
  await expect(item.getByText("Pronto")).toBeVisible({ timeout: 15_000 });
});

test("inserimento manuale con righe e totale calcolato", async ({ page }) => {
  await openTab(page, "Manuale");
  await page.getByLabel("Esercente").fill("Panetteria Rossi");
  await page.getByLabel("Categoria").selectOption("alimentari");
  await page.getByLabel("Metodo di pagamento").selectOption("bancomat");
  await page.getByRole("button", { name: "Aggiungi riga" }).click();
  const row = page.getByRole("group", { name: "Riga 1" });
  await row.getByLabel("Descrizione").fill("Pane");
  await row.getByLabel("Importo").fill("2,35");
  await page.getByRole("button", { name: "Calcola totale dalle righe" }).click();
  await expect(page.getByLabel("Totale", { exact: true })).toHaveValue("2,35");

  await page.getByRole("button", { name: "Salva scontrino" }).click();
  await expect(page.getByRole("link", { name: "Apri scontrino" })).toBeVisible();
  await expect(page.getByLabel("Esercente")).toHaveValue("");
});

test("al logout la coda dell'utente viene svuotata", async ({ page, isMobile }) => {
  await openTab(page, "File");
  await page.getByTestId("file-input").setInputFiles([fixtures.pdf]);
  await expect(queueItems(page)).toHaveCount(1);

  await page
    .getByRole("button", { name: isMobile ? "Esci" : /Esci/ })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, "/add");
  await openTab(page, "File");
  await expect(page.getByText("Nessun file in coda.", { exact: false })).toBeVisible();
});
