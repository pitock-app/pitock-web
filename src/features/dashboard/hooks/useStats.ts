"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { queryKeys, type StatsQuery } from "@/lib/api/query-keys";

/** Statistiche di spesa del periodo (`GET /v1/stats`). */
export function useStats(query: StatsQuery | null) {
  return useQuery({
    queryKey: queryKeys.receipts.stats(query ?? { granularity: "month" }),
    queryFn: ({ signal }) =>
      unwrap(api.GET("/v1/stats", { params: { query: query ?? undefined }, signal })),
    enabled: query !== null,
    placeholderData: keepPreviousData,
  });
}
