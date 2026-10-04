import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("la home porta alla dashboard dentro la shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Pitock", { exact: true }).filter({ visible: true })).toHaveCount(1);
});

test("la navigazione visibile porta alle sezioni", async ({ page, isMobile }) => {
  await page.goto("/dashboard");
  const nav = page.getByRole("navigation", { name: "Navigazione principale" }).filter({
    visible: true,
  });
  await expect(nav).toHaveCount(1);

  await nav.getByRole("link", { name: "Scontrini" }).click();
  await expect(page).toHaveURL(/\/receipts$/);
  await expect(page.getByRole("heading", { level: 1, name: "Scontrini" })).toBeVisible();

  await nav.getByRole("link", { name: isMobile ? "Aggiungi" : "Aggiungi scontrino" }).click();
  await expect(page).toHaveURL(/\/add$/);

  await nav.getByRole("link", { name: "Impostazioni" }).click();
  await expect(page).toHaveURL(/\/settings\/ai$/);
  await expect(page.getByRole("navigation", { name: "Sezioni delle impostazioni" })).toBeVisible();
});

test("il tema scuro si attiva dal pulsante", async ({ page }) => {
  await page.goto("/dashboard");
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await page.getByRole("button", { name: "Cambia tema" }).filter({ visible: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("uno scontrino inesistente mostra 'Pagina non trovata' dentro la shell", async ({ page }) => {
  await page.goto("/receipts/non-esiste");
  await expect(page.getByRole("heading", { level: 1, name: "Pagina non trovata" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navigazione principale" }).filter({ visible: true }),
  ).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Torna alla dashboard" })).toBeVisible();
});
