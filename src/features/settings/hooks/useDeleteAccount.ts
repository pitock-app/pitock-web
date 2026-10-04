"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, unwrap } from "@/lib/api/client";
import { getAuthProvider } from "@/lib/auth";

/** Cancella account e dati (`DELETE /v1/account`), poi logout e ritorno alla home. */
export function useDeleteAccount() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await unwrap(api.DELETE("/v1/account", { body: { confirm: "ELIMINA" } }));
    },
    onSuccess: async () => {
      // L'utente non esiste più: il logout può fallire lato server, la sessione locale va chiusa comunque.
      await getAuthProvider()
        .signOut()
        .catch(() => undefined);
      queryClient.clear();
      router.replace("/");
      router.refresh();
    },
  });
}
