"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, unwrap } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];
export type Provider = Schemas["Provider"];

/** Modalità, provider, modello, fallback, chiavi salvate (solo last4) e quota (`GET /v1/settings/ai`). */
export function useAiSettings() {
  return useQuery({
    queryKey: queryKeys.settings.ai(),
    queryFn: ({ signal }) => unwrap(api.GET("/v1/settings/ai", { signal })),
  });
}

/** Le impostazioni AI cambiano anche `ai` e la quota di `/v1/me`. */
function useRefreshAiSettings() {
  const queryClient = useQueryClient();
  return (settings?: Schemas["AiSettings"]) => {
    if (settings) queryClient.setQueryData(queryKeys.settings.ai(), settings);
    return Promise.all([
      settings ? undefined : queryClient.invalidateQueries({ queryKey: queryKeys.settings.ai() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.me() }),
    ]);
  };
}

/** Salva modalità, provider, modello e fallback (`PUT /v1/settings/ai`). */
export function useUpdateAiSettings() {
  const refresh = useRefreshAiSettings();
  return useMutation({
    mutationFn: (body: Schemas["AiSettingsInput"]) => unwrap(api.PUT("/v1/settings/ai", { body })),
    onSuccess: (settings) => refresh(settings),
  });
}

/**
 * Verifica e salva la chiave (`PUT /v1/settings/ai/keys/{provider}`). Non usa `useMutation`:
 * la cache delle mutation conserverebbe la chiave in chiaro tra le variabili.
 */
export function useSaveApiKey() {
  const queryClient = useQueryClient();
  const refresh = useRefreshAiSettings();
  const [pending, setPending] = useState(false);

  async function save(provider: Provider, apiKey: string): Promise<Schemas["ApiKeyInfo"]> {
    setPending(true);
    try {
      const info = await unwrap(
        api.PUT("/v1/settings/ai/keys/{provider}", {
          params: { path: { provider } },
          body: { apiKey },
        }),
      );
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.models(provider) }),
      ]);
      return info;
    } finally {
      setPending(false);
    }
  }

  return { save, pending };
}

/** Cancella la chiave; se era in uso il backend torna a `platform` (`DELETE …/keys/{provider}`). */
export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  const refresh = useRefreshAiSettings();
  return useMutation({
    mutationFn: async (provider: Provider) => {
      await unwrap(
        api.DELETE("/v1/settings/ai/keys/{provider}", { params: { path: { provider } } }),
      );
    },
    onSuccess: (_data, provider) => {
      queryClient.removeQueries({ queryKey: queryKeys.settings.models(provider) });
      return refresh();
    },
  });
}

/** Modelli del provider, caricati in tempo reale con la chiave salvata (`GET /v1/settings/ai/models`). */
export function useAiModels(provider: Provider | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.settings.models(provider ?? "anthropic"),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/v1/settings/ai/models", {
          params: { query: { provider: provider ?? "anthropic" } },
          signal,
        }),
      ),
    enabled: enabled && provider !== null,
    staleTime: 5 * 60_000,
  });
}

/** Prova chiave salvata e modello con una chiamata minima (`POST /v1/settings/ai/test`). */
export function useTestAiConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    // Senza `apiKey`: la prova usa la chiave già salvata, che non passa dal browser.
    mutationFn: (body: Omit<Schemas["AiTestInput"], "apiKey">) =>
      unwrap(api.POST("/v1/settings/ai/test", { body })),
    // La prova è registrata nel consumo.
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.usage.all() }),
  });
}
