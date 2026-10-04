import { describe, expect, it } from "vitest";
import type { QueueItem, QueueResult } from "@/features/capture/store/upload-queue.store";
import { queueOutcome, reviewIssues, sortQueue } from "@/features/capture/lib/queue-review";

const good: QueueResult = {
  merchantName: "Esselunga",
  purchasedAt: "2026-10-04T10:00:00Z",
  total: 12.5,
  currency: "EUR",
  category: "alimentari",
  confidence: 0.9,
};

function queueItem(id: string, patch: Partial<QueueItem>): QueueItem {
  return {
    id,
    file: new File(["x"], `${id}.jpg`, { type: "image/jpeg" }),
    name: `${id}.jpg`,
    source: "camera",
    status: "processing",
    progress: null,
    ...patch,
  };
}

describe("reviewIssues", () => {
  it("nessun problema per un'estrazione completa e affidabile", () => {
    expect(reviewIssues(good)).toEqual([]);
    expect(reviewIssues({ ...good, confidence: null })).toEqual([]);
  });

  it("segnala confidenza bassa e campi non letti", () => {
    expect(
      reviewIssues({
        ...good,
        confidence: 0.4,
        merchantName: null,
        total: null,
        purchasedAt: null,
      }),
    ).toEqual(["lowConfidence", "merchantName", "total", "purchasedAt"]);
  });
});

describe("queueOutcome e sortQueue", () => {
  const ok = queueItem("ok", { status: "done", result: good });
  const dup = queueItem("dup", { status: "duplicate", duplicateOf: "x" });
  const attention = queueItem("attention", { status: "done", result: { ...good, total: null } });
  const failed = queueItem("failed", { status: "failed", errorCode: "NOT_A_RECEIPT" });
  const active = queueItem("active", { status: "uploading", progress: 10 });

  it("classifica gli elementi", () => {
    expect([ok, dup, attention, failed, active].map(queueOutcome)).toEqual([
      "ok",
      "ok",
      "attention",
      "failed",
      "active",
    ]);
  });

  it("mette prima i falliti, poi quelli da controllare, poi in corso, in fondo i riusciti", () => {
    expect(sortQueue([ok, attention, dup, active, failed]).map((item) => item.id)).toEqual([
      "failed",
      "attention",
      "active",
      "ok",
      "dup",
    ]);
  });
});
