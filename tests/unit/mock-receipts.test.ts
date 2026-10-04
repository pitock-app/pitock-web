import { beforeEach, describe, expect, it } from "vitest";
import { createMockAccessToken } from "@/lib/auth/mock-session";
import type { components } from "@/lib/api/schema";
import { mockTiming, seededReceiptCount } from "@/mocks";
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

async function list(query = "") {
  const response = await call(`/receipts${query}`);
  expect(response.status).toBe(200);
  return (await response.json()) as Schemas["ReceiptList"];
}

beforeEach(() => {
  mockTiming.startMs = 0;
  mockTiming.doneMs = 0;
});

describe("handler MSW degli scontrini", () => {
  it("pagina gli scontrini di esempio con il cursore, dal più recente", async () => {
    const first = await list();
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).toBeTruthy();
    const all = [...first.items];
    let cursor = first.nextCursor;
    while (cursor) {
      const page = await list(`?cursor=${encodeURIComponent(cursor)}`);
      expect(page.items.length).toBeGreaterThan(0);
      expect(page.items.length).toBeLessThanOrEqual(20);
      all.push(...page.items);
      cursor = page.nextCursor;
    }
    const expected = seededReceiptCount("sync@pitock.test");
    expect(expected).toBeGreaterThan(30);
    expect(new Set(all.map((item) => item.id)).size).toBe(expected);
    const dates = all.map((item) => item.createdAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("filtra per categoria, sorgente, stato, ricerca e periodo", async () => {
    const fuel = await list("?category=carburante");
    expect(fuel.items.every((item) => item.category === "carburante")).toBe(true);
    expect(fuel.items.length).toBeGreaterThan(0);
    const manual = await list("?source=manual");
    expect(manual.items.every((item) => item.source === "manual")).toBe(true);
    const failed = await list("?status=failed");
    expect(failed.items).toHaveLength(1);
    const search = await list("?q=ESSE");
    expect(search.items.every((item) => item.merchantName === "Esselunga")).toBe(true);
    const old = await list("?to=2000-01-01");
    expect(old.items).toHaveLength(0);
  });

  it("rifiuta i parametri non validi", async () => {
    expect((await call("/receipts?limit=0")).status).toBe(400);
    expect((await call("/receipts?category=boh")).status).toBe(400);
    expect((await call("/receipts?from=ieri")).status).toBe(400);
  });

  it("le email che iniziano con vuoto non hanno scontrini", async () => {
    const response = await call("/receipts", {}, "vuoto@pitock.test");
    expect(((await response.json()) as Schemas["ReceiptList"]).items).toHaveLength(0);
  });

  it("corregge l'estrazione corrente e la segna come modificata", async () => {
    const target = (await list("?status=extracted")).items[0];
    const detail = (await (
      await call(`/receipts/${target.id}`)
    ).json()) as Schemas["ReceiptDetail"];
    const response = await call(`/extractions/${detail.extraction!.id}`, {
      method: "PATCH",
      body: JSON.stringify({ total: 99.9, notes: null, items: [{ description: "Pane" }] }),
    });
    expect(response.status).toBe(200);
    const updated = (await response.json()) as Schemas["ExtractionDetail"];
    expect(updated).toMatchObject({ total: 99.9, editedByUser: true, notes: null });
    expect(updated.items).toHaveLength(1);
    const after = await list("?status=extracted");
    expect(after.items.find((item) => item.id === target.id)?.total).toBe(99.9);

    const invalid = await call(`/extractions/${detail.extraction!.id}`, {
      method: "PATCH",
      body: JSON.stringify({ total: "tanti" }),
    });
    expect(invalid.status).toBe(400);
  });

  it("con la chiave dell'utente la rielaborazione usa provider e modello scelti", async () => {
    const byok = (path: string, init: RequestInit = {}) => call(path, init, "byok@pitock.test");
    const target = (
      (await (
        await byok("/receipts?source=file&status=extracted")
      ).json()) as Schemas["ReceiptList"]
    ).items[0];
    const old = (await (await byok(`/receipts/${target.id}`)).json()) as Schemas["ReceiptDetail"];
    const response = await byok(`/receipts/${target.id}/reextract`, {
      method: "POST",
      body: JSON.stringify({ provider: "openai", model: "gpt-test" }),
    });
    expect(response.status).toBe(202);
    const detail = (await (
      await byok(`/receipts/${target.id}`)
    ).json()) as Schemas["ReceiptDetail"];
    expect(detail.receipt.status).toBe("extracted");
    expect(detail.extraction).toMatchObject({
      provider: "openai",
      model: "gpt-test",
      keySource: "user",
    });

    const history = (await (
      await byok(`/receipts/${target.id}/extractions`)
    ).json()) as Schemas["ExtractionHistory"];
    expect(history.items).toHaveLength(2);
    expect(history.items.map((item) => item.isCurrent)).toEqual([true, false]);

    // La vecchia estrazione non si può più correggere.
    const stale = await byok(`/extractions/${old.extraction!.id}`, {
      method: "PATCH",
      body: JSON.stringify({ total: 1 }),
    });
    expect(stale.status).toBe(409);

    const badProvider = await byok(`/receipts/${target.id}/reextract`, {
      method: "POST",
      body: JSON.stringify({ provider: "gemini" }),
    });
    expect(badProvider.status).toBe(400);
  });

  it("come il backend: senza chiave un altro provider fallisce, la piattaforma ignora il modello", async () => {
    const [first, second] = (await list("?source=camera&status=extracted")).items;
    await call(`/receipts/${first.id}/reextract`, {
      method: "POST",
      body: JSON.stringify({ provider: "openai", model: "gpt-test" }),
    });
    const failed = (await (await call(`/receipts/${first.id}`)).json()) as Schemas["ReceiptDetail"];
    expect(failed.receipt).toMatchObject({ status: "failed", errorCode: "USER_KEY_MISSING" });
    expect(failed.extraction?.isCurrent).toBe(true);

    await call(`/receipts/${second.id}/reextract`, {
      method: "POST",
      body: JSON.stringify({ model: "modello-ignorato" }),
    });
    const platform = (await (
      await call(`/receipts/${second.id}`)
    ).json()) as Schemas["ReceiptDetail"];
    expect(platform.extraction).toMatchObject({
      provider: "anthropic",
      model: "claude-haiku-4-5",
      keySource: "platform",
    });
  });

  it("valida id e corpi come il backend", async () => {
    expect((await call("/receipts/non-un-uuid")).status).toBe(400);
    const target = (await list("?status=extracted")).items[0];
    const detail = (await (
      await call(`/receipts/${target.id}`)
    ).json()) as Schemas["ReceiptDetail"];
    const patch = (body: unknown) =>
      call(`/extractions/${detail.extraction!.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    expect((await patch({ merchantName: "   " })).status).toBe(400);
    expect((await patch({ items: [{ description: "x", vatRate: 101 }] })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    const missing = await call("/extractions/00000000-0000-4000-8000-000000000999", {
      method: "PATCH",
      body: JSON.stringify({ total: 1 }),
    });
    expect(missing.status).toBe(404);
  });

  it("non rielabora gli scontrini manuali", async () => {
    const manual = (await list("?source=manual")).items[0];
    const response = await call(`/receipts/${manual.id}/reextract`, { method: "POST" });
    expect(response.status).toBe(409);
  });
});
