import { describe, expect, it } from "vitest";
import {
  granularityOf,
  parseDashboardFilters,
  percentChange,
  periodKeys,
  previousRange,
  serializeDashboardFilters,
  toStatsQuery,
} from "@/features/dashboard/lib/dashboard-period";
import { currentRange } from "@/features/dashboard/lib/dashboard-period";
import { formatDayRange, formatPercentChange, formatPeriodKey } from "@/lib/format";

// 4 ottobre 2026, mattina a Roma.
const now = new Date("2026-10-04T08:00:00Z");

describe("periodo della dashboard", () => {
  it("legge e scrive il periodo nella query string", () => {
    expect(parseDashboardFilters(new URLSearchParams())).toEqual({ period: "this-month" });
    expect(parseDashboardFilters(new URLSearchParams("period=all"))).toEqual({
      period: "this-month",
    });
    const custom = parseDashboardFilters(
      new URLSearchParams("period=custom&from=2026-01-01&to=2026-02-30"),
    );
    expect(custom).toEqual({ period: "custom", from: "2026-01-01" });
    expect(serializeDashboardFilters(custom).toString()).toBe("period=custom&from=2026-01-01");
    expect(serializeDashboardFilters({ period: "this-month" }).toString()).toBe("");
  });

  it("confronta ogni periodo con quello precedente", () => {
    expect(previousRange({ period: "this-month" }, now)).toEqual({
      from: "2026-09-01",
      to: "2026-09-04",
    });
    expect(previousRange({ period: "last-month" }, now)).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(previousRange({ period: "last-12-months" }, now)).toEqual({
      from: "2024-11-01",
      to: "2025-10-31",
    });
    expect(previousRange({ period: "this-year" }, now)).toEqual({
      from: "2025-01-01",
      to: "2025-10-04",
    });
    expect(previousRange({ period: "custom", from: "2026-03-10", to: "2026-03-19" }, now)).toEqual({
      from: "2026-02-28",
      to: "2026-03-09",
    });
    expect(previousRange({ period: "custom", from: "2026-03-10" }, now)).toBeNull();
    // Fine mese: il 31 marzo si confronta con il 1–28 febbraio.
    expect(previousRange({ period: "this-month" }, new Date("2026-03-31T10:00:00Z"))).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("sceglie mesi o anni e riempie le barre vuote", () => {
    const range = currentRange({ period: "last-12-months" }, now);
    expect(range).toEqual({ from: "2025-11-01", to: "2026-10-31" });
    expect(toStatsQuery(range)).toEqual({ ...range, granularity: "month" });
    const keys = periodKeys(range, "month")!;
    expect(keys).toHaveLength(12);
    expect(keys[0]).toBe("2025-11");
    expect(keys.at(-1)).toBe("2026-10");
    expect(granularityOf({ from: "2020-01-01", to: "2026-10-04" })).toBe("year");
    expect(granularityOf({})).toBe("year");
    expect(periodKeys({ from: "2020-05-01", to: "2022-01-01" }, "year")).toEqual([
      "2020",
      "2021",
      "2022",
    ]);
    expect(periodKeys({ from: "2026-01-01" }, "month")).toBeNull();
  });

  it("calcola e formatta la variazione", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 0)).toBeNull();
    expect(formatPercentChange(12.345)).toBe("+12,3%");
    expect(formatPercentChange(-25)).toBe("-25%");
    expect(formatPercentChange(0)).toBe("0%");
    expect(formatPeriodKey("2026-10")).toBe("ottobre 2026");
    expect(formatPeriodKey("2026-10", "short")).toBe("ott 26");
    expect(formatPeriodKey("2026")).toBe("2026");
    expect(formatDayRange("2026-09-01", "2026-09-04")).toBe("1–4 set 2026");
    expect(formatDayRange("2025-10-01", "2026-09-30")).toBe("1 ott 2025 – 30 set 2026");
    expect(formatDayRange("2025-01-01", "2025-10-04")).toBe("1 gen – 4 ott 2025");
  });
});
