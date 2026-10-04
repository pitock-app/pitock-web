import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { createApiClient, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { createMockAccessToken } from "@/lib/auth/mock-session";
import { server, setupMswServer } from "../helpers/msw-server";

setupMswServer();

const BASE_URL = "http://api.test";

function setup(tokens: { current: string | null; refreshed: string | null }) {
  const auth = {
    getAccessToken: vi.fn(async () => tokens.current),
    refreshAccessToken: vi.fn(async () => tokens.refreshed),
  };
  const onSessionExpired = vi.fn();
  const client = createApiClient({ baseUrl: BASE_URL, auth, onSessionExpired });
  return { client, auth, onSessionExpired };
}

describe("client API", () => {
  it("aggiunge il token Bearer e restituisce i dati tipizzati", async () => {
    const { client } = setup({
      current: createMockAccessToken("anna@pitock.test"),
      refreshed: null,
    });
    const me = await unwrap(client.GET("/v1/me"));
    expect(me.email).toBe("anna@pitock.test");
    expect(me.platformQuota.limit).toBe(100);
    expect(me.ai).toEqual({ mode: "platform", provider: "anthropic", model: "claude-haiku-4-5" });
  });

  it("su 401 rinnova la sessione e ripete la richiesta una volta, con lo stesso corpo", async () => {
    const fresh = createMockAccessToken("anna@pitock.test");
    const bodies: unknown[] = [];
    server.use(
      http.post(`${BASE_URL}/v1/receipts/manual`, async ({ request }) => {
        bodies.push(await request.json());
        if (request.headers.get("Authorization") !== `Bearer ${fresh}`) {
          return HttpResponse.json(
            { error: { code: "UNAUTHORIZED", message: "expired", requestId: "r1" } },
            { status: 401 },
          );
        }
        return HttpResponse.json({ ok: true }, { status: 201 });
      }),
    );
    const { client, auth, onSessionExpired } = setup({ current: "scaduto", refreshed: fresh });
    const body = {
      merchantName: "Bar Sport",
      purchasedAt: "2026-10-01T08:00:00Z",
      total: 2.5,
      paymentMethod: "contanti" as const,
      category: "ristorazione" as const,
      currency: "EUR",
    };

    const { response } = await client.POST("/v1/receipts/manual", { body });

    expect(response.status).toBe(201);
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(bodies).toEqual([body, body]);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it("se il refresh non basta chiama onSessionExpired e restituisce ApiError 401", async () => {
    const { client, auth, onSessionExpired } = setup({
      current: "scaduto",
      refreshed: "ancora-scaduto",
    });

    const error = await unwrap(client.GET("/v1/me")).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).code).toBe("UNAUTHORIZED");
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("se il refresh fallisce non ripete la richiesta", async () => {
    const { client, onSessionExpired } = setup({ current: null, refreshed: null });
    await expect(unwrap(client.GET("/v1/me"))).rejects.toMatchObject({ status: 401 });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("converte gli errori di rete in NETWORK_ERROR", async () => {
    server.use(http.get(`${BASE_URL}/v1/me`, () => HttpResponse.error()));
    const { client } = setup({ current: createMockAccessToken("a@b.it"), refreshed: null });
    await expect(unwrap(client.GET("/v1/me"))).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("converte le risposte di errore in ApiError con messaggio italiano", async () => {
    server.use(
      http.get(`${BASE_URL}/v1/me`, () =>
        HttpResponse.json(
          { error: { code: "RATE_LIMITED", message: "slow down", requestId: "r9" } },
          { status: 429 },
        ),
      ),
    );
    const { client } = setup({ current: createMockAccessToken("a@b.it"), refreshed: null });
    await expect(unwrap(client.GET("/v1/me"))).rejects.toMatchObject({
      code: "RATE_LIMITED",
      requestId: "r9",
      message: "Troppe richieste. Riprova tra qualche istante.",
    });
  });
});
