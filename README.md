<div align="center">

# 🧾 pitock-web

**The web app of Pitock — snap a receipt, let the LLM read it, see where your money goes and where you could pay less.**

_Pitock_ (from Piedmontese _pitòch_, "stingy") is a personal finance tool for people who want to know exactly where their grocery money goes.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-components-111111)
![Playwright](https://img.shields.io/badge/e2e-Playwright-2EAD33?logo=playwright&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

[Backend → `pitock-api`](https://github.com/pitock/pitock-api) · [Metrics ↓](#-metrics--how-they-are-computed)

</div>

---

## ✨ Why this project exists

> [!NOTE]
> **Pitock is an experiment in agentic coding applied to a real problem of mine.**
>
> I kept paper receipts in a drawer and had no idea how much I spent, where, and whether
> the same product cost less in another shop. Instead of writing the app line by line, I used it
> as a testbed: **two AI coding agents** (one for this web app, one for the [backend](https://github.com/pitock/pitock-api))
> built the whole system in parallel, milestone by milestone, from a written specification.
>
> My role was the one of a tech lead: write the spec, define the acceptance criteria, review
> the decisions, test the result on my own receipts and steer the corrections.

How the experiment was set up:

| Piece                 | What it did                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Specification**     | One source-of-truth document per repository: product, pages, design, API contract, security rules, milestones with acceptance criteria.           |
| **Milestones**        | Frontend `F0 → F6`, backend `B0 → B5`, then `SYNC` to align this app with the real OpenAPI contract. Each milestone ran in a fresh agent session. |
| **Contract first**    | Thanks to MSW mocks the web agent never waited for the backend: it built against a provisional contract and switched to the real one at the end.  |
| **Review sub-agents** | `test-runner`, `security-reviewer`, `contract-checker` and `ux-reviewer` had to be green before a milestone could be marked done.                 |
| **Guardrails**        | Deny-list of commands (no `sudo`, no `git push`, no deploy CLIs), no real external services during autopilot.                                     |
| **Human loop**        | I used the app on my real receipts and turned what felt wrong into new, precise requests — most of the price analytics below came from that loop. |

---

## 🖥️ What you can do

| Page                    | What it offers                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/add`**              | Three tabs: **Photo** (phone or webcam camera), **File** (drag & drop images or PDF, many at once), **Manual** (form with line items, Italian amounts like `12,50`). HEIC is converted, large images are compressed, SHA-256 detects duplicates before upload. A live queue shows every file: uploading → processing → ready / duplicate / failed. |
| **`/receipts`**         | List with filters kept in the URL (date, status, category, source, text). Detail page with the original file viewer, editable extraction, re-extraction with another model, extraction history, delete.                                                                                                                                            |
| **`/dashboard`**        | Period picker (this month, last month, last 12 months, this year, custom), global filters by **store** and **category**, forecast, savings, KPIs, charts and product price analytics.                                                                                                                                                              |
| **`/settings/ai`**      | Platform model or **your own key** (Anthropic, OpenAI, OpenRouter), live model list, connection test, fallback to platform. Only the last 4 characters of a key ever reach the page.                                                                                                                                                               |
| **`/settings/usage`**   | Tokens, calls and cost per day and per model, recent LLM calls, platform quota bar.                                                                                                                                                                                                                                                                |
| **`/settings/account`** | Account info and full account deletion.                                                                                                                                                                                                                                                                                                            |

Responsive layout (sidebar on desktop, bottom nav on mobile), dark theme, accessible charts (every chart has a data-table alternative).

---

## 🚀 Quick start

**Requirements:** Node.js 24, pnpm (version pinned in `packageManager`).

```bash
pnpm install
cp .env.example .env.local   # fill in the values
pnpm dev                     # → http://localhost:3000
```

### Try it without any backend

```bash
NEXT_PUBLIC_API_MOCKING=true pnpm dev
```

[MSW](https://mswjs.io/) simulates the whole API (handlers in `src/mocks/`), uploads and login
(any email and password work), with a realistic dataset so the dashboard is full from the first second.
Mocking is always off when `NEXT_PUBLIC_VERCEL_ENV=production`.

### Against the real backend

1. Run [`pitock-api`](https://github.com/pitock/pitock-api) (locally on `:8787` or deployed).
2. Set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Refresh the typed client when the contract changes:

```bash
pnpm api:sync    # downloads ${NEXT_PUBLIC_API_URL}/openapi.json → openapi/openapi.json
pnpm api:types   # generates src/lib/api/schema.d.ts and enums
```

---

## ⚙️ Configuration

All variables are public (`NEXT_PUBLIC_*`) and validated in `src/lib/env.ts`. **The frontend holds no secrets.**

| Variable                        | Description                                                 |
| ------------------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`           | URL of `pitock-api`                                         |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL (Auth and signed Storage uploads only) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon / publishable key                                      |
| `NEXT_PUBLIC_API_MOCKING`       | `true` to simulate the API with MSW                         |

## 📜 Scripts

| Command                             | What it does                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm dev`                          | Next.js dev server on `:3000`                                                |
| `pnpm build` / `pnpm start`         | Production build and server                                                  |
| `pnpm lint`                         | ESLint                                                                       |
| `pnpm format` / `pnpm format:check` | Prettier                                                                     |
| `pnpm typecheck`                    | `tsc --noEmit`                                                               |
| `pnpm test`                         | Vitest (unit and components)                                                 |
| `pnpm e2e`                          | Playwright; without `E2E_BASE_URL` it builds and starts the app in mock mode |
| `pnpm lighthouse`                   | Lighthouse audit                                                             |
| `pnpm api:sync` / `pnpm api:types`  | Sync the OpenAPI contract / regenerate types                                 |

E2E against a real backend uses `E2E_BASE_URL`, `E2E_EMAIL`, `E2E_PASSWORD`.
First run: `pnpm exec playwright install chromium`.

---

## 📐 Metrics — how they are computed

All dashboard numbers come from `GET /v1/stats/dataset` of `pitock-api`: one row per receipt and
one per line item in the period (the **facts**). Receipts arrive already dated in `Europe/Rome` and
with harmonized merchant names (see the [API README](https://github.com/pitock/pitock-api#-server-side-metrics)).

Everything below is computed **in the browser** (`src/features/dashboard/lib/`), so the store and
category filters apply instantly to every chart. All money values are rounded to 2 decimals.

### Notation

| Symbol            | Meaning                                                          |
| ----------------- | ---------------------------------------------------------------- |
| $R$               | receipts in the period after the filters                         |
| $t_r$             | amount of receipt $r$ (see _Filtered amount_)                    |
| $P_k$             | purchases of product $k$ (cleaned line items)                    |
| $q_j,\ u_j,\ a_j$ | quantity, unit price and amount of purchase $j$                  |
| $m$               | a merchant · $D$ days in a period · $d$ today’s day of the month |

### 1. Filters and filtered amount

- **Store filter** keeps receipts whose harmonized merchant equals the chosen store.
- **Category filter** keeps line items of that category, and receipts that have that category _or_ at least one line in it.

With a category $c$ selected, a receipt counts only for its lines in that category:

$$
t_r = \begin{cases} \displaystyle\sum_{i \in r,\ \text{cat}(i) = c} a_i & \text{if } r \text{ has lines in } c \\[1ex] \text{total}(r) & \text{otherwise} \end{cases}
$$

### 2. KPIs and overview charts

$$
\text{Total} = \sum_{r \in R} t_r \qquad n = |R| \qquad \text{Average receipt} = \frac{\text{Total}}{n}\ (0 \text{ if } n = 0)
$$

**By period**, **by category**, **by source** (`camera` · `file` · `manual`) and **top merchants**
are the same sum grouped by key. Each slice shows its share $\text{share}_g = \text{Total}_g / \text{Total}$.
Receipts without a merchant are shown as a separate row, so merchant rows always add up to the total.

### 3. Products: from lines to purchases

A line item becomes a **purchase** only if it is a real product: no bags/shoppers, no generic
lines (`Reparto 3`, `Varie`), no discounts or negative amounts. Then:

- **Product key** — the LLM-normalized name + brand + pack size (so `LATTE PS GRANAROLO 1L` and `Granarolo latte parz. scremato 1 l` match); otherwise the cleaned description.
- **Unit** — `kg` for weighed items (`1,468 kg x 2,19 EUR/kg` or a decimal quantity), else `pz` (pieces).
- **Unit price** $u_j$ — printed unit price, or $a_j / q_j$.
- **Price per kg / litre** — $u_j / s_j$ where $s_j$ is the pack size converted to kg or L (`6x125g` → 0.75 kg, `50cl` → 0.5 L).

### 4. Product statistics

For each product $k$, prices are compared only within its most frequent unit. The **quantity-weighted average price** is

$$
\bar{u}_k = \frac{\sum_{j \in P_k} u_j\, q_j}{\sum_{j \in P_k} q_j}
$$

| Metric               | Formula                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total spent          | $\sum_{j \in P_k} a_j$                                                                                                                                      |
| Best price           | $u_k^{\min} = \min_{j \in P_k} u_j$ (and where)                                                                                                             |
| **Potential saving** | $S_k = \sum_{j \in P_k} \big(u_j - u_k^{\min}\big)\, q_j$                                                                                                   |
| Price change         | $\Delta_k = \dfrac{\bar{u}_k^{\,\text{last day}} - \bar{u}_k^{\,\text{first day}}}{\bar{u}_k^{\,\text{first day}}} \times 100$ (only if bought on ≥ 2 days) |
| Price per merchant   | $\bar{u}_{k,m}$ = weighted average restricted to merchant $m$                                                                                               |

### 5. Savings and comparisons

**Potential saving (card)** — what you would have saved by always paying the best price you
have already paid somewhere, and its share of product spend:

$$
S = \sum_{k:\ S_k \ge 0.01} S_k \qquad \text{share} = \frac{S}{\sum_k \text{Total spent}_k}
$$

**Same product, different stores** — for products bought in at least two stores, how much cheaper the cheapest store is than the most expensive:

$$
\text{gap}_k = \frac{\max_m \bar{u}_{k,m} - \min_m \bar{u}_{k,m}}{\max_m \bar{u}_{k,m}} \times 100
$$

**Price per kg and litre** — products of the same _type_ (e.g. "latte", "pasta") and unit are
compared on $u / s$; groups with a gap under 1 % are hidden.

**Price changes** — products with $|\Delta_k| \ge 0.5\%$, sorted from biggest increase to biggest decrease.

**Price history** — one point per (day, merchant): the weighted average price paid that day in that shop.

**Frequent purchases** — scatter of products bought at least twice: $x$ = number of purchases, $y$ = $\bar{u}_k$, bubble area = total spent.

### 6. Saving tips

Tips are generated from the comparisons above and ranked by an estimated impact in euros over the period:

| Tip                             | Condition           | Impact                                                           |
| ------------------------------- | ------------------- | ---------------------------------------------------------------- |
| Buy it at the cheaper store     | store gap ≥ 5 %     | $(\bar{u}_k - \min_m \bar{u}_{k,m}) \cdot Q_k$                   |
| Pick the cheaper format / brand | per-kg/L gap ≥ 10 % | $\text{spent}_{\text{pricier}} \cdot \text{gap} / 100$           |
| Watch out, price went up        | $\Delta_k \ge 5\%$  | $(\bar{u}^{\,\text{last}} - \bar{u}^{\,\text{first}}) \cdot Q_k$ |
| You already paid less           | $S_k \ge 0.50$ €    | $S_k$                                                            |

where $Q_k = \sum_{j} q_j$. The top 6 are shown.

### 7. Spending forecast

The forecast projects the end-of-month (or end-of-period) spend from three ingredients.

**Recurring expenses.** In the last 3 history months, a merchant is _recurring_ when it was paid
**exactly once per month** with a stable amount, i.e. coefficient of variation

$$
\text{CV} = \frac{\sigma}{\mu} \le 0.25
$$

Its expected amount is the median. Recurring expenses (bills, subscriptions, rent) are removed
from the daily rate and, if not yet paid this month, added in full.

**Daily rates** (recurring excluded). With $V_{\text{now}}$ the variable spend of the current month
up to day $d$, and $V_{\text{hist}}$ the variable spend over the last (up to 6) months covering $D_{\text{hist}}$ days:

$$
\rho_{\text{now}} = \frac{V_{\text{now}}}{d} \qquad \rho_{\text{hist}} = \frac{V_{\text{hist}}}{D_{\text{hist}}}
$$

History starts at the first receipt ever: days before you used the app do not count as zero spend.

**Blended rate.** Early in the month history dominates, late in the month the current pace does:

$$
w = \frac{d}{D_{\text{month}}} \qquad \rho = w\,\rho_{\text{now}} + (1 - w)\,\rho_{\text{hist}}
$$

**Projection** for the current month:

$$
\hat{S} = S_{\text{spent}} + \rho\,(D_{\text{month}} - d) + \sum_{\text{pending recurring}} \text{amount}
$$

For longer periods, each later month adds $\rho_{\text{hist}}$ per day plus every recurring expense
once per month. The chart draws the actual cumulative spend up to today and the projection from today on.

**Reliability**

| Level  | Rule                                                    |
| ------ | ------------------------------------------------------- |
| low    | no history, or $d < 7$ with fewer than 2 history months |
| medium | fewer than 3 history months, or $d < 10$                |
| good   | otherwise                                               |

**Comparisons** shown next to the forecast: last month’s total and the average of complete
history months, pro-rated to the days of the selected period.

---

## 🏗️ Architecture

```
src/
├─ app/                 Next.js App Router: (auth) login/register · (app) add, receipts, dashboard, settings
├─ features/            one folder per feature: capture · manual-entry · receipts · dashboard · settings · auth
│  └─ dashboard/lib/    pure, unit-tested metric functions (dataset, products, forecast, periods)
├─ components/          layout shell and shadcn/ui primitives
├─ lib/
│  ├─ api/              openapi-fetch client typed from the contract, query keys, errors
│  ├─ auth/ storage/    Supabase implementations + mock implementations behind one interface
│  └─ i18n/  format  period
└─ mocks/               MSW handlers and in-memory database
```

- **Contract-driven**: types are generated from the backend OpenAPI document; a parity test keeps the mocks aligned with it.
- **Server state** with TanStack Query, **local state** (upload queue) with Zustand, forms with React Hook Form + Zod.
- **Uploads go straight to Supabase Storage** with a short-lived signed URL; the API only receives ids.
- Charts with Recharts; every chart has an accessible table view.

## 🧪 Quality

- Unit tests for every metric function (`tests/unit/dashboard-*.test.ts`), the upload pipeline, the API client and the mocks.
- Playwright e2e for the full journey (auth, add, receipts, dashboard, settings) plus `axe-core` accessibility checks.
- CI checks that generated types match the contract, then runs lint, format, typecheck, unit tests, build, e2e and Lighthouse.

## ☁️ Deploy (Vercel)

Dedicated Vercel project (framework Next.js, build `pnpm build`) with the variables above set for Preview and Production.
Add the preview domains to the backend CORS regex (`ALLOWED_ORIGIN_REGEX`).

---

## 📄 License

Released under the [MIT License](./LICENSE) © 2026 Michele Cocca.
The "Pitock" name and logo are not covered by the license.
