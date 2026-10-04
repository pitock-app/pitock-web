import type { components } from "@/lib/api/schema";
import { romeLocalInputToIso, toRomeDateInput } from "@/lib/format";
import { decodeCursor, encodeCursor } from "./cursor";
import { parseInstant, parseRangeEnd } from "./dates";
import { mockCostUsd } from "./settings";

type Schemas = components["schemas"];
type UsageCall = Schemas["UsageCall"];
type Totals = Schemas["UsageTotals"];

/** Chiamate LLM per utente (righe di `llm_usage`), dalla più vecchia. */
const calls = new Map<string, UsageCall[]>();

export function resetMockUsage() {
  calls.clear();
}

export function forgetMockUsage(owner: string) {
  calls.delete(owner);
}

/** Come `receipt_id … on delete set null` del backend: le chiamate restano, senza scontrino. */
export function detachMockUsageReceipt(owner: string, receiptId: string) {
  for (const call of calls.get(owner) ?? []) {
    if (call.receiptId === receiptId) call.receiptId = null;
  }
}

function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

/** Token finti ma stabili per la chiamata, come se li avesse restituiti il provider. */
export function mockTokens(seed: string) {
  const value = hash(seed);
  const inputTokens = 1400 + (value % 700);
  const outputTokens = 220 + (value % 160);
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

export function recordMockUsage(
  owner: string,
  call: Pick<UsageCall, "operation" | "provider" | "model" | "keySource" | "success"> &
    Partial<Pick<UsageCall, "createdAt" | "errorCode" | "receiptId">> & {
      tokens?: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
    },
): UsageCall {
  const id = crypto.randomUUID();
  const tokens = call.tokens === undefined ? mockTokens(id) : call.tokens;
  const row: UsageCall = {
    id,
    createdAt: call.createdAt ?? new Date().toISOString(),
    operation: call.operation,
    provider: call.provider,
    model: call.model,
    keySource: call.keySource,
    inputTokens: tokens?.inputTokens ?? null,
    outputTokens: tokens?.outputTokens ?? null,
    totalTokens: tokens?.totalTokens ?? null,
    costUsd: mockCostUsd(
      call.provider,
      call.model,
      tokens?.inputTokens ?? null,
      tokens?.outputTokens ?? null,
    ),
    latencyMs: 800 + (hash(id) % 2400),
    success: call.success,
    errorCode: call.errorCode ?? null,
    receiptId: call.receiptId ?? null,
    merchantName: null,
  };
  const list = calls.get(owner) ?? [];
  list.push(row);
  calls.set(owner, list);
  return row;
}

/** Scontrini letti con Pitock AI dal primo del mese (a Roma), come `countPlatformCallsSince`. */
export function countMockPlatformCalls(owner: string, now = new Date()): number {
  const since = monthStart(now);
  return (calls.get(owner) ?? []).filter(
    (call) =>
      call.keySource === "platform" &&
      call.operation !== "key_test" &&
      Date.parse(call.createdAt) >= since,
  ).length;
}

function monthStart(now: Date): number {
  const [year, month] = toRomeDateInput(now).split("-");
  return Date.parse(romeLocalInputToIso(`${year}-${month}-01T00:00`) ?? "");
}

export type UsageQuery = { from: number; to: number; groupBy: "day" | "model" };

/** Query di `GET /v1/usage` validata come nel backend; null se non è valida. */
export function parseUsageQuery(params: URLSearchParams, now = Date.now()): UsageQuery | null {
  const fromText = params.get("from");
  const toText = params.get("to");
  const groupBy = params.get("groupBy") ?? "day";
  if (groupBy !== "day" && groupBy !== "model") return null;
  const from = fromText === null ? monthStart(new Date(now)) : parseInstant(fromText);
  const to = toText === null ? now + 1 : parseRangeEnd(toText);
  if (from === null || to === null || from >= to) return null;
  return { from, to, groupBy };
}

const emptyTotals = (): Totals => ({
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
  unpricedCalls: 0,
});

function add(totals: Totals, call: UsageCall) {
  totals.calls += 1;
  totals.inputTokens += call.inputTokens ?? 0;
  totals.outputTokens += call.outputTokens ?? 0;
  if (call.costUsd === null) totals.unpricedCalls += 1;
  else totals.costUsd += call.costUsd;
}

export function summarizeMockUsage(owner: string, query: UsageQuery): Schemas["UsageSummary"] {
  const inRange = (calls.get(owner) ?? []).filter((call) => {
    const at = Date.parse(call.createdAt);
    return at >= query.from && at < query.to;
  });
  const totals = emptyTotals();
  const byDay = new Map<string, Totals>();
  const byModel = new Map<string, Totals & { provider: string; model: string }>();
  for (const call of inRange) {
    add(totals, call);
    const day = toRomeDateInput(new Date(call.createdAt));
    const dayTotals = byDay.get(day) ?? emptyTotals();
    add(dayTotals, call);
    byDay.set(day, dayTotals);
    const modelKey = `${call.provider}/${call.model}`;
    const modelTotals = byModel.get(modelKey) ?? {
      provider: call.provider,
      model: call.model,
      ...emptyTotals(),
    };
    add(modelTotals, call);
    byModel.set(modelKey, modelTotals);
  }
  // Come il backend: per provider, poi per modello.
  const models = [...byModel.values()].sort(
    (a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model),
  );
  const series =
    query.groupBy === "model"
      ? models.map(({ provider, model, ...rest }) => ({ key: `${provider}/${model}`, ...rest }))
      : [...byDay.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, rest]) => ({ key, ...rest }));
  return {
    from: new Date(query.from).toISOString(),
    to: new Date(query.to).toISOString(),
    totals,
    series,
    byModel: models,
  };
}

export type CallsQuery = { cursor?: string; limit: number };

export function parseCallsQuery(params: URLSearchParams): CallsQuery | null {
  const limitText = params.get("limit");
  const limit = limitText === null ? 20 : Number(limitText);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return null;
  const cursor = params.get("cursor") ?? undefined;
  if (cursor !== undefined && (cursor.length > 200 || !decodeCursor(cursor))) return null;
  return { limit, ...(cursor ? { cursor } : {}) };
}

/** Ultime chiamate, dalla più recente, con paginazione a cursore. */
export function listMockUsageCalls(
  owner: string,
  query: CallsQuery,
  /** Esercente dell'estrazione corrente, letto al momento come il join del backend. */
  merchantOf: (receiptId: string) => string | null = () => null,
): Schemas["UsageCallList"] {
  const sorted = [...(calls.get(owner) ?? [])].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  const start = cursor
    ? sorted.filter(
        (call) =>
          call.createdAt > cursor.createdAt ||
          (call.createdAt === cursor.createdAt && call.id >= cursor.id),
      ).length
    : 0;
  const items = sorted.slice(start, start + query.limit).map((call) => ({
    ...call,
    merchantName: call.receiptId ? merchantOf(call.receiptId) : null,
  }));
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      last && start + query.limit < sorted.length
        ? encodeCursor({ createdAt: last.createdAt, id: last.id })
        : null,
  };
}
