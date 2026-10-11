"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { queryKeys, type StatsDatasetQuery } from "@/lib/api/query-keys";

type Dataset = components["schemas"]["StatsDataset"];

/** Periodo del dataset: le pagine (`cursor`, `limit`) le gestisce l'hook. */
export type StatsDatasetRange = Omit<StatsDatasetQuery, "cursor" | "limit">;

/** Scontrini per pagina: il massimo dell'API, così servono meno richieste. */
export const DATASET_PAGE_SIZE = 1000;
/** Oltre queste pagine (50.000 scontrini) il dataset resta troncato ai più recenti. */
export const DATASET_MAX_PAGES = 50;

/**
 * Scarica tutte le pagine del dataset, dal più recente, e le unisce in una sola risposta.
 * `truncated` è vero solo se si è fermato a `maxPages` con altre pagine ancora da leggere.
 */
export async function collectDatasetPages(
  fetchPage: (cursor: string | undefined) => Promise<Dataset>,
  maxPages = DATASET_MAX_PAGES,
): Promise<Dataset> {
  const first = await fetchPage(undefined);
  const receipts = [...first.receipts];
  const items = [...first.items];
  let next = first.nextCursor;
  for (let page = 1; next && page < maxPages; page++) {
    const res = await fetchPage(next);
    receipts.push(...res.receipts);
    items.push(...res.items);
    next = res.nextCursor;
  }
  return { ...first, receipts, items, truncated: next !== null, nextCursor: null };
}

/** Scontrini e righe prodotto del periodo (`GET /v1/stats/dataset`); null non scarica nulla. */
export function useStatsDataset(range: StatsDatasetRange | null) {
  return useQuery({
    queryKey: queryKeys.receipts.dataset(range ?? {}),
    queryFn: ({ signal }) =>
      collectDatasetPages((cursor) =>
        unwrap(
          api.GET("/v1/stats/dataset", {
            params: {
              query: { ...range, limit: DATASET_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
            },
            signal,
          }),
        ),
      ),
    enabled: range !== null,
    placeholderData: keepPreviousData,
  });
}
