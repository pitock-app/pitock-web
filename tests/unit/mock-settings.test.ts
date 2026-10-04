import { beforeEach, describe, expect, it } from "vitest";
import { createMockAccessToken } from "@/lib/auth/mock-session";
import type { components } from "@/lib/api/schema";
import { mockTiming } from "@/mocks";
import { setupMswServer } from "../helpers/msw-server";

type Schemas = components["schemas"];

setupMswServer();

const API = "http://api.test/v1";
const EMAIL = "anna@pitock.test";
const KEY = "sk-test-abcdefghijkl1234";

function call(path: string, init: RequestInit & { json?: unknown } = {}, email = EMAIL) {
  const { json, ...rest } = init;
  return fetch(`${API}${path}`, {
    ...rest,
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    headers: {
      Authorization: `Bearer ${createMockAccessToken(email)}`,
      "Content-Type": "application/json",
      ...rest.headers,
    },
  });
}

async function settings() {
  const response = await call("/settings/ai");
  expect(response.status).toBe(200);
  return (await response.json()) as Schemas["AiSettings"];
}

async function errorCode(response: Response) {
  return ((await response.json()) as Schemas["Error"]).error.code;
}

beforeEach(() => {
  mockTiming.startMs = 0;
  mockTiming.doneMs = 0;
});

describe("handler MSW delle impostazioni AI", () => {
  it("parte da Pitock AI, senza chiavi, con la quota", async () => {
    const data = await settings();
    expect(data).toMatchObject({
      mode: "platform",
      provider: null,
      model: null,
      fallbackToPlatform: false,
      keys: [],
      platformQuota: { limit: 100 },
    });
  });

  it("rifiuta una chiave non valida senza salvarla", async () => {
    const response = await call("/settings/ai/keys/openai", {
      method: "PUT",
      json: { apiKey: "sk-invalid-000000000000" },
    });
    expect(response.status).toBe(422);
    expect(await errorCode(response)).toBe("USER_KEY_INVALID");
    expect((await settings()).keys).toEqual([]);
  });

  it("valida la forma della chiave come il contratto (400)", async () => {
    for (const apiKey of ["corta", "sk con spazi 1234567890"]) {
      const response = await call("/settings/ai/keys/openai", { method: "PUT", json: { apiKey } });
      expect(response.status).toBe(400);
    }
  });

  it("salva la chiave e restituisce solo le ultime 4 cifre", async () => {
    const response = await call("/settings/ai/keys/openai", {
      method: "PUT",
      json: { apiKey: KEY },
    });
    expect(response.status).toBe(200);
    const info = (await response.json()) as Schemas["ApiKeyInfo"];
    expect(info).toMatchObject({ provider: "openai", last4: "1234" });
    const text = JSON.stringify(await settings());
    expect(text).not.toContain("sk-");
  });

  it("byok richiede provider, modello e una chiave salvata", async () => {
    const missing = await call("/settings/ai", {
      method: "PUT",
      json: { mode: "byok", provider: "openai", model: "gpt-5-mini" },
    });
    expect(missing.status).toBe(409);
    expect(await errorCode(missing)).toBe("USER_KEY_MISSING");

    const noModel = await call("/settings/ai", {
      method: "PUT",
      json: { mode: "byok", provider: "openai" },
    });
    expect(noModel.status).toBe(400);

    await call("/settings/ai/keys/openai", { method: "PUT", json: { apiKey: KEY } });
    const ok = await call("/settings/ai", {
      method: "PUT",
      json: { mode: "byok", provider: "openai", model: "gpt-5-mini", fallbackToPlatform: true },
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({
      mode: "byok",
      provider: "openai",
      model: "gpt-5-mini",
      fallbackToPlatform: true,
    });
    const me = (await (await call("/me")).json()) as Schemas["Me"];
    expect(me.ai).toEqual({ mode: "byok", provider: "openai", model: "gpt-5-mini" });

    // I campi omessi restano invariati.
    const partial = await call("/settings/ai", {
      method: "PUT",
      json: { mode: "byok", model: "gpt-5" },
    });
    expect(await partial.json()).toMatchObject({
      provider: "openai",
      model: "gpt-5",
      fallbackToPlatform: true,
    });
  });

  it("cancellando la chiave in uso torna a Pitock AI", async () => {
    await call("/settings/ai/keys/openai", { method: "PUT", json: { apiKey: KEY } });
    await call("/settings/ai", {
      method: "PUT",
      json: { mode: "byok", provider: "openai", model: "gpt-5-mini" },
    });
    expect((await call("/settings/ai/keys/openai", { method: "DELETE" })).status).toBe(204);
    expect(await settings()).toMatchObject({ mode: "platform", keys: [] });
    expect((await call("/settings/ai/keys/openai", { method: "DELETE" })).status).toBe(404);
  });

  it("elenca i modelli solo con la chiave, tranne OpenRouter", async () => {
    const missing = await call("/settings/ai/models?provider=anthropic");
    expect(missing.status).toBe(409);
    const open = await call("/settings/ai/models?provider=openrouter");
    expect(open.status).toBe(200);
    const list = (await open.json()) as Schemas["ModelList"];
    expect(list.models.length).toBeGreaterThan(0);
    expect((await call("/settings/ai/models?provider=altro")).status).toBe(400);
  });

  it("prova la configurazione e registra la prova nel consumo", async () => {
    expect(
      (
        await call("/settings/ai/test", {
          method: "POST",
          json: { provider: "openai", model: "gpt-5" },
        })
      ).status,
    ).toBe(409);
    await call("/settings/ai/keys/openai", { method: "PUT", json: { apiKey: KEY } });
    const ok = await call("/settings/ai/test", {
      method: "POST",
      json: { provider: "openai", model: "gpt-5" },
    });
    expect(await ok.json()).toEqual({ ok: true });
    const ko = await call("/settings/ai/test", {
      method: "POST",
      json: { provider: "openai", model: "modello-inesistente" },
    });
    expect(await ko.json()).toMatchObject({ ok: false, error: { code: "LLM_UNAVAILABLE" } });

    const calls = (await (await call("/usage/calls?limit=100")).json()) as Schemas["UsageCallList"];
    const tests = calls.items.filter((item) => item.operation === "key_test");
    expect(tests).toHaveLength(2);
    expect(tests.every((item) => item.keySource === "user")).toBe(true);
  });
});

describe("handler MSW del consumo", () => {
  it("i totali coincidono con la somma delle chiamate e della serie", async () => {
    const response = await call("/usage?from=2000-01-01");
    expect(response.status).toBe(200);
    const summary = (await response.json()) as Schemas["UsageSummary"];
    const calls = (await (await call("/usage/calls?limit=100")).json()) as Schemas["UsageCallList"];
    expect(summary.totals.calls).toBe(calls.items.length);
    expect(summary.totals.calls).toBeGreaterThan(0);
    const sum = (key: "calls" | "inputTokens" | "outputTokens") =>
      summary.series.reduce((total, point) => total + point[key], 0);
    expect(sum("calls")).toBe(summary.totals.calls);
    expect(sum("inputTokens")).toBe(summary.totals.inputTokens);
    expect(sum("outputTokens")).toBe(summary.totals.outputTokens);
    expect(summary.byModel.reduce((total, row) => total + row.calls, 0)).toBe(summary.totals.calls);
    // Giorni in ordine crescente.
    const keys = summary.series.map((point) => point.key);
    expect([...keys].sort()).toEqual(keys);
  });

  it("pagina le ultime chiamate dalla più recente", async () => {
    const first = (await (await call("/usage/calls?limit=5")).json()) as Schemas["UsageCallList"];
    expect(first.items).toHaveLength(5);
    expect(first.nextCursor).toBeTruthy();
    const second = (await (
      await call(`/usage/calls?limit=5&cursor=${encodeURIComponent(first.nextCursor!)}`)
    ).json()) as Schemas["UsageCallList"];
    expect(second.items[0].createdAt <= first.items[4].createdAt).toBe(true);
    expect(second.items.map((item) => item.id)).not.toContain(first.items[4].id);
  });

  it("legge l'esercente corrente e scollega gli scontrini eliminati", async () => {
    const page = (await (await call("/usage/calls?limit=100")).json()) as Schemas["UsageCallList"];
    const linked = page.items.find((item) => item.receiptId && item.merchantName);
    expect(linked).toBeDefined();
    expect((await call(`/receipts/${linked!.receiptId}`, { method: "DELETE" })).status).toBe(204);
    const after = (await (await call("/usage/calls?limit=100")).json()) as Schemas["UsageCallList"];
    const same = after.items.find((item) => item.id === linked!.id);
    expect(same).toMatchObject({ receiptId: null, merchantName: null });
  });

  it("rifiuta intervalli non validi", async () => {
    expect((await call("/usage?from=2026-02-30")).status).toBe(400);
    expect((await call("/usage?from=2026-13-01")).status).toBe(400);
    expect((await call("/usage?from=2026-10-04&to=2026-10-01")).status).toBe(400);
    expect((await call("/usage?groupBy=week")).status).toBe(400);
  });
});

describe("handler MSW dell'account", () => {
  it("richiede la conferma ELIMINA e cancella tutti i dati", async () => {
    await call("/settings/ai/keys/openai", { method: "PUT", json: { apiKey: KEY } });
    expect(
      (await call("/account", { method: "DELETE", json: { confirm: "elimina" } })).status,
    ).toBe(400);
    expect(
      (await call("/account", { method: "DELETE", json: { confirm: "ELIMINA" } })).status,
    ).toBe(204);
    expect((await settings()).keys).toEqual([]);
  });
});
