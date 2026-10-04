import { beforeEach, describe, expect, it } from "vitest";
import { createMockAccessToken } from "@/lib/auth/mock-session";
import type { components } from "@/lib/api/schema";
import { rememberMockFile } from "@/lib/storage/mock-files";
import { mockTiming } from "@/mocks";
import { setupMswServer } from "../helpers/msw-server";

// Comportamenti del mock allineati al backend reale (milestone SYNC).

type Schemas = components["schemas"];

setupMswServer();

const API = "http://api.test/v1";

function call(
  path: string,
  init: RequestInit & { json?: unknown } = {},
  email = "sync@pitock.test",
) {
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

const manual = {
  merchantName: "  Forno Rossi  ",
  purchasedAt: "2026-03-10T08:30",
  total: 4.5,
  category: "alimentari",
  paymentMethod: "contanti",
};

let shaCounter = 0;
const nextSha = () => (++shaCounter).toString(16).padStart(64, "A");

/** Upload finto completo: upload-url, file "caricato", complete, poi il dettaglio elaborato. */
async function uploadAndProcess(originalFilename: string, email?: string) {
  const response = await call(
    "/receipts/upload-url",
    {
      method: "POST",
      json: {
        source: "file",
        sha256: nextSha(),
        mimeType: "image/jpeg",
        sizeBytes: 1000,
        originalFilename,
      },
    },
    email,
  );
  const upload = (await response.json()) as Schemas["UploadUrl"];
  rememberMockFile(upload.path, new Blob(["x"], { type: "image/jpeg" }));
  expect(
    (await call(`/receipts/${upload.receiptId}/complete`, { method: "POST" }, email)).status,
  ).toBe(202);
  return (await (
    await call(`/receipts/${upload.receiptId}`, {}, email)
  ).json()) as Schemas["ReceiptDetail"];
}

async function callsOf(receiptId: string, email?: string) {
  const page = (await (
    await call("/usage/calls?limit=100", {}, email)
  ).json()) as Schemas["UsageCallList"];
  return page.items.filter((item) => item.receiptId === receiptId);
}

beforeEach(() => {
  mockTiming.startMs = 0;
  mockTiming.doneMs = 0;
});

describe("mock allineato al backend", () => {
  it("inserimento manuale: ripulisce l'esercente e legge la data senza fuso nell'ora di Roma", async () => {
    const response = await call("/receipts/manual", { method: "POST", json: manual });
    expect(response.status).toBe(201);
    const detail = (await response.json()) as Schemas["ReceiptDetail"];
    expect(detail.extraction?.merchantName).toBe("Forno Rossi");
    expect(detail.extraction?.purchasedAt).toBe("2026-03-10T07:30:00.000Z");
  });

  it.each([
    ["valuta", { currency: "EURO" }],
    ["data inesistente", { purchasedAt: "2026-02-30" }],
    ["esercente vuoto", { merchantName: "   " }],
    ["esercente troppo lungo", { merchantName: "x".repeat(201) }],
    ["note troppo lunghe", { notes: "x".repeat(2001) }],
    ["totale fuori intervallo", { total: 1e11 }],
    ["riga senza descrizione", { items: [{ description: " " }] }],
  ])("inserimento manuale: rifiuta %s con 400", async (_, override) => {
    const response = await call("/receipts/manual", {
      method: "POST",
      json: { ...manual, ...override },
    });
    expect(response.status).toBe(400);
  });

  it("upload: sha256 in minuscolo, nome file ripulito, complete senza file → UPLOAD_MISSING", async () => {
    const sha = "AB".repeat(32);
    const response = await call("/receipts/upload-url", {
      method: "POST",
      json: {
        source: "file",
        sha256: sha,
        mimeType: "image/png",
        sizeBytes: 10,
        originalFilename: " a.png ",
      },
    });
    expect(response.status).toBe(201);
    const upload = (await response.json()) as Schemas["UploadUrl"];
    const missing = await call(`/receipts/${upload.receiptId}/complete`, { method: "POST" });
    expect(missing.status).toBe(409);
    expect(((await missing.json()) as Schemas["Error"]).error.code).toBe("UPLOAD_MISSING");
    const detail = (await (
      await call(`/receipts/${upload.receiptId}`)
    ).json()) as Schemas["ReceiptDetail"];
    expect(detail.receipt).toMatchObject({ sha256: sha.toLowerCase(), originalFilename: "a.png" });
  });

  it("upload: rifiuta capturedAt e nome file non validi", async () => {
    const base = { source: "camera", sha256: nextSha(), mimeType: "image/jpeg", sizeBytes: 10 };
    for (const extra of [
      { capturedAt: "ieri" },
      { originalFilename: "" },
      { originalFilename: "x".repeat(256) },
    ]) {
      const response = await call("/receipts/upload-url", {
        method: "POST",
        json: { ...base, ...extra },
      });
      expect(response.status).toBe(400);
    }
  });

  it("il consumo del dettaglio è quello della chiamata che ha prodotto l'estrazione", async () => {
    const detail = await uploadAndProcess("spesa.jpg");
    expect(detail.receipt.status).toBe("extracted");
    const [usageCall] = await callsOf(detail.receipt.id);
    expect(detail.usage).toEqual({
      provider: usageCall.provider,
      model: usageCall.model,
      totalTokens: usageCall.totalTokens,
      costUsd: usageCall.costUsd,
    });
  });

  it("non è uno scontrino: la chiamata al modello risulta riuscita", async () => {
    const detail = await uploadAndProcess("non-scontrino.jpg");
    expect(detail.receipt).toMatchObject({ status: "failed", errorCode: "NOT_A_RECEIPT" });
    expect(await callsOf(detail.receipt.id)).toMatchObject([{ success: true, errorCode: null }]);
  });

  it("chiave rifiutata con la piattaforma → LLM_UNAVAILABLE", async () => {
    const detail = await uploadAndProcess("chiave-non-valida.jpg");
    expect(detail.receipt).toMatchObject({ status: "failed", errorCode: "LLM_UNAVAILABLE" });
  });

  it("chiave dell'utente rifiutata → USER_KEY_INVALID; con il fallback si usa la piattaforma", async () => {
    const email = "byok-sync@pitock.test";
    const settings = { mode: "byok", provider: "openai", model: "gpt-4o-mini" };
    await call(
      "/settings/ai",
      { method: "PUT", json: { ...settings, fallbackToPlatform: false } },
      email,
    );
    const failed = await uploadAndProcess("chiave-non-valida.jpg", email);
    expect(failed.receipt).toMatchObject({ status: "failed", errorCode: "USER_KEY_INVALID" });

    await call(
      "/settings/ai",
      { method: "PUT", json: { ...settings, fallbackToPlatform: true } },
      email,
    );
    const recovered = await uploadAndProcess("chiave-non-valida-2.jpg", email);
    expect(recovered.receipt.status).toBe("extracted");
    expect(recovered.extraction?.keySource).toBe("platform");
    const calls = await callsOf(recovered.receipt.id, email);
    expect(calls.map((item) => [item.keySource, item.success])).toEqual(
      expect.arrayContaining([
        ["user", false],
        ["platform", true],
      ]),
    );
  });

  it("quota esaurita: nessuna chiamata al modello", async () => {
    const detail = await uploadAndProcess("quota-esaurita.jpg");
    expect(detail.receipt).toMatchObject({
      status: "failed",
      errorCode: "PLATFORM_QUOTA_EXCEEDED",
    });
    expect(await callsOf(detail.receipt.id)).toHaveLength(0);
  });
});
