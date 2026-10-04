import { describe, expect, it } from "vitest";
import { daysOfPeriod, toUsageQuery, usagePeriodStart } from "@/features/settings";

// 4 ottobre 2026, 00:30 a Roma (ancora 3 ottobre in UTC).
const NOW = new Date("2026-10-03T22:30:00Z");

describe("periodi del consumo token", () => {
  it("calcola il primo giorno nel fuso di Roma", () => {
    expect(usagePeriodStart("this-month", NOW)).toBe("2026-10-01");
    expect(usagePeriodStart("30-days", NOW)).toBe("2026-09-05");
    expect(usagePeriodStart("90-days", NOW)).toBe("2026-07-07");
    expect(usagePeriodStart("all", NOW)).toBe("2000-01-01");
  });

  it("chiede la serie per giorno da quel giorno", () => {
    expect(toUsageQuery("this-month", NOW)).toEqual({ from: "2026-10-01", groupBy: "day" });
  });

  it("elenca i giorni del periodo, oggi compreso; non per Tutto", () => {
    expect(daysOfPeriod("this-month", NOW)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(daysOfPeriod("30-days", NOW)).toHaveLength(30);
    expect(daysOfPeriod("all", NOW)).toBeNull();
  });
});
