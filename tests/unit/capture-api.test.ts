import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureDeps } from "@/features/capture/lib/capture-api";
import { createUploadPipeline } from "@/features/capture/lib/upload-pipeline";
import { useUploadQueue } from "@/features/capture/store/upload-queue.store";
import { createMockAuthProvider } from "@/lib/auth/mock-auth";
import { createMockStorageUploader } from "@/lib/storage/mock-storage";
import { mockTiming } from "@/mocks";
import { setupMswServer } from "../helpers/msw-server";

const provider = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getAuthProvider: () => provider.current,
}));

setupMswServer();

const store = useUploadQueue;
const items = () => store.getState().items;

beforeEach(async () => {
  store.getState().reset();
  const auth = createMockAuthProvider();
  provider.current = auth;
  await auth.signIn("anna@pitock.test", "x");
  mockTiming.startMs = 0;
  mockTiming.doneMs = 0;
});

function startPipeline() {
  const pipeline = createUploadPipeline({
    store,
    deps: {
      ...captureDeps,
      // jsdom non ha canvas: i PDF non vengono trasformati.
      prepareFile: async (file) => ({ file, mimeType: "application/pdf" }),
      upload: (upload) =>
        createMockStorageUploader({ durationMs: 5, steps: 2 }).uploadToSignedUrl(upload),
    },
    pollIntervalMs: 5,
  });
  return pipeline.start();
}

const pdf = (name: string, content: string) =>
  new File([content], name, { type: "application/pdf" });

describe("pipeline contro gli handler MSW", () => {
  it("carica, elabora e riconosce lo stesso file come duplicato", async () => {
    const stop = startPipeline();
    store.getState().add([{ file: pdf("a.pdf", "uno"), source: "file" }]);
    await vi.waitFor(() => expect(items()[0].status).toBe("done"));
    expect(items()[0].result?.merchantName).toEqual(expect.any(String));
    expect(items()[0].result?.total).toEqual(expect.any(Number));

    store.getState().add([{ file: pdf("a-copia.pdf", "uno"), source: "file" }]);
    await vi.waitFor(() => expect(items()[1].status).toBe("duplicate"));
    expect(items()[1].duplicateOf).toBe(items()[0].receiptId);
    stop();
  });

  it("un file che non è uno scontrino fallisce con NOT_A_RECEIPT", async () => {
    const stop = startPipeline();
    store.getState().add([{ file: pdf("non-scontrino.pdf", "due"), source: "file" }]);
    await vi.waitFor(() => expect(items()[0].status).toBe("failed"));
    expect(items()[0].errorCode).toBe("NOT_A_RECEIPT");
    stop();
  });
});
