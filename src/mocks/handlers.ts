import { HttpResponse, http } from "msw";
import type { components } from "@/lib/api/schema";
import { parseMockAccessToken } from "@/lib/auth/mock-session";
import { hasMockFile } from "@/lib/storage/mock-files";
import { aiModes, aiProviders } from "@/lib/api/enums";
import { buildAiSettings, buildMe } from "./data";
import {
  advance,
  deleteOwnerData,
  ownerReceipts,
  createManualReceipt,
  createPendingReceipt,
  deleteReceipt,
  findByExtraction,
  findBySha256,
  findReceipt,
  markUploaded,
  replaceExtraction,
  toDetail,
} from "./db";
import {
  listReceipts,
  parseExtractionPatch,
  parseListQuery,
  parseManualInput,
  parseReextractInput,
  parseUploadUrlInput,
} from "./receipts";
import {
  deleteMockApiKey,
  getMockSettings,
  hasMockApiKey,
  MOCK_MODELS,
  saveMockApiKey,
  setMockSettings,
  verifyMockApiKey,
  type Provider,
} from "./settings";
import { mockStatsDataset, parseStatsQuery, summarizeMockStats } from "./stats";
import {
  listMockUsageCalls,
  parseCallsQuery,
  parseUsageQuery,
  recordMockUsage,
  summarizeMockUsage,
} from "./usage";

type Schemas = components["schemas"];

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const UPLOAD_URL_TTL_MS = 2 * 60 * 1000;

type ErrorBody = components["schemas"]["Error"];

/** Gli handler rispondono a qualunque origine: l'URL dell'API cambia tra ambienti. */
const API = "*/v1";

let requestCounter = 0;

export function errorResponse(status: number, code: string, message: string) {
  requestCounter += 1;
  const body: ErrorBody = { error: { code, message, requestId: `mock-${requestCounter}` } };
  return HttpResponse.json(body, { status });
}

/** Email dell'utente finto ricavata dal token mock, oppure null se il token manca. */
function authenticatedEmail(request: Request): string | null {
  const header = request.headers.get("Authorization");
  return parseMockAccessToken(header?.replace(/^Bearer\s+/i, ""));
}

function unauthorized() {
  return errorResponse(401, "UNAUTHORIZED", "Missing or invalid access token");
}

function validationError(message: string) {
  return errorResponse(400, "VALIDATION_ERROR", message);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Come il backend: un id che non è un UUID è un 400, non un 404. */
function invalidId(id: unknown) {
  return typeof id !== "string" || !UUID.test(id) ? validationError("Invalid id") : null;
}

function notFound() {
  return errorResponse(404, "NOT_FOUND", "Receipt not found");
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Corpo facoltativo: vuoto → {}; JSON non valido → null. */
async function readOptionalJson(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    const body: unknown = JSON.parse(text);
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const includes = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

const MODEL_ID = /^[\w.:/@+-]+$/;
const isModelId = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 1 && value.length <= 200 && MODEL_ID.test(value);
const isApiKey = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 16 && value.length <= 512 && /^\S+$/.test(value);

/** Corpo di `PUT /v1/settings/ai` validato come `AiSettingsInput`; null se non è valido. */
function parseAiSettingsInput(body: Record<string, unknown> | null) {
  if (!body || !includes(aiModes, body.mode)) return null;
  const { provider, model, fallbackToPlatform } = body;
  if (provider !== undefined && provider !== null && !includes(aiProviders, provider)) return null;
  if (model !== undefined && model !== null && !isModelId(model)) return null;
  if (fallbackToPlatform !== undefined && typeof fallbackToPlatform !== "boolean") return null;
  return body as Schemas["AiSettingsInput"];
}

const KEY_ERRORS = {
  USER_KEY_INVALID: { status: 422, message: "API key rejected by the provider" },
  USER_KEY_QUOTA: { status: 422, message: "Provider quota or credit exhausted" },
  PROVIDER_UNAVAILABLE: { status: 502, message: "Provider unreachable, try again later" },
} as const;

/** Testo che fa fallire la prova finta del modello ("LLM_UNAVAILABLE"). */
const UNAVAILABLE_MODEL = /inesistente|unavailable/i;

export const handlers = [
  http.get(`${API}/me`, ({ request }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    return HttpResponse.json<components["schemas"]["Me"]>(buildMe(email));
  }),

  http.post(`${API}/receipts/upload-url`, async ({ request }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const body = parseUploadUrlInput(await readJson(request));
    if (!body) return validationError("Invalid upload request");
    if (body.sizeBytes > MAX_UPLOAD_BYTES) {
      return errorResponse(413, "FILE_TOO_LARGE", "File too large");
    }
    const existing = findBySha256(email, body.sha256);
    if (existing) {
      if (existing.receipt.status !== "pending_upload") {
        requestCounter += 1;
        return HttpResponse.json<Schemas["DuplicateError"]>(
          {
            error: {
              code: "DUPLICATE",
              message: "Receipt already uploaded",
              requestId: `mock-${requestCounter}`,
              duplicateOf: existing.receipt.id,
            },
          },
          { status: 409 },
        );
      }
      deleteReceipt(existing.receipt.id);
    }
    const { entry, path } = createPendingReceipt(email, body);
    return HttpResponse.json<Schemas["UploadUrl"]>(
      {
        receiptId: entry.receipt.id,
        path,
        uploadUrl: `https://storage.mock.local/upload/sign/receipts/${path}?token=mock`,
        token: `mock-upload-token-${entry.receipt.id}`,
        expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_MS).toISOString(),
      },
      { status: 201 },
    );
  }),

  http.post(`${API}/receipts/:id/complete`, ({ request, params }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const badId = invalidId(params.id);
    if (badId) return badId;
    const entry = findReceipt(email, String(params.id));
    if (!entry) return notFound();
    if (entry.receipt.status !== "pending_upload") {
      return errorResponse(409, "INVALID_STATE", "Receipt is not waiting for an upload");
    }
    // Come il backend: senza l'oggetto su Storage lo scontrino resta in attesa del file.
    if (!entry.path || !hasMockFile(entry.path)) {
      return errorResponse(409, "UPLOAD_MISSING", "File not uploaded");
    }
    markUploaded(entry);
    return HttpResponse.json<Schemas["UploadAccepted"]>({ status: "uploaded" }, { status: 202 });
  }),

  http.post(`${API}/receipts/manual`, async ({ request }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const body = parseManualInput(await readJson(request));
    if (!body) return validationError("Invalid manual receipt");
    const entry = createManualReceipt(email, body);
    return HttpResponse.json<Schemas["ReceiptDetail"]>(toDetail(entry), { status: 201 });
  }),

  http.get(`${API}/receipts`, ({ request }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const query = parseListQuery(new URL(request.url).searchParams);
    if (!query) return validationError("Invalid list query");
    return HttpResponse.json<Schemas["ReceiptList"]>(listReceipts(email, query));
  }),

  http.get(`${API}/receipts/:id/extractions`, ({ request, params }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const badId = invalidId(params.id);
    if (badId) return badId;
    const entry = findReceipt(email, String(params.id));
    if (!entry) return notFound();
    advance(entry);
    return HttpResponse.json<Schemas["ExtractionHistory"]>({ items: entry.history });
  }),

  http.patch(`${API}/extractions/:id`, async ({ request, params }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const badId = invalidId(params.id);
    if (badId) return badId;
    // Come il backend: prima la validazione (400), poi l'esistenza (404), poi lo stato (409).
    const patch = parseExtractionPatch(await readJson(request));
    if (!patch) return validationError("Invalid extraction patch");
    const found = findByExtraction(email, String(params.id));
    if (!found) return errorResponse(404, "NOT_FOUND", "Extraction not found");
    // Come il backend: si corregge solo l'estrazione corrente.
    if (!found.extraction.isCurrent) {
      return errorResponse(409, "INVALID_STATE", "Only the current extraction can be edited");
    }
    const updated = { ...found.extraction, ...patch, editedByUser: true };
    replaceExtraction(found.entry, updated);
    return HttpResponse.json<Schemas["ExtractionDetail"]>(updated);
  }),

  http.get(`${API}/receipts/:id`, ({ request, params }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const badId = invalidId(params.id);
    if (badId) return badId;
    const entry = findReceipt(email, String(params.id));
    if (!entry) return notFound();
    advance(entry);
    return HttpResponse.json<Schemas["ReceiptDetail"]>(toDetail(entry));
  }),

  http.post(`${API}/receipts/:id/reextract`, async ({ request, params }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const badId = invalidId(params.id);
    if (badId) return badId;
    const options = parseReextractInput(await readOptionalJson(request));
    if (!options) return validationError("Invalid re-extraction request");
    const entry = findReceipt(email, String(params.id));
    if (!entry) return notFound();
    const { source, status } = entry.receipt;
    // Come il backend: solo scontrini con file già estratti o falliti.
    if (source === "manual" || (status !== "extracted" && status !== "failed")) {
      return errorResponse(409, "INVALID_STATE", "Receipt cannot be re-extracted");
    }
    entry.reextract = options;
    markUploaded(entry);
    return HttpResponse.json<Schemas["UploadAccepted"]>({ status: "uploaded" }, { status: 202 });
  }),

  http.delete(`${API}/receipts/:id`, ({ request, params }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const badId = invalidId(params.id);
    if (badId) return badId;
    const entry = findReceipt(email, String(params.id));
    if (!entry) return notFound();
    deleteReceipt(entry.receipt.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API}/settings/ai`, ({ request }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    return HttpResponse.json<Schemas["AiSettings"]>(buildAiSettings(email));
  }),

  http.put(`${API}/settings/ai`, async ({ request }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const input = parseAiSettingsInput(await readJson(request));
    if (!input) return validationError("Invalid AI settings");
    // Come il backend: i campi omessi restano invariati.
    const current = getMockSettings(email);
    const next = {
      mode: input.mode,
      provider: input.provider === undefined ? current.provider : input.provider,
      model: input.model === undefined ? current.model : input.model,
      fallbackToPlatform: input.fallbackToPlatform ?? current.fallbackToPlatform,
    };
    if (next.mode === "byok") {
      if (!next.provider || !next.model) {
        return validationError("mode=byok requires provider and model");
      }
      if (!hasMockApiKey(email, next.provider)) {
        return errorResponse(409, "USER_KEY_MISSING", `No API key saved for ${next.provider}`);
      }
    }
    setMockSettings(email, next);
    return HttpResponse.json<Schemas["AiSettings"]>(buildAiSettings(email));
  }),

  http.put(`${API}/settings/ai/keys/:provider`, async ({ request, params }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    if (!includes(aiProviders, params.provider)) return validationError("Invalid provider");
    const body = await readJson(request);
    if (!body || !isApiKey(body.apiKey)) return validationError("Invalid API key");
    const failure = verifyMockApiKey(body.apiKey);
    if (failure) {
      const { status, message } = KEY_ERRORS[failure];
      return errorResponse(status, failure, message);
    }
    return HttpResponse.json<Schemas["ApiKeyInfo"]>(
      saveMockApiKey(email, params.provider, body.apiKey),
    );
  }),

  http.delete(`${API}/settings/ai/keys/:provider`, ({ request, params }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    if (!includes(aiProviders, params.provider)) return validationError("Invalid provider");
    if (!deleteMockApiKey(email, params.provider)) {
      return errorResponse(404, "NOT_FOUND", "API key not found");
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API}/settings/ai/models`, ({ request }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const provider = new URL(request.url).searchParams.get("provider");
    if (!includes(aiProviders, provider)) return validationError("Invalid provider");
    // Come il backend: OpenRouter ha un elenco pubblico, gli altri richiedono la chiave.
    if (provider !== "openrouter" && !hasMockApiKey(email, provider)) {
      return errorResponse(409, "USER_KEY_MISSING", `Save an API key for ${provider} first`);
    }
    return HttpResponse.json<Schemas["ModelList"]>({ models: MOCK_MODELS[provider] });
  }),

  http.post(`${API}/settings/ai/test`, async ({ request }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const body = await readJson(request);
    if (
      !body ||
      !includes(aiProviders, body.provider) ||
      !isModelId(body.model) ||
      (body.apiKey !== undefined && !isApiKey(body.apiKey))
    ) {
      return validationError("Invalid AI test request");
    }
    const provider: Provider = body.provider;
    const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
    if (!apiKey && !hasMockApiKey(email, provider)) {
      return errorResponse(409, "USER_KEY_MISSING", `No API key saved for ${provider}`);
    }
    const keyFailure = apiKey ? verifyMockApiKey(apiKey) : null;
    const code =
      keyFailure === "USER_KEY_INVALID" || keyFailure === "USER_KEY_QUOTA"
        ? keyFailure
        : keyFailure || UNAVAILABLE_MODEL.test(body.model)
          ? "LLM_UNAVAILABLE"
          : null;
    // Come il backend: anche la prova viene registrata nel consumo.
    recordMockUsage(email, {
      operation: "key_test",
      provider,
      model: body.model,
      keySource: "user",
      success: code === null,
      errorCode: code,
      tokens: code ? null : { inputTokens: 12, outputTokens: 1, totalTokens: 13 },
    });
    const messages = {
      USER_KEY_INVALID: "API key rejected by the provider",
      USER_KEY_QUOTA: "Provider quota or credit exhausted",
      LLM_UNAVAILABLE: "Model not available with this key",
    } as const;
    return HttpResponse.json<Schemas["AiTestResult"]>(
      code ? { ok: false, error: { code, message: messages[code] } } : { ok: true },
    );
  }),

  http.get(`${API}/usage`, ({ request }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const query = parseUsageQuery(new URL(request.url).searchParams);
    if (!query) return validationError("Invalid date range");
    ownerReceipts(email);
    return HttpResponse.json<Schemas["UsageSummary"]>(summarizeMockUsage(email, query));
  }),

  http.get(`${API}/stats`, ({ request }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const query = parseStatsQuery(new URL(request.url).searchParams);
    if (!query) return validationError("Intervallo di date non valido");
    return HttpResponse.json<Schemas["Stats"]>(summarizeMockStats(email, query));
  }),

  http.get(`${API}/stats/dataset`, ({ request }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const params = new URL(request.url).searchParams;
    params.delete("granularity");
    const query = parseStatsQuery(params);
    if (!query) return validationError("Intervallo di date non valido");
    return HttpResponse.json<Schemas["StatsDataset"]>(mockStatsDataset(email, query));
  }),

  http.get(`${API}/usage/calls`, ({ request }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const query = parseCallsQuery(new URL(request.url).searchParams);
    if (!query) return validationError("Invalid calls query");
    ownerReceipts(email);
    return HttpResponse.json<Schemas["UsageCallList"]>(
      listMockUsageCalls(
        email,
        query,
        (receiptId) => findReceipt(email, receiptId)?.extraction?.merchantName ?? null,
      ),
    );
  }),

  http.delete(`${API}/account`, async ({ request }) => {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();
    const body = await readJson(request);
    if (!body || body.confirm !== "ELIMINA") return validationError("Confirmation required");
    deleteOwnerData(email);
    return new HttpResponse(null, { status: 204 });
  }),
];
