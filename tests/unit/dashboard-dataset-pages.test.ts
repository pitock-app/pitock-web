import { describe, expect, it } from "vitest";
import { collectDatasetPages } from "@/features/dashboard/hooks/useStatsDataset";
import type { components } from "@/lib/api/schema";

type Dataset = components["schemas"]["StatsDataset"];

const page = (ids: string[], nextCursor: string | null): Dataset => ({
  from: "2026-01-01T00:00:00.000Z",
  to: null,
  truncated: nextCursor !== null,
  nextCursor,
  receipts: ids.map((id) => ({
    id,
    date: "2026-09-01T10:00:00.000Z",
    merchantName: null,
    merchantOriginal: null,
    total: 1,
    category: "altro",
    avoidability: null,
    source: "file",
  })),
  items: ids.map((id) => ({
    receiptId: id,
    description: "x",
    quantity: 1,
    unitPrice: 1,
    amount: 1,
    category: "altro",
    normalizedName: null,
    brand: null,
    size: null,
    sizeUnit: null,
    avoidability: null,
  })),
});

describe("dataset a pagine", () => {
  it("segue i cursori fino all'ultima pagina e unisce scontrini e righe", async () => {
    const pages: Record<string, Dataset> = {
      first: page(["a", "b"], "c1"),
      c1: page(["c", "d"], "c2"),
      c2: page(["e"], null),
    };
    const asked: (string | undefined)[] = [];
    const all = await collectDatasetPages((cursor) => {
      asked.push(cursor);
      return Promise.resolve(pages[cursor ?? "first"]!);
    });
    expect(asked).toEqual([undefined, "c1", "c2"]);
    expect(all.receipts.map((r) => r.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(all.items).toHaveLength(5);
    expect(all).toMatchObject({
      truncated: false,
      nextCursor: null,
      from: "2026-01-01T00:00:00.000Z",
    });
  });

  it("oltre il massimo di pagine si ferma e segnala il troncamento", async () => {
    let n = 0;
    const all = await collectDatasetPages(() => Promise.resolve(page([`r${n++}`], `c${n}`)), 3);
    expect(all.receipts).toHaveLength(3);
    expect(all.truncated).toBe(true);
  });
});
