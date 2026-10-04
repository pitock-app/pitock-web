"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { queryKeys, type ReceiptListQuery } from "@/lib/api/query-keys";
import type { components } from "@/lib/api/schema";
import { isPendingStatus } from "../lib/status";

type ReceiptList = components["schemas"]["ReceiptList"];

export const RECEIPTS_PAGE_SIZE = 20;
/** Aggiornamento degli scontrini in elaborazione, come il polling della coda. */
export const PROCESSING_REFRESH_MS = 3000;

/** Lista paginata a cursore (`GET /v1/receipts`); si aggiorna da sola se qualcosa è in elaborazione. */
export function useReceipts(query: ReceiptListQuery) {
  return useInfiniteQuery({
    queryKey: queryKeys.receipts.list(query),
    queryFn: ({ pageParam, signal }) =>
      unwrap(
        api.GET("/v1/receipts", {
          params: {
            query: {
              ...query,
              limit: RECEIPTS_PAGE_SIZE,
              ...(pageParam ? { cursor: pageParam } : {}),
            },
          },
          signal,
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: ReceiptList) => last.nextCursor ?? undefined,
    // Cambiando i filtri resta visibile la lista precedente finché arriva la nuova.
    placeholderData: keepPreviousData,
    refetchInterval: (q) =>
      q.state.data?.pages.some((page) => page.items.some((item) => isPendingStatus(item.status)))
        ? PROCESSING_REFRESH_MS
        : false,
  });
}
