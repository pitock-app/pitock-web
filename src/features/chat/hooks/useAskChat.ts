"use client";

import { useMutation } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import type { ChatEntry } from "../store";

/** Limiti del contratto (`ChatRequest`): ultimi 20 messaggi, 2000 caratteri ciascuno. */
const MAX_MESSAGES = 20;
const MAX_CHARS = 2000;

/** Domanda all'assistente (`POST /v1/chat`) con la conversazione fin qui. */
export function useAskChat() {
  return useMutation({
    mutationFn: (entries: ChatEntry[]) =>
      unwrap(
        api.POST("/v1/chat", {
          body: {
            messages: entries.slice(-MAX_MESSAGES).map((e) => ({
              role: e.role,
              content: e.content.slice(0, MAX_CHARS),
            })),
          },
        }),
      ),
  });
}
