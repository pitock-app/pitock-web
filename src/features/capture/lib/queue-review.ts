import { isLowConfidence } from "@/lib/extraction";
import type { QueueItem, QueueResult } from "../store/upload-queue.store";

/** Problema che rende da controllare un'estrazione riuscita. */
export type ReviewIssue = "lowConfidence" | "merchantName" | "total" | "purchasedAt";

/** Problemi dell'estrazione: confidenza bassa o campi principali non letti. */
export function reviewIssues(result: QueueResult | undefined): ReviewIssue[] {
  if (!result) return [];
  const issues: ReviewIssue[] = [];
  if (isLowConfidence(result.confidence)) issues.push("lowConfidence");
  if (!result.merchantName) issues.push("merchantName");
  if (result.total === null) issues.push("total");
  if (!result.purchasedAt) issues.push("purchasedAt");
  return issues;
}

/** Esito di un elemento della coda, per colore e ordinamento. */
export type QueueOutcome = "failed" | "attention" | "active" | "ok";

export function queueOutcome(item: QueueItem): QueueOutcome {
  if (item.status === "failed") return "failed";
  if (item.status === "done") return reviewIssues(item.result).length ? "attention" : "ok";
  if (item.status === "duplicate") return "ok";
  return "active";
}

const ORDER: Record<QueueOutcome, number> = { failed: 0, attention: 1, active: 2, ok: 3 };

/** Prima i falliti, poi quelli da controllare, poi quelli in corso; in fondo i riusciti. */
export function sortQueue(items: readonly QueueItem[]): QueueItem[] {
  return items
    .map((item, index) => ({ item, index, rank: ORDER[queueOutcome(item)] }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item }) => item);
}
