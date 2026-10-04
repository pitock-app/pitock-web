import { expect, test } from "@playwright/test";

type ManifestIcon = { src: string; sizes: string; type: string; purpose?: string };

test("il manifest è servito con nome e icone installabili", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: "Pitock",
    short_name: "Pitock",
    lang: "it",
    display: "standalone",
    start_url: "/dashboard",
  });

  const icons = manifest.icons as ManifestIcon[];
  for (const size of ["192x192", "512x512"]) {
    expect(icons.some((icon) => icon.sizes === size && icon.type === "image/png")).toBe(true);
  }
  expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  for (const icon of icons) {
    const file = await request.get(icon.src);
    expect(file.ok(), icon.src).toBe(true);
    expect(file.headers()["content-type"]).toContain(icon.type);
  }
});

test("le pagine collegano manifest, icona Apple e colore del tema", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
  await expect(page.locator("html")).toHaveAttribute("lang", "it");
});

test("le intestazioni di sicurezza sono presenti", async ({ request }) => {
  const response = await request.get("/login");
  const csp = response.headers()["content-security-policy"];
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toContain("unsafe-eval");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
});
