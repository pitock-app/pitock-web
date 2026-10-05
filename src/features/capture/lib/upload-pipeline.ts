import { isApiError } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import type { SignedUpload } from "@/lib/storage";
import { itemsSum } from "@/lib/extraction";
import type { QueueItem, QueueResult, UploadQueueStore } from "../store/upload-queue.store";
import type { PreparedFile } from "./prepare-file";

type Schemas = components["schemas"];

export const MAX_PARALLEL_UPLOADS = 3;
export const POLL_INTERVAL_MS = 3000;
export const POLL_TIMEOUT_MS = 2 * 60 * 1000;

/** Dipendenze iniettate: in produzione API e Storage veri (o mock), nei test dei finti. */
export type PipelineDeps = {
  prepareFile(file: File, signal: AbortSignal): Promise<PreparedFile>;
  sha256(file: Blob): Promise<string>;
  requestUploadUrl(
    input: Schemas["UploadUrlInput"],
    signal: AbortSignal,
  ): Promise<Schemas["UploadUrl"]>;
  upload(upload: SignedUpload): Promise<void>;
  complete(receiptId: string, signal: AbortSignal): Promise<void>;
  getReceipt(receiptId: string, signal: AbortSignal): Promise<Schemas["ReceiptDetail"]>;
  reextract(receiptId: string): Promise<void>;
  deleteReceipt(receiptId: string): Promise<void>;
  /** Chiamata quando uno scontrino cambia (creato, elaborato, eliminato). */
  onReceiptChanged?(receiptId: string): void;
};

type PipelineOptions = {
  store: UploadQueueStore;
  deps: PipelineDeps;
  concurrency?: number;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  now?: () => number;
};

function errorCode(error: unknown): string {
  if (isApiError(error)) return error.code;
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return "UNKNOWN";
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Annullato", "AbortError"));
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Annullato", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function toResult(detail: Schemas["ReceiptDetail"]): QueueResult {
  const extraction = detail.extraction;
  return {
    merchantName: extraction?.merchantName ?? null,
    purchasedAt: extraction?.purchasedAt ?? null,
    total: extraction?.total ?? null,
    currency: extraction?.currency ?? "EUR",
    category: extraction?.category ?? null,
    confidence: extraction?.confidence ?? null,
    itemsSum: itemsSum(detail.items),
  };
}

/**
 * Pipeline della coda: per ogni elemento preparing → hashing → requesting → uploading →
 * completing → processing → done (o failed / duplicate). Al massimo `concurrency` upload
 * insieme; il polling dell'elaborazione non occupa uno slot.
 */
export function createUploadPipeline(options: PipelineOptions) {
  const {
    store,
    deps,
    concurrency = MAX_PARALLEL_UPLOADS,
    pollIntervalMs = POLL_INTERVAL_MS,
    pollTimeoutMs = POLL_TIMEOUT_MS,
    now = Date.now,
  } = options;
  const controllers = new Map<string, AbortController>();
  let active = 0;

  const get = (id: string) => store.getState().items.find((item) => item.id === id);
  const transition = (
    ...args: Parameters<ReturnType<UploadQueueStore["getState"]>["transition"]>
  ) => store.getState().transition(...args);

  function controllerFor(id: string): AbortController {
    controllers.get(id)?.abort();
    const controller = new AbortController();
    controllers.set(id, controller);
    return controller;
  }

  function fail(id: string, error: unknown, failedStep: QueueItem["failedStep"] = "upload") {
    if (isAbort(error)) return;
    transition(id, "failed", { errorCode: errorCode(error), failedStep });
  }

  async function poll(id: string, receiptId: string, signal: AbortSignal) {
    const startedAt = now();
    try {
      while (true) {
        await sleep(pollIntervalMs, signal);
        let detail: Schemas["ReceiptDetail"];
        try {
          detail = await deps.getReceipt(receiptId, signal);
        } catch (error) {
          // Errori di rete o temporanei: si riprova al giro successivo.
          if (isAbort(error) || (isApiError(error) && error.status === 404)) throw error;
          if (now() - startedAt >= pollTimeoutMs) throw error;
          continue;
        }
        const { status, errorCode: receiptError } = detail.receipt;
        if (status === "extracted") {
          transition(id, "done", { result: toResult(detail) });
          deps.onReceiptChanged?.(receiptId);
          return;
        }
        if (status === "failed") {
          transition(id, "failed", {
            errorCode: receiptError ?? "UNKNOWN",
            failedStep: "extraction",
          });
          deps.onReceiptChanged?.(receiptId);
          return;
        }
        if (now() - startedAt >= pollTimeoutMs) {
          transition(id, "failed", { errorCode: "PROCESSING_TIMEOUT", failedStep: "timeout" });
          return;
        }
      }
    } catch (error) {
      // Scontrino sparito (404): "Riprova" ricomincia l'upload; altrimenti riprende il polling.
      fail(id, error, isApiError(error) && error.status === 404 ? "upload" : "timeout");
    } finally {
      if (controllers.get(id)?.signal === signal) controllers.delete(id);
    }
  }

  async function upload(item: QueueItem, signal: AbortSignal): Promise<string | null> {
    const { id } = item;
    try {
      if (!transition(id, "preparing")) return null;
      const prepared = await deps.prepareFile(item.file, signal);

      if (!transition(id, "hashing")) return null;
      const hash = await deps.sha256(prepared.file);
      signal.throwIfAborted();

      if (!transition(id, "requesting")) return null;
      let target: Schemas["UploadUrl"];
      try {
        target = await deps.requestUploadUrl(
          {
            source: item.source,
            sha256: hash,
            mimeType: prepared.mimeType,
            sizeBytes: prepared.file.size,
            ...(item.capturedAt ? { capturedAt: item.capturedAt } : {}),
            ...(item.source === "file" && item.name
              ? { originalFilename: item.name.slice(0, 255) }
              : {}),
          },
          signal,
        );
      } catch (error) {
        if (isApiError(error) && error.code === "DUPLICATE" && error.duplicateOf) {
          transition(id, "duplicate", { duplicateOf: error.duplicateOf });
          return null;
        }
        throw error;
      }

      if (!transition(id, "uploading", { receiptId: target.receiptId, progress: 0 })) return null;
      await deps.upload({
        path: target.path,
        token: target.token,
        file: prepared.file,
        contentType: prepared.mimeType,
        signal,
        onProgress: (percent) => store.getState().setProgress(id, percent),
      });
      signal.throwIfAborted();

      if (!transition(id, "completing")) return null;
      await deps.complete(target.receiptId, signal);
      if (!transition(id, "processing")) return null;
      deps.onReceiptChanged?.(target.receiptId);
      return target.receiptId;
    } catch (error) {
      fail(id, error, "upload");
      return null;
    }
  }

  function schedule() {
    while (active < concurrency) {
      const next = store.getState().items.find((item) => item.status === "queued");
      if (!next) return;
      active += 1;
      const { signal } = controllerFor(next.id);
      // Lo stato passa subito a "preparing", quindi lo stesso elemento non viene ripreso.
      void upload(next, signal).then((receiptId) => {
        active -= 1;
        if (receiptId && !signal.aborted) void poll(next.id, receiptId, signal);
        else if (controllers.get(next.id)?.signal === signal) controllers.delete(next.id);
        schedule();
      });
    }
  }

  async function retry(id: string) {
    const item = get(id);
    if (!item || item.status !== "failed") return;
    if (item.failedStep === "extraction" && item.receiptId) {
      const receiptId = item.receiptId;
      const { signal } = controllerFor(id);
      try {
        await deps.reextract(receiptId);
      } catch (error) {
        transition(id, "failed", { errorCode: errorCode(error), failedStep: "extraction" });
        return;
      }
      if (transition(id, "processing")) void poll(id, receiptId, signal);
      return;
    }
    if (item.failedStep === "timeout" && item.receiptId) {
      const receiptId = item.receiptId;
      if (transition(id, "processing")) void poll(id, receiptId, controllerFor(id).signal);
      return;
    }
    // Upload non riuscito: si ricomincia da capo (il backend riusa lo scontrino non completato).
    transition(id, "queued", { receiptId: undefined });
  }

  /** Toglie l'elemento dalla coda e interrompe ciò che sta facendo. */
  function dismiss(id: string) {
    controllers.get(id)?.abort();
    controllers.delete(id);
    store.getState().remove(id);
  }

  /** Elimina anche lo scontrino sul server, se era già stato creato. */
  async function remove(id: string) {
    const item = get(id);
    if (!item) return;
    controllers.get(id)?.abort();
    if (item.receiptId) {
      try {
        await deps.deleteReceipt(item.receiptId);
      } catch (error) {
        if (!(isApiError(error) && error.status === 404)) throw error;
      }
      deps.onReceiptChanged?.(item.receiptId);
    }
    dismiss(id);
  }

  /** Interrompe tutto (es. al logout): upload e polling in corso vengono annullati. */
  function stopAll() {
    controllers.forEach((controller) => controller.abort());
    controllers.clear();
  }

  /** Avvia l'elaborazione degli elementi in coda; restituisce la funzione per fermarla. */
  function start() {
    schedule();
    const unsubscribe = store.subscribe(schedule);
    return () => {
      unsubscribe();
    };
  }

  return { start, retry, remove, dismiss, stopAll };
}

export type UploadPipeline = ReturnType<typeof createUploadPipeline>;
