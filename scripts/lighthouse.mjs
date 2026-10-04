/**
 * Punteggio di accessibilità Lighthouse di /add e /dashboard (soglia 90).
 *
 * Senza LIGHTHOUSE_BASE_URL avvia `next start` sulla build esistente, che deve essere
 * in modalità mock: `NEXT_PUBLIC_API_MOCKING=true pnpm build && pnpm lighthouse`.
 * Con LIGHTHOUSE_BASE_URL misura un deploy già avviato (serve LIGHTHOUSE_COOKIE con i
 * cookie di sessione, "nome=valore; nome=valore", copiati dal browser).
 * Usa il Chromium installato da Playwright.
 */
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const PAGES = ["/add", "/dashboard"];
const THRESHOLD = 90;
const PORT = Number(process.env.LIGHTHOUSE_PORT ?? 3200);
const external = process.env.LIGHTHOUSE_BASE_URL;
const baseUrl = external ?? `http://localhost:${PORT}`;
// In modalità mock basta il cookie della sessione finta (email codificata).
const cookie =
  process.env.LIGHTHOUSE_COOKIE ??
  `pitock-mock-session=${encodeURIComponent("lighthouse@pitock.test")}`;

/** Mette i cookie nel browser (non basta l'header: anche il JavaScript dell'app legge la sessione). */
async function setCookies(port) {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const cookies = cookie.split(";").map((pair) => {
    const [name, ...rest] = pair.trim().split("=");
    return { name, value: rest.join("="), url: baseUrl };
  });
  await browser.contexts()[0].addCookies(cookies);
  await browser.close();
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // non ancora pronto
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Il server ${url} non risponde`);
}

const server = external
  ? null
  : spawn("node_modules/.bin/next", ["start", "--port", String(PORT)], { stdio: "ignore" });

let chrome;
let failed = false;
try {
  await waitForServer(`${baseUrl}/login`);
  chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless=new", "--no-sandbox"],
  });
  await setCookies(chrome.port);

  for (const formFactor of ["mobile", "desktop"]) {
    for (const path of PAGES) {
      const result = await lighthouse(
        `${baseUrl}${path}`,
        {
          port: chrome.port,
          onlyCategories: ["accessibility"],
          logLevel: "error",
        },
        formFactor === "desktop"
          ? (await import("lighthouse/core/config/desktop-config.js")).default
          : undefined,
      );
      const lhr = result.lhr;
      if (lhr.finalDisplayedUrl && !lhr.finalDisplayedUrl.endsWith(path)) {
        throw new Error(`${path} è stata rediretta a ${lhr.finalDisplayedUrl}: sessione mancante?`);
      }
      const score = Math.round((lhr.categories.accessibility.score ?? 0) * 100);
      const ok = score >= THRESHOLD;
      failed ||= !ok;
      console.log(`${ok ? "✔" : "✘"} ${formFactor.padEnd(7)} ${path.padEnd(12)} ${score}`);
      for (const audit of Object.values(lhr.audits)) {
        if (audit.score !== null && audit.score < 1 && audit.scoreDisplayMode === "binary") {
          console.log(`    - ${audit.id}: ${audit.title}`);
        }
      }
    }
  }
} finally {
  await chrome?.kill();
  server?.kill();
}

if (failed) {
  console.error(`Accessibilità sotto ${THRESHOLD}.`);
  process.exit(1);
}
