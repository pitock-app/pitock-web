import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/**
 * Controllo automatico di accessibilità (axe-core, WCAG 2.1 A e AA) su tutte le pagine,
 * nel tema chiaro e in quello scuro. Gira solo in modalità mock: usa i dati di esempio.
 */
test.skip(!!process.env.E2E_BASE_URL, "Richiede la modalità mock (nessun backend reale).");

const THEMES = ["light", "dark"] as const;

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // I toast di sonner compaiono e spariscono: non fanno parte della pagina controllata.
    .exclude("[data-sonner-toaster]")
    .analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes
        .slice(0, 5)
        .map(
          (node) => `    ${node.target.join(" ")} — ${node.failureSummary?.split("\n")[1] ?? ""}`,
        )
        .join("\n"),
  );
  expect(summary, summary.join("\n")).toEqual([]);
}

async function applyTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate((value) => localStorage.setItem("theme", value), theme);
  // Dopo il login il router di Next può avere ancora un refresh in volo: si attende che la
  // pagina sia ferma prima e dopo il ricaricamento, altrimenti axe perde il contesto.
  await page.waitForLoadState("networkidle");
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /light/);
}

for (const theme of THEMES) {
  test.describe(`tema ${theme === "dark" ? "scuro" : "chiaro"}`, () => {
    test("pagine pubbliche", async ({ page }) => {
      for (const path of ["/login", "/register"]) {
        await page.goto(path);
        await applyTheme(page, theme);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoViolations(page);
      }
    });

    test("dashboard, scontrini e dettaglio", async ({ page }) => {
      await login(page);
      await applyTheme(page, theme);
      await expect(page.getByTestId("dashboard-kpi-total")).toBeVisible();
      await expectNoViolations(page);

      await page.goto("/receipts");
      const items = page
        .locator('[data-testid="receipt-row"], [data-testid="receipt-card"]')
        .filter({ visible: true });
      await expect(items.first()).toBeVisible();
      await expectNoViolations(page);

      await items
        .and(page.locator('[data-status="extracted"]'))
        .first()
        .getByRole("link")
        .first()
        .click();
      await expect(page.getByRole("heading", { name: "Storico estrazioni" })).toBeVisible();
      await expectNoViolations(page);
    });

    test("inserimento: foto, file e manuale", async ({ page }) => {
      await login(page, "/add");
      await applyTheme(page, theme);
      await expect(page.getByRole("tab", { name: "Foto" })).toBeVisible();
      await expectNoViolations(page);

      await page.getByRole("tab", { name: "File" }).click();
      await expectNoViolations(page);

      await page.getByRole("tab", { name: "Manuale" }).click();
      await page.getByRole("button", { name: "Salva scontrino" }).click();
      await expect(page.getByText("Inserisci il nome dell'esercente.").first()).toBeVisible();
      await expectNoViolations(page);
    });

    test("impostazioni e onboarding", async ({ page }) => {
      await login(page, "/settings/ai");
      await applyTheme(page, theme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.getByRole("radio", { name: /La mia chiave/ }).check();
      await expectNoViolations(page);

      for (const path of ["/settings/usage", "/settings/account", "/onboarding", "/nessuna"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.waitForLoadState("networkidle");
        await expectNoViolations(page);
      }
    });
  });
}
