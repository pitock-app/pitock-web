import { describe, expect, it } from "vitest";
import type { components } from "@/lib/api/schema";
import { createMockAccessToken } from "@/lib/auth/mock-session";
import { setupMswServer } from "../helpers/msw-server";

type Schemas = components["schemas"];

setupMswServer();

const API = "http://api.test/v1";

function call(path: string, init: RequestInit = {}, email = "anna@pitock.test") {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${createMockAccessToken(email)}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

async function stats(query = "", email?: string) {
  const response = await call(`/stats${query}`, {}, email);
  expect(response.status).toBe(200);
  return (await response.json()) as Schemas["Stats"];
}

async function receipts(email?: string) {
  const response = await call("/receipts?limit=100&status=extracted", {}, email);
  return ((await response.json()) as Schemas["ReceiptList"]).items;
}

const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;

describe("handler MSW delle statistiche", () => {
  it("somma solo gli scontrini estratti, con totali coerenti tra le sezioni", async () => {
    const result = await stats();
    const extracted = await receipts();
    expect(result.from).toBeNull();
    expect(result.to).toBeNull();
    expect(result.granularity).toBe("month");
    expect(result.totals.nReceipts).toBe(extracted.length);
    expect(result.totals.total).toBe(sum(extracted.map((item) => item.total ?? 0)));
    expect(result.totals.average).toBe(
      Math.round((result.totals.total / result.totals.nReceipts) * 100) / 100,
    );
    for (const section of [result.byCategory, result.byPeriod, result.bySource]) {
      expect(sum(section.map((row) => row.total))).toBe(result.totals.total);
      expect(section.reduce((n, row) => n + row.nReceipts, 0)).toBe(result.totals.nReceipts);
    }
  });

  it("ordina come il backend e limita gli esercenti a 10", async () => {
    const result = await stats();
    const totals = (rows: { total: number }[]) => rows.map((row) => row.total);
    expect(totals(result.byCategory)).toEqual([...totals(result.byCategory)].sort((a, b) => b - a));
    expect(totals(result.topMerchants)).toEqual(
      [...totals(result.topMerchants)].sort((a, b) => b - a),
    );
    expect(result.topMerchants.length).toBeLessThanOrEqual(10);
    const periods = result.byPeriod.map((row) => row.period);
    expect(periods).toEqual([...periods].sort());
    expect(periods.every((period) => /^\d{4}-\d{2}$/.test(period))).toBe(true);
    expect(result.bySource.map((row) => row.source)).toEqual(
      [...result.bySource.map((row) => row.source)].sort(),
    );
  });

  it("filtra per intervallo con fine esclusiva e raggruppa per anno", async () => {
    const all = await stats("?granularity=year");
    expect(all.byPeriod.every((row) => /^\d{4}$/.test(row.period))).toBe(true);
    const lastPeriod = all.byPeriod.at(-1)!.period;
    const year = await stats(`?from=${lastPeriod}-01-01&to=${lastPeriod}-12-31&granularity=year`);
    expect(year.byPeriod).toEqual([all.byPeriod.at(-1)]);
    expect(year.to).toBe(new Date(`${Number(lastPeriod) + 1}-01-01T00:00:00+01:00`).toISOString());
  });

  it("rifiuta intervalli e parametri non validi", async () => {
    for (const query of [
      "?from=2026-10-05&to=2026-10-04",
      "?from=2026-02-30",
      "?to=ieri",
      "?granularity=week",
    ]) {
      const response = await call(`/stats${query}`);
      expect(response.status).toBe(400);
      expect(((await response.json()) as Schemas["Error"]).error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("è vuoto per un utente senza scontrini e richiede l'autenticazione", async () => {
    const empty = await stats("", "vuoto@pitock.test");
    expect(empty.totals).toEqual({ total: 0, nReceipts: 0, average: 0 });
    expect(empty.byCategory).toEqual([]);
    expect(empty.topMerchants).toEqual([]);
    const response = await fetch(`${API}/stats`);
    expect(response.status).toBe(401);
  });

  it("segue le correzioni del totale", async () => {
    const [first] = await receipts();
    const detail = (await (await call(`/receipts/${first.id}`)).json()) as Schemas["ReceiptDetail"];
    const before = await stats();
    const patch = await call(`/extractions/${detail.extraction!.id}`, {
      method: "PATCH",
      body: JSON.stringify({ total: (first.total ?? 0) + 10 }),
    });
    expect(patch.status).toBe(200);
    const after = await stats();
    expect(after.totals.total).toBe(Math.round((before.totals.total + 10) * 100) / 100);
  });
});

describe("handler MSW del dataset", () => {
  it("restituisce gli stessi scontrini delle statistiche, con le righe, dal più recente", async () => {
    const response = await call("/stats/dataset?from=2026-01-01");
    expect(response.status).toBe(200);
    const dataset = (await response.json()) as Schemas["StatsDataset"];
    const summary = await stats("?from=2026-01-01");
    expect(dataset.truncated).toBe(false);
    expect(dataset.receipts).toHaveLength(summary.totals.nReceipts);
    expect(sum(dataset.receipts.map((r) => r.total ?? 0))).toBe(summary.totals.total);
    const dates = dataset.receipts.map((r) => r.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    const ids = new Set(dataset.receipts.map((r) => r.id));
    expect(dataset.items.length).toBeGreaterThan(0);
    expect(dataset.items.every((item) => ids.has(item.receiptId))).toBe(true);
  });

  it("rifiuta un intervallo al contrario", async () => {
    const response = await call("/stats/dataset?from=2026-10-02&to=2026-10-01");
    expect(response.status).toBe(400);
  });
});
