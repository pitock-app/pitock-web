"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { invalidateAfterExtraction, queryKeys } from "@/lib/api/query-keys";
import type { components } from "@/lib/api/schema";
import { isPendingStatus } from "../lib/status";
import { PROCESSING_REFRESH_MS } from "./useReceipts";

type Schemas = components["schemas"];

/** Dettaglio con estrazione corrente e URL firmato del file (`GET /v1/receipts/{id}`). */
export function useReceipt(id: string) {
  return useQuery({
    queryKey: queryKeys.receipts.detail(id),
    queryFn: ({ signal }) =>
      unwrap(api.GET("/v1/receipts/{id}", { params: { path: { id } }, signal })),
    refetchInterval: (q) =>
      q.state.data && isPendingStatus(q.state.data.receipt.status) ? PROCESSING_REFRESH_MS : false,
  });
}

/** Storico delle estrazioni, dalla più recente (`GET /v1/receipts/{id}/extractions`). */
export function useExtractions(id: string) {
  return useQuery({
    queryKey: queryKeys.receipts.extractions(id),
    queryFn: ({ signal }) =>
      unwrap(api.GET("/v1/receipts/{id}/extractions", { params: { path: { id } }, signal })),
  });
}

/** Correzione dell'estrazione corrente (`PATCH /v1/extractions/{id}`). */
export function useUpdateExtraction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      extractionId,
      body,
    }: {
      extractionId: string;
      body: Schemas["ExtractionPatch"];
    }) =>
      unwrap(api.PATCH("/v1/extractions/{id}", { params: { path: { id: extractionId } }, body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.receipts.all() }),
  });
}

/** Rielaborazione con provider e modello facoltativi (`POST /v1/receipts/{id}/reextract`). */
export function useReextract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Schemas["ReextractInput"] }) =>
      unwrap(api.POST("/v1/receipts/{id}/reextract", { params: { path: { id } }, body })),
    onSuccess: () => invalidateAfterExtraction(queryClient),
  });
}

/** Eliminazione di file, estrazioni e righe (`DELETE /v1/receipts/{id}`). */
export function useDeleteReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await unwrap(api.DELETE("/v1/receipts/{id}", { params: { path: { id } } }));
    },
    onSuccess: (_data, id) => {
      // Niente nuove richieste per uno scontrino che non esiste più.
      queryClient.removeQueries({ queryKey: queryKeys.receipts.detail(id) });
      queryClient.removeQueries({ queryKey: queryKeys.receipts.extractions(id) });
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.receipts.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.receipts.allStats() }),
      ]);
    },
  });
}
