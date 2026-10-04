import { expect, test } from "@playwright/test";
import { E2E_EMAIL, login, visibleUserEmail } from "./helpers";

test("chi non è autenticato e apre /dashboard va a /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(page.getByRole("heading", { level: 1, name: "Accedi" })).toBeVisible();
});

test("i campi del login sono validati", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("non-una-email");
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByText("Inserisci un indirizzo email valido.")).toBeVisible();
  await expect(page.getByText("Inserisci la password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("dopo il login torna alla pagina richiesta e mostra l'email da /v1/me", async ({ page }) => {
  await login(page, "/receipts");
  await expect(visibleUserEmail(page)).toHaveText(E2E_EMAIL);

  // Con la sessione attiva /login riporta alla dashboard.
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("il logout chiude la sessione", async ({ page, isMobile }) => {
  await login(page);
  await page
    .getByRole("button", { name: isMobile ? "Esci" : /Esci/ })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
});

test("la registrazione porta all'onboarding", async ({ page }) => {
  test.skip(
    !!process.env.E2E_BASE_URL,
    "Contro un backend reale la registrazione crea un utente vero.",
  );
  await page.goto("/register");
  await page.getByLabel("Email").fill("nuovo@pitock.test");
  await page.getByLabel("Password", { exact: true }).fill("password-sicura");
  await page.getByLabel("Conferma password").fill("password-sicura");
  await page.getByRole("button", { name: "Registrati" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("link", { name: "Salta per ora" }).click();
  await expect(visibleUserEmail(page)).toHaveText("nuovo@pitock.test");
});
