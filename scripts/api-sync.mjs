// Scarica il contratto OpenAPI del backend in openapi/openapi.json.
// Uso: pnpm api:sync (legge NEXT_PUBLIC_API_URL da .env.local o .env, se presenti).
import { writeFile } from "node:fs/promises";

const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787").replace(/\/+$/, "");
const url = `${baseUrl}/openapi.json`;

const response = await fetch(url);
if (!response.ok) {
  console.error(`Impossibile scaricare ${url}: HTTP ${response.status}`);
  process.exit(1);
}
const document = await response.json();
if (typeof document.openapi !== "string" || typeof document.paths !== "object") {
  console.error(`${url} non sembra un documento OpenAPI.`);
  process.exit(1);
}
await writeFile("openapi/openapi.json", `${JSON.stringify(document, null, 2)}\n`);
console.log(`Contratto aggiornato da ${url}. Ora esegui pnpm api:types.`);
