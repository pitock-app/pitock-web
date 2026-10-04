import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUploadPipeline, type PipelineDeps } from "@/features/capture/lib/upload-pipeline";
import { useUploadQueue } from "@/features/capture/store/upload-queue.store";
import { ApiError } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

type Detail = components["schemas"]["ReceiptDetail"];
const store = useUploadQueue;
const items = () => store.getState().items;

function detail(id: string, status: Detail["receipt"]["status"], errorCode: string | null = null) {
  return {
    receipt: {
      id,
      source: "file",
      status,
      originalFilename: null,
      sha256: null,
      mimeType: "image/jpeg",
      sizeBytes: 1,
      capturedAt: null,
      errorCode,
      createdAt: "2026-10-04T10:00:00Z",
      updatedAt: "2026-10-04T10:00:00Z",
    },
    items: [],
    ...(status === "extracted"
      ? {
          extraction: {
            merchantName: "Esselunga",
            purchasedAt: "2026-10-04T10:00:00Z",
            total: 23.4,
            currency: "EUR",
            category: "alimentari",
          } as Detail["extraction"],
        }
      : {}),
  } as Detail;
}

function createDeps(overrides: Partial<PipelineDeps> = {}) {
  let counter = 0;
  const polls = new Map<string, number>();
  const deps: PipelineDeps = {
    prepareFile: vi.fn(async (file: File) => ({ file, mimeType: "image/jpeg" as const })),
    sha256: vi.fn(async (file: Blob) => `hash-${(file as File).name}`),
    requestUploadUrl: vi.fn(async () => {
      counter += 1;
      return {
        receiptId: `r${counter}`,
        path: `u/r${counter}.jpg`,
        uploadUrl: "https://storage.test/upload",
        token: "t",
        expiresAt: "2026-10-04T10:02:00Z",
      };
    }),
    upload: vi.fn(async ({ onProgress }) => {
      onProgress?.(50);
      onProgress?.(100);
    }),
    complete: vi.fn(async () => undefined),
    // Prima risposta "processing", poi "extracted".
    getReceipt: vi.fn(async (id: string) => {
      const count = (polls.get(id) ?? 0) + 1;
      polls.set(id, count);
      return detail(id, count < 2 ? "processing" : "extracted");
    }),
    reextract: vi.fn(async () => undefined),
    deleteReceipt: vi.fn(async () => undefined),
    onReceiptChanged: vi.fn(),
    ...overrides,
  };
  return deps;
}

const file = (name: string) => new File(["x"], name, { type: "image/jpeg" });
let stop: (() => void) | undefined;

function start(deps: PipelineDeps, options: { pollTimeoutMs?: number; concurrency?: number } = {}) {
  const pipeline = createUploadPipeline({ store, deps, pollIntervalMs: 5, ...options });
  stop = pipeline.start();
  return pipeline;
}

beforeEach(() => store.getState().reset());
afterEach(() => stop?.());

describe("pipeline di upload", () => {
  it("porta tre file da queued a done passando per tutti i passi", async () => {
    const deps = createDeps();
    const seen = new Set<string>();
    const unsubscribe = store.subscribe((state) =>
      state.items.forEach((item) => seen.add(item.status)),
    );
    start(deps);
    store
      .getState()
      .add(
        ["a.jpg", "b.jpg", "c.jpg"].map((name) => ({ file: file(name), source: "file" as const })),
      );

    await vi.waitFor(() => expect(items().every((item) => item.status === "done")).toBe(true));
    unsubscribe();

    expect([...seen]).toEqual(
      expect.arrayContaining([
        "preparing",
        "hashing",
        "requesting",
        "uploading",
        "completing",
        "processing",
        "done",
      ]),
    );
    expect(items()[0].result).toMatchObject({ merchantName: "Esselunga", total: 23.4 });
    expect(deps.requestUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "file",
        sha256: "hash-a.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1,
        originalFilename: "a.jpg",
      }),
      expect.any(AbortSignal),
    );
    expect(deps.complete).toHaveBeenCalledTimes(3);
  });

  it("non supera 3 upload in parallelo", async () => {
    let running = 0;
    let peak = 0;
    const deps = createDeps({
      upload: vi.fn(async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 10));
        running -= 1;
      }),
    });
    start(deps);
    store
      .getState()
      .add(
        Array.from({ length: 7 }, (_, i) => ({ file: file(`${i}.jpg`), source: "file" as const })),
      );
    await vi.waitFor(() => expect(items().every((item) => item.status === "done")).toBe(true));
    expect(peak).toBe(3);
  });

  it("segna come duplicato un 409 DUPLICATE", async () => {
    const deps = createDeps({
      requestUploadUrl: vi.fn(async () => {
        throw new ApiError({ code: "DUPLICATE", status: 409, duplicateOf: "r-old" });
      }),
    });
    start(deps);
    store.getState().add([{ file: file("a.jpg"), source: "camera" }]);
    await vi.waitFor(() => expect(items()[0].status).toBe("duplicate"));
    expect(items()[0].duplicateOf).toBe("r-old");
    expect(deps.upload).not.toHaveBeenCalled();
  });

  it("estrazione fallita: mostra il codice e Riprova rilancia l'estrazione", async () => {
    let fail = true;
    const deps = createDeps({
      getReceipt: vi.fn(async (id: string) =>
        fail ? detail(id, "failed", "NOT_A_RECEIPT") : detail(id, "extracted"),
      ),
    });
    const pipeline = start(deps);
    const [id] = store.getState().add([{ file: file("a.jpg"), source: "file" }]);
    await vi.waitFor(() => expect(items()[0].status).toBe("failed"));
    expect(items()[0]).toMatchObject({ errorCode: "NOT_A_RECEIPT", failedStep: "extraction" });

    fail = false;
    await pipeline.retry(id);
    expect(deps.reextract).toHaveBeenCalledWith("r1");
    await vi.waitFor(() => expect(items()[0].status).toBe("done"));
    expect(deps.requestUploadUrl).toHaveBeenCalledTimes(1);
  });

  it("upload fallito: Riprova ricomincia da capo", async () => {
    const upload = vi
      .fn<PipelineDeps["upload"]>()
      .mockRejectedValueOnce(Object.assign(new Error("rete"), { code: "UPLOAD_FAILED" }))
      .mockResolvedValue(undefined);
    const deps = createDeps({ upload });
    const pipeline = start(deps);
    const [id] = store.getState().add([{ file: file("a.jpg"), source: "file" }]);
    await vi.waitFor(() => expect(items()[0].status).toBe("failed"));
    expect(items()[0]).toMatchObject({ errorCode: "UPLOAD_FAILED", failedStep: "upload" });

    await pipeline.retry(id);
    await vi.waitFor(() => expect(items()[0].status).toBe("done"));
    expect(deps.requestUploadUrl).toHaveBeenCalledTimes(2);
  });

  it("dopo il tempo massimo di polling segnala il ritardo", async () => {
    const deps = createDeps({ getReceipt: vi.fn(async (id: string) => detail(id, "processing")) });
    start(deps, { pollTimeoutMs: 20 });
    store.getState().add([{ file: file("a.jpg"), source: "file" }]);
    await vi.waitFor(() => expect(items()[0].status).toBe("failed"));
    expect(items()[0]).toMatchObject({ errorCode: "PROCESSING_TIMEOUT", failedStep: "timeout" });
  });

  it("Elimina cancella lo scontrino sul server e lo toglie dalla coda", async () => {
    const deps = createDeps({
      getReceipt: vi.fn(async (id: string) => detail(id, "failed", "INVALID_OUTPUT")),
    });
    const pipeline = start(deps);
    const [id] = store.getState().add([{ file: file("a.jpg"), source: "file" }]);
    await vi.waitFor(() => expect(items()[0].status).toBe("failed"));
    await pipeline.remove(id);
    expect(deps.deleteReceipt).toHaveBeenCalledWith("r1");
    expect(items()).toHaveLength(0);
  });

  it("un errore di preparazione non blocca gli altri file", async () => {
    const deps = createDeps({
      prepareFile: vi.fn(async (f: File) => {
        if (f.name === "rotto.heic")
          throw Object.assign(new Error("x"), { code: "PREPARE_FAILED" });
        return { file: f, mimeType: "image/jpeg" as const };
      }),
    });
    start(deps);
    store.getState().add([
      { file: file("rotto.heic"), source: "file" },
      { file: file("ok.jpg"), source: "file" },
    ]);
    await vi.waitFor(() => expect(items()[1].status).toBe("done"));
    expect(items()[0]).toMatchObject({ status: "failed", errorCode: "PREPARE_FAILED" });
  });

  it("stopAll interrompe upload e polling in corso", async () => {
    const deps = createDeps({ getReceipt: vi.fn(async (id: string) => detail(id, "processing")) });
    const pipeline = start(deps);
    store.getState().add([{ file: file("a.jpg"), source: "file" }]);
    await vi.waitFor(() => expect(items()[0].status).toBe("processing"));
    await vi.waitFor(() => expect(deps.getReceipt).toHaveBeenCalled());
    pipeline.stopAll();
    const calls = vi.mocked(deps.getReceipt).mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(vi.mocked(deps.getReceipt).mock.calls.length).toBe(calls);
  });
});
