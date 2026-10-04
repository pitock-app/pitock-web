"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { queryKeys, type StatsDatasetQuery } from "@/lib/api/query-keys";

/** Scontrini e righe prodotto del periodo (`GET /v1/stats/dataset`); null non scarica nulla. */
export function useStatsDataset(query: StatsDatasetQuery | null) {
  return useQuery({
    queryKey: queryKeys.receipts.dataset(query ?? {}),
    queryFn: ({ signal }) =>
      unwrap(api.GET("/v1/stats/dataset", { params: { query: query ?? undefined }, signal })),
    enabled: query !== null,
    placeholderData: keepPreviousData,
  });
}
