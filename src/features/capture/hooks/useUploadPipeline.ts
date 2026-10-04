"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { invalidateAfterExtraction } from "@/lib/api/query-keys";
import { getAuthProvider } from "@/lib/auth";
import { captureDeps } from "../lib/capture-api";
import { createUploadPipeline, type UploadPipeline } from "../lib/upload-pipeline";
import { useUploadQueue } from "../store/upload-queue.store";

let pipeline: UploadPipeline | null = null;
let queryClientRef: QueryClient | null = null;

/** Pipeline unica nel browser: continua a lavorare anche se l'utente cambia pagina. */
function getPipeline(): UploadPipeline {
  if (!pipeline) {
    pipeline = createUploadPipeline({
      store: useUploadQueue,
      deps: {
        ...captureDeps,
        onReceiptChanged: () => {
          if (queryClientRef) void invalidateAfterExtraction(queryClientRef);
        },
      },
    });
    pipeline.start();
    // Al logout (o al cambio di utente) la coda dell'utente precedente non deve restare.
    let userId: string | undefined;
    getAuthProvider().onSessionChange((session) => {
      const nextUserId = session?.user.id;
      if (!nextUserId || (userId !== undefined && userId !== nextUserId)) {
        pipeline?.stopAll();
        useUploadQueue.getState().reset();
      }
      userId = nextUserId;
    });
  }
  return pipeline;
}

// Azioni stabili: la pipeline viene creata solo nel browser, alla prima chiamata.
const actions: UploadPipeline = {
  start: () => getPipeline().start(),
  retry: (id) => getPipeline().retry(id),
  remove: (id) => getPipeline().remove(id),
  dismiss: (id) => getPipeline().dismiss(id),
  stopAll: () => getPipeline().stopAll(),
};

/** Avvia (una sola volta) la pipeline della coda e ne restituisce le azioni. */
export function useUploadPipeline(): UploadPipeline {
  const queryClient = useQueryClient();
  useEffect(() => {
    queryClientRef = queryClient;
    getPipeline();
  }, [queryClient]);
  return actions;
}
