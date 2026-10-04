"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { ManualReceiptInput } from "../manual-entry.schema";

/** Inserimento manuale (`POST /v1/receipts/manual`). */
export function useCreateManualReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ManualReceiptInput) => unwrap(api.POST("/v1/receipts/manual", { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.receipts.all() }),
  });
}
