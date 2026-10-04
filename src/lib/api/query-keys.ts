import type { QueryClient } from "@tanstack/react-query";
import type { paths } from "./schema";

export type UsageQuery = NonNullable<paths["/v1/usage"]["get"]["parameters"]["query"]>;
export type StatsQuery = NonNullable<paths["/v1/stats"]["get"]["parameters"]["query"]>;
export type StatsDatasetQuery = NonNullable<
  paths["/v1/stats/dataset"]["get"]["parameters"]["query"]
>;
type Provider = paths["/v1/settings/ai/models"]["get"]["parameters"]["query"]["provider"];

export type ReceiptListQuery = Omit<
  NonNullable<paths["/v1/receipts"]["get"]["parameters"]["query"]>,
  "cursor" | "limit"
>;

/** Chiavi di TanStack Query, centralizzate per invalidazioni coerenti. */
export const queryKeys = {
  me: () => ["me"] as const,
  receipts: {
    all: () => ["receipts"] as const,
    lists: () => ["receipts", "list"] as const,
    list: (query: ReceiptListQuery) => ["receipts", "list", query] as const,
    detail: (id: string) => ["receipts", "detail", id] as const,
    extractions: (id: string) => ["receipts", "extractions", id] as const,
    /** Sotto "receipts": ogni modifica agli scontrini invalida anche le statistiche. */
    allStats: () => ["receipts", "stats"] as const,
    stats: (query: StatsQuery) => ["receipts", "stats", query] as const,
    dataset: (query: StatsDatasetQuery) => ["receipts", "stats", "dataset", query] as const,
  },
  settings: {
    ai: () => ["settings", "ai"] as const,
    models: (provider: Provider) => ["settings", "ai", "models", provider] as const,
  },
  usage: {
    all: () => ["usage"] as const,
    summary: (query: UsageQuery) => ["usage", "summary", query] as const,
    calls: () => ["usage", "calls"] as const,
  },
} as const;

/**
 * Dopo un'estrazione (o una rielaborazione): cambiano gli scontrini, la quota della
 * piattaforma (in `/v1/me` e nelle impostazioni AI) e il consumo.
 */
export function invalidateAfterExtraction(queryClient: QueryClient) {
  return Promise.all(
    [queryKeys.receipts.all(), queryKeys.me(), queryKeys.settings.ai(), queryKeys.usage.all()].map(
      (queryKey) => queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
