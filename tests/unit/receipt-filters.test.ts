import { describe, expect, it } from "vitest";
import {
  hasActiveFilters,
  isRangeInvalid,
  parseReceiptFilters,
  serializeReceiptFilters,
  toListQuery,
} from "@/features/receipts/lib/receipt-filters";

const now = new Date("2026-10-04T08:00:00Z");
const parse = (query: string) => parseReceiptFilters(new URLSearchParams(query));

describe("filtri della lista scontrini", () => {
  it("legge i filtri validi dall'URL e ignora quelli sconosciuti", () => {
    expect(
      parse("period=last-month&category=salute&status=failed&source=camera&q=%20farmacia%20"),
    ).toEqual({
      period: "last-month",
      category: "salute",
      status: "failed",
      source: "camera",
      q: "farmacia",
    });
    expect(parse("period=boh&category=xyz&status=ok&source=fax&q=")).toEqual({ period: "all" });
  });

  it("con le sole date il periodo è personalizzato", () => {
    expect(parse("from=2026-01-01&to=2026-01-31")).toEqual({
      period: "custom",
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(parse("period=this-month&from=2026-01-01")).toEqual({ period: "this-month" });
  });

  it("serializza senza i valori predefiniti e rilegge gli stessi filtri", () => {
    const filters = parse("period=custom&from=2026-01-01&category=casa&q=leroy");
    const query = serializeReceiptFilters(filters).toString();
    expect(query).toBe("period=custom&from=2026-01-01&category=casa&q=leroy");
    expect(parse(query)).toEqual(filters);
    expect(serializeReceiptFilters({ period: "all" }).toString()).toBe("");
    expect(hasActiveFilters({ period: "all" })).toBe(false);
    expect(hasActiveFilters({ period: "all", source: "file" })).toBe(true);
  });

  it("converte i filtri nei parametri di GET /v1/receipts", () => {
    expect(toListQuery(parse("period=this-month&status=extracted&q=bar"), now)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
      status: "extracted",
      q: "bar",
    });
    expect(toListQuery({ period: "all" }, now)).toEqual({});
  });

  it("ignora un intervallo con la data finale prima di quella iniziale", () => {
    const filters = parse("from=2026-05-01&to=2026-04-01");
    expect(isRangeInvalid(filters)).toBe(true);
    expect(toListQuery(filters, now)).toEqual({});
  });
});
