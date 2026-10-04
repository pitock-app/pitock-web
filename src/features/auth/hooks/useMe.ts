"use client";

import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

/** Profilo e quota dell'utente (`GET /v1/me`). */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: ({ signal }) => unwrap(api.GET("/v1/me", { signal })),
  });
}
