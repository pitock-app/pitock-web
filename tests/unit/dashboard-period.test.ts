import { describe, expect, it } from "vitest";
import {
  granularityOf,
  parseDashboardFilters,
  periodKeys,
  serializeDashboardFilters,
} from "@/features/dashboard/lib/dashboard-period";
import {
  currentRange,
  filtersFromSlider,
  sliderMonths,
  sliderValue,
} from "@/features/dashboard/lib/dashboard-period";
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

  it("legge e scrive negozio e categoria, scartando le categorie non valide", () => {
    const parsed = parseDashboardFilters(
      new URLSearchParams("period=last-month&store=Lidl&category=alimentari"),
    );
    expect(parsed).toEqual({ period: "last-month", store: "Lidl", category: "alimentari" });
    expect(serializeDashboardFilters(parsed).toString()).toBe(
      "period=last-month&store=Lidl&category=alimentari",
    );
    expect(parseDashboardFilters(new URLSearchParams("category=gioielli&store=%20"))).toEqual({
      period: "this-month",
    });
  });

  it("sceglie mesi o anni e riempie le barre vuote", () => {
    const range = currentRange({ period: "last-12-months" }, now);
    expect(range).toEqual({ from: "2025-11-01", to: "2026-10-31" });
    expect(granularityOf(range)).toBe("month");
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

  it("formatta la variazione", () => {
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

describe("slider dei mesi", () => {
  it("copre l'ultimo anno fino al mese in corso", () => {
    const months = sliderMonths(now);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2025-11");
    expect(months[11]).toBe("2026-10");
  });

  it("posiziona i cursori sui preset e sui mesi interi", () => {
    expect(sliderValue({ period: "this-month" }, now)).toEqual([11, 11]);
    expect(sliderValue({ period: "last-month" }, now)).toEqual([10, 10]);
    expect(sliderValue({ period: "last-12-months" }, now)).toEqual([0, 11]);
    expect(sliderValue({ period: "custom", from: "2026-03-01", to: "2026-05-31" }, now)).toEqual([
      4, 6,
    ]);
  });

  it("non posiziona i cursori su date a metà mese o fuori dall'anno", () => {
    expect(sliderValue({ period: "custom", from: "2026-03-05", to: "2026-05-31" }, now)).toBeNull();
    expect(sliderValue({ period: "custom", from: "2024-01-01", to: "2026-05-31" }, now)).toBeNull();
    expect(sliderValue({ period: "custom", from: "2026-03-01" }, now)).toBeNull();
    expect(sliderValue({ period: "this-year" }, now)).toBeNull();
  });

  it("traduce i cursori in preset o in un intervallo di mesi interi", () => {
    expect(filtersFromSlider([11, 11], now)).toEqual({ period: "this-month" });
    expect(filtersFromSlider([10, 10], now)).toEqual({ period: "last-month" });
    expect(filtersFromSlider([0, 11], now)).toEqual({ period: "last-12-months" });
    expect(filtersFromSlider([4, 6], now)).toEqual({
      period: "custom",
      from: "2026-03-01",
      to: "2026-05-31",
    });
  });
});
