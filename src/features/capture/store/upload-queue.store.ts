import { create } from "zustand";
import type { components } from "@/lib/api/schema";
import { queueOutcome } from "../lib/queue-review";

type Schemas = components["schemas"];

export type QueueSource = Schemas["UploadUrlInput"]["source"];

export type QueueStatus =
  | "queued"
  | "preparing"
  | "hashing"
  | "requesting"
  | "uploading"
  | "completing"
  | "processing"
  | "done"
  | "failed"
  | "duplicate";

/** In quale fase è avvenuto l'errore: decide cosa fa "Riprova". */
export type FailedStep = "upload" | "extraction" | "timeout";

export type QueueResult = Pick<
  Schemas["ExtractionDetail"],
  "merchantName" | "purchasedAt" | "total" | "currency" | "category" | "confidence"
>;

export type QueueItem = {
  id: string;
  file: File;
  name: string;
  source: QueueSource;
  capturedAt?: string;
  status: QueueStatus;
  /** Avanzamento dell'upload (0–100), solo durante "uploading". */
  progress: number | null;
  receiptId?: string;
  duplicateOf?: string;
  errorCode?: string;
  failedStep?: FailedStep;
  result?: QueueResult;
};

export type NewQueueItem = { file: File; source: QueueSource; capturedAt?: string };

/** Transizioni ammesse: le altre vengono ignorate (es. un aggiornamento dopo la rimozione). */
const TRANSITIONS: Record<QueueStatus, readonly QueueStatus[]> = {
  queued: ["preparing"],
  preparing: ["hashing", "failed"],
  hashing: ["requesting", "failed"],
  requesting: ["uploading", "duplicate", "failed"],
  uploading: ["completing", "failed"],
  completing: ["processing", "failed"],
  processing: ["done", "failed"],
  failed: ["queued", "processing"],
  done: [],
  duplicate: [],
};

export const ACTIVE_STATUSES: readonly QueueStatus[] = [
  "queued",
  "preparing",
  "hashing",
  "requesting",
  "uploading",
  "completing",
  "processing",
];

export function canTransition(from: QueueStatus, to: QueueStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

type QueuePatch = Partial<Omit<QueueItem, "id" | "file" | "status">>;

type UploadQueueState = {
  items: QueueItem[];
  add(inputs: NewQueueItem[]): string[];
  /** Cambia stato se la transizione è ammessa; restituisce false altrimenti. */
  transition(id: string, status: QueueStatus, patch?: QueuePatch): boolean;
  setProgress(id: string, progress: number): void;
  remove(id: string): void;
  clearFinished(): void;
  reset(): void;
};

let counter = 0;
function newId(): string {
  counter += 1;
  return globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}-${counter}`;
}

/** Coda di upload: vive solo in memoria, nessuna persistenza. */
export const useUploadQueue = create<UploadQueueState>()((set, get) => ({
  items: [],

  add(inputs) {
    const created: QueueItem[] = inputs.map(({ file, source, capturedAt }) => ({
      id: newId(),
      file,
      name: file.name,
      source,
      capturedAt,
      status: "queued",
      progress: null,
    }));
    set((state) => ({ items: [...state.items, ...created] }));
    return created.map((item) => item.id);
  },

  transition(id, status, patch = {}) {
    const item = get().items.find((entry) => entry.id === id);
    if (!item || !canTransition(item.status, status)) return false;
    set((state) => ({
      items: state.items.map((entry) => {
        if (entry.id !== id) return entry;
        const next: QueueItem = { ...entry, ...patch, status };
        if (status !== "uploading") next.progress = patch.progress ?? null;
        if (status !== "failed") {
          next.errorCode = undefined;
          next.failedStep = undefined;
        }
        return next;
      }),
    }));
    return true;
  },

  setProgress(id, progress) {
    set((state) => ({
      items: state.items.map((entry) =>
        entry.id === id && entry.status === "uploading"
          ? { ...entry, progress: Math.max(0, Math.min(100, progress)) }
          : entry,
      ),
    }));
  },

  remove(id) {
    set((state) => ({ items: state.items.filter((entry) => entry.id !== id) }));
  },

  clearFinished() {
    // Quelli da controllare restano finché l'utente non li toglie a mano.
    set((state) => ({ items: state.items.filter((entry) => queueOutcome(entry) !== "ok") }));
  },

  reset() {
    set({ items: [] });
  },
}));

export type UploadQueueStore = typeof useUploadQueue;

export function hasActiveUploads(items: readonly QueueItem[]): boolean {
  return items.some((item) => ACTIVE_STATUSES.includes(item.status));
}
