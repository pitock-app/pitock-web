"use client";

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { queryKeys, type UsageQuery } from "@/lib/api/query-keys";

/** Totali, serie per giorno e dettaglio per modello del consumo LLM (`GET /v1/usage`). */
export function useUsage(query: UsageQuery) {
  return useQuery({
    queryKey: queryKeys.usage.summary(query),
    queryFn: ({ signal }) => unwrap(api.GET("/v1/usage", { params: { query }, signal })),
    placeholderData: keepPreviousData,
  });
}

/** Ultime chiamate LLM, dalla più recente, a pagine (`GET /v1/usage/calls`). */
export function useUsageCalls() {
  return useInfiniteQuery({
    queryKey: queryKeys.usage.calls(),
    queryFn: ({ pageParam, signal }) =>
      unwrap(
        api.GET("/v1/usage/calls", {
          params: { query: { limit: 20, ...(pageParam ? { cursor: pageParam } : {}) } },
          signal,
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}
