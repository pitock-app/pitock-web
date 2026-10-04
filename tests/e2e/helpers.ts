import { expect, type Page } from "@playwright/test";

/** Credenziali: in modalità mock va bene qualunque coppia; contro un backend reale servono E2E_EMAIL / E2E_PASSWORD. */
export const E2E_EMAIL = process.env.E2E_EMAIL ?? "demo@pitock.test";
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "password-demo";

export async function login(page: Page, path = "/dashboard", email = E2E_EMAIL) {
  await page.goto(`/login?next=${encodeURIComponent(path)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Accedi" }).click();
  const escaped = path.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  await expect(page).toHaveURL(new RegExp(`${escaped}$`));
}

/** L'email dell'utente visibile nella shell (sidebar su desktop, header su mobile). */
export function visibleUserEmail(page: Page) {
  return page.getByTestId("user-email").filter({ visible: true });
}

/** Apre il menu account (clic sul nome utente) e sceglie una voce delle impostazioni. */
export async function openSettings(page: Page, item = "Provider AI") {
  await page
    .getByRole("button", { name: /^Menu account/ })
    .filter({ visible: true })
    .click();
  await page.getByRole("menuitem", { name: item }).click();
}
