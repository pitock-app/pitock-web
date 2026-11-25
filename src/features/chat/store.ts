import { create } from "zustand";
import type { components } from "@/lib/api/schema";

export type ChatChart = components["schemas"]["ChatChart"];

export type ChatEntry =
  | { id: number; role: "user"; content: string }
  | { id: number; role: "assistant"; content: string; grounded: boolean; charts: ChatChart[] };

/** Una voce senza `id` (Omit distribuito sull'unione). */
type NewEntry = ChatEntry extends infer E ? (E extends unknown ? Omit<E, "id"> : never) : never;

type ChatState = {
  entries: ChatEntry[];
  add(entry: NewEntry): void;
  clear(): void;
};

let nextId = 0;

/**
 * Conversazione in memoria, condivisa tra il pulsante della sidebar e quello dell'header.
 * Il server non la salva: si perde ricaricando la pagina.
 */
export const useChatStore = create<ChatState>((set) => ({
  entries: [],
  add: (entry) =>
    set((s) => ({ entries: [...s.entries, { ...entry, id: nextId++ } as ChatEntry] })),
  clear: () => set({ entries: [] }),
}));
