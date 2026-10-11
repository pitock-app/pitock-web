import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.skip(!!process.env.E2E_BASE_URL, "Richiede la modalità mock (nessun backend reale).");

test("gli script hanno il nonce della CSP, diverso a ogni richiesta, e nessuna violazione", async ({
  page,
}) => {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy|CSP/i.test(msg.text())) violations.push(msg.text());
  });
  const res = await page.goto("/login");
  const csp = res?.headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  const scripts = await page
    .locator("script")
    .evaluateAll((els) => els.map((el) => (el as HTMLScriptElement).nonce));
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.every((n) => n === nonce)).toBe(true);
  const second = await page.request.get("/login");
  expect(second.headers()["content-security-policy"]).not.toBe(csp);
  await login(page, "/dashboard?period=custom&from=2025-01-01&to=2026-12-31");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.goto("/receipts");
  await page.goto("/add");
  await page.waitForTimeout(1000);
  expect(violations).toEqual([]);
});
