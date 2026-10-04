# pitock-web

Web app di **Pitock**: inserimento degli scontrini, dashboard e impostazioni.
È solo il frontend: dati, logica e chiamate LLM stanno nel backend `pitock-api`, raggiungibile via HTTP.

## Requisiti

- Node.js 24
- pnpm (versione in `packageManager` di `package.json`)

## Avvio

```bash
pnpm install
cp .env.example .env.local   # poi compila i valori
pnpm dev                     # http://localhost:3000
```

Per lavorare senza backend imposta `NEXT_PUBLIC_API_MOCKING=true`: MSW simula l'API
(handler in `src/mocks/`) e il login è finto, con qualunque email e password.

## Script

| Comando                             | Cosa fa                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`                          | Next.js in sviluppo su :3000                                                      |
| `pnpm build` / `pnpm start`         | build e avvio di produzione                                                       |
| `pnpm lint`                         | ESLint                                                                            |
| `pnpm format` / `pnpm format:check` | Prettier                                                                          |
| `pnpm typecheck`                    | `tsc --noEmit`                                                                    |
| `pnpm test`                         | Vitest (unit e componenti)                                                        |
| `pnpm e2e`                          | Playwright; senza `E2E_BASE_URL` compila e avvia l'app in locale in modalità mock |
| `pnpm api:sync`                     | scarica `${NEXT_PUBLIC_API_URL}/openapi.json` in `openapi/openapi.json`           |
| `pnpm api:types`                    | genera `src/lib/api/schema.d.ts` dal contratto                                    |

Contro un backend reale l'e2e usa `E2E_BASE_URL`, `E2E_EMAIL` e `E2E_PASSWORD`.
Per l'e2e serve Chromium di Playwright: `pnpm exec playwright install chromium`.

## Variabili d'ambiente

Tutte pubbliche (`NEXT_PUBLIC_*`), validate in `src/lib/env.ts`. Il frontend non ha segreti.

| Variabile                       | Descrizione                                     |
| ------------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_API_URL`           | URL del backend `pitock-api`                    |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL del progetto Supabase (solo Auth e Storage) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chiave anon / publishable                       |
| `NEXT_PUBLIC_API_MOCKING`       | `true` per simulare l'API con MSW               |

## Deploy

Progetto Vercel dedicato `pitock-web` (framework Next.js, comando di build `pnpm build`),
con le variabili d'ambiente sopra impostate per Preview e Production.
