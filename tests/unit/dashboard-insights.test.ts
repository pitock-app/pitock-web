import { describe, expect, it } from "vitest";
import type { CategoryLine } from "@/features/dashboard/lib/dataset";
import {
  dailyTotals,
  intensity,
  periodHighlights,
  personalInflation,
  spendingCalendar,
  spendingFlow,
  weekdayOf,
  weekdayRhythm,
} from "@/features/dashboard/lib/insights";
import type { ProductStats, ReceiptFact } from "@/features/dashboard/lib/products";

const line = (
  day: string,
  amount: number,
  merchant: string | null,
  category: CategoryLine["category"] = "alimentari",
): CategoryLine => ({
  key: `${day}-${merchant}-${category}-${amount}`,
  receiptId: `${day}-${merchant}`,
  day,
  merchant,
  category,
  label: null,
  kind: "receipt",
  avoidability: null,
  quantity: null,
  amount,
});

const product = (
  key: string,
  totalSpent: number,
  priceChange: number | null,
  purchases = 2,
): ProductStats =>
  ({
    key,
    label: key,
    totalSpent,
    priceChange,
    purchases,
    firstPrice: 1,
  }) as ProductStats;

const labels = { otherStores: "Altri", noStore: "Senza" };

describe("insights della dashboard", () => {
  it("calcola il giorno della settimana da lunedì", () => {
    expect(weekdayOf("2026-10-12")).toBe(0); // lunedì
    expect(weekdayOf("2026-10-18")).toBe(6); // domenica
  });

  it("somma la spesa per giorno", () => {
    const daily = dailyTotals([
      line("2026-10-01", 10.1, "A"),
      line("2026-10-01", 5.2, "B"),
      line("2026-10-03", 3, "A"),
    ]);
    expect(daily.get("2026-10-01")).toBe(15.3);
    expect(daily.size).toBe(2);
  });

  it("costruisce settimane complete da lunedì a domenica", () => {
    const daily = new Map([["2026-10-07", 40]]);
    const { weeks, max } = spendingCalendar(daily, "2026-10-01", "2026-10-31");
    expect(max).toBe(40);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0].day).toBe("2026-09-28");
    expect(weeks[0][0].inRange).toBe(false);
    expect(weeks.at(-1)!.at(-1)!.day).toBe("2026-11-01");
  });

  it("assegna livelli di intensità da 0 a 4", () => {
    expect(intensity(0, 100)).toBe(0);
    expect(intensity(1, 100)).toBe(1);
    expect(intensity(100, 100)).toBe(4);
  });

  it("calcola il ritmo per giorno della settimana", () => {
    const rhythm = weekdayRhythm(
      new Map([
        ["2026-10-12", 10],
        ["2026-10-19", 30],
      ]),
    );
    expect(rhythm[0]).toEqual({ weekday: 0, total: 40, days: 2 });
    expect(rhythm[1].days).toBe(0);
  });

  it("raggruppa i negozi minori nel flusso e somma per categoria", () => {
    const lines = [
      ...["A", "B", "C"].map((store, index) => line("2026-10-01", 30 - index, store)),
      line("2026-10-01", 5, "A", "casa"),
      line("2026-10-02", 1, null),
      line("2026-10-02", -2, "A"),
    ];
    const flow = spendingFlow(lines, labels, 1);
    const names = flow.nodes.map((node) => node.name);
    expect(names).toEqual(["A", "Altri", "alimentari", "casa"]);
    const total = flow.links.reduce((sum, link) => sum + link.value, 0);
    expect(total).toBeCloseTo(30 + 29 + 28 + 5 + 1);
  });

  it("non crea il gruppo degli altri negozi per un solo negozio in più", () => {
    const flow = spendingFlow([line("d", 3, "A"), line("d", 2, "B")], labels, 1);
    expect(flow.nodes.map((node) => node.name)).toEqual(["A", "B", "alimentari"]);
  });

  it("pesa l'inflazione personale sulla spesa", () => {
    const inflation = personalInflation([
      product("latte", 30, 10),
      product("pane", 10, -10),
      product("uova", 100, null),
    ])!;
    expect(inflation.rate).toBeCloseTo(5);
    expect(inflation.tracked).toBe(2);
    expect(inflation.risers.map((p) => p.key)).toEqual(["latte"]);
    expect(inflation.fallers.map((p) => p.key)).toEqual(["pane"]);
    expect(inflation.impact).toBe(2);
    expect(personalInflation([product("uova", 10, null)])).toBeNull();
  });

  it("trova i momenti del periodo", () => {
    const receipts = [
      { id: "r1", date: "2026-10-05T10:00:00Z", merchantName: "Coop" },
      { id: "r2", date: "2026-10-06T10:00:00Z", merchantName: "Coop" },
      { id: "r3", date: "2026-10-07T10:00:00Z", merchantName: "Esselunga" },
    ] as ReceiptFact[];
    const amounts = new Map([
      ["r1", 10],
      ["r2", 20],
      ["r3", 80],
    ]);
    const lines = [
      line("2026-10-05", 10, "Coop"),
      line("2026-10-06", 20, "Coop"),
      line("2026-10-07", 80, "Esselunga"),
    ];
    const highlights = periodHighlights(receipts, amounts, lines, [
      product("latte", 5, null, 3),
      product("pane", 9, null, 1),
    ]);
    expect(highlights.biggest).toMatchObject({ amount: 80, merchant: "Esselunga" });
    expect(highlights.favorite).toEqual({ merchant: "Coop", visits: 2 });
    expect(highlights.topDay).toEqual({ day: "2026-10-07", amount: 80 });
    expect(highlights.topWeekday?.weekday).toBe(2);
    expect(highlights.mostBought).toEqual({ label: "latte", purchases: 3 });
    expect(highlights.activeDays).toBe(3);
  });
});
