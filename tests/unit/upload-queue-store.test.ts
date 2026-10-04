import { beforeEach, describe, expect, it } from "vitest";
import {
  canTransition,
  hasActiveUploads,
  useUploadQueue,
} from "@/features/capture/store/upload-queue.store";

const store = useUploadQueue;
const file = (name = "scontrino.jpg") => new File(["x"], name, { type: "image/jpeg" });
const item = (id: string) => store.getState().items.find((entry) => entry.id === id)!;

beforeEach(() => store.getState().reset());

describe("store della coda di upload", () => {
  it("aggiunge gli elementi in stato queued", () => {
    const ids = store.getState().add([
      { file: file("a.jpg"), source: "file" },
      { file: file("b.jpg"), source: "camera", capturedAt: "2026-10-04T10:00:00Z" },
    ]);
    expect(ids).toHaveLength(2);
    expect(store.getState().items.map((entry) => [entry.name, entry.source, entry.status])).toEqual(
      [
        ["a.jpg", "file", "queued"],
        ["b.jpg", "camera", "queued"],
      ],
    );
    expect(item(ids[1]).capturedAt).toBe("2026-10-04T10:00:00Z");
  });

  it("attraversa tutti gli stati fino a done", () => {
    const [id] = store.getState().add([{ file: file(), source: "file" }]);
    const { transition, setProgress } = store.getState();

    expect(transition(id, "preparing")).toBe(true);
    expect(transition(id, "hashing")).toBe(true);
    expect(transition(id, "requesting")).toBe(true);
    expect(transition(id, "uploading", { receiptId: "r1", progress: 0 })).toBe(true);
    setProgress(id, 40);
    expect(item(id).progress).toBe(40);
    setProgress(id, 140);
    expect(item(id).progress).toBe(100);
    expect(transition(id, "completing")).toBe(true);
    expect(item(id).progress).toBeNull();
    expect(transition(id, "processing")).toBe(true);
    expect(hasActiveUploads(store.getState().items)).toBe(true);
    expect(
      transition(id, "done", {
        result: {
          merchantName: "Bar",
          purchasedAt: null,
          total: 3.2,
          currency: "EUR",
          category: "ristorazione",
          confidence: 0.9,
        },
      }),
    ).toBe(true);
    expect(item(id)).toMatchObject({ status: "done", receiptId: "r1" });
    expect(item(id).result?.merchantName).toBe("Bar");
    expect(hasActiveUploads(store.getState().items)).toBe(false);
  });

  it("gestisce errore, riprova e duplicato", () => {
    const [a, b] = store.getState().add([
      { file: file("a.jpg"), source: "file" },
      { file: file("b.jpg"), source: "file" },
    ]);
    const { transition } = store.getState();
    transition(a, "preparing");
    transition(a, "failed", { errorCode: "PREPARE_FAILED", failedStep: "upload" });
    expect(item(a)).toMatchObject({ status: "failed", errorCode: "PREPARE_FAILED" });
    expect(transition(a, "queued")).toBe(true);
    expect(item(a).errorCode).toBeUndefined();

    transition(b, "preparing");
    transition(b, "hashing");
    transition(b, "requesting");
    expect(transition(b, "duplicate", { duplicateOf: "r-old" })).toBe(true);
    expect(item(b)).toMatchObject({ status: "duplicate", duplicateOf: "r-old" });
  });

  it("ignora le transizioni non ammesse e gli elementi rimossi", () => {
    const [id] = store.getState().add([{ file: file(), source: "file" }]);
    const { transition, remove } = store.getState();
    expect(transition(id, "done")).toBe(false);
    expect(item(id).status).toBe("queued");
    remove(id);
    expect(transition(id, "preparing")).toBe(false);
    expect(canTransition("done", "queued")).toBe(false);
    expect(canTransition("failed", "processing")).toBe(true);
  });

  it("rimuove solo i completati", () => {
    const [a, b] = store.getState().add([
      { file: file("a.jpg"), source: "file" },
      { file: file("b.jpg"), source: "file" },
    ]);
    const { transition } = store.getState();
    for (const status of ["preparing", "hashing", "requesting"] as const) transition(a, status);
    transition(a, "duplicate", { duplicateOf: "x" });
    store.getState().clearFinished();
    expect(store.getState().items.map((entry) => entry.id)).toEqual([b]);
  });

  it("non rimuove i completati da controllare", () => {
    const [a] = store.getState().add([{ file: file("a.jpg"), source: "camera" }]);
    const { transition } = store.getState();
    for (const status of [
      "preparing",
      "hashing",
      "requesting",
      "uploading",
      "completing",
      "processing",
    ] as const)
      transition(a, status);
    transition(a, "done", {
      result: {
        merchantName: "Bar",
        purchasedAt: "2026-10-04T10:00:00Z",
        total: 3.2,
        currency: "EUR",
        category: null,
        confidence: 0.3,
      },
    });
    store.getState().clearFinished();
    expect(store.getState().items.map((entry) => entry.id)).toEqual([a]);
  });
});
