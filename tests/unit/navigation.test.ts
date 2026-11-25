import { describe, expect, it } from "vitest";
import { toggleInList, withParam } from "@/lib/navigation";

describe("withParam", () => {
  it("aggiunge, sostituisce e toglie un parametro lasciando gli altri", () => {
    expect(withParam("period=year", "avoid", "superfluo")).toBe("period=year&avoid=superfluo");
    expect(withParam("period=year&avoid=utile", "avoid", "superfluo")).toBe(
      "period=year&avoid=superfluo",
    );
    expect(withParam("period=year&avoid=utile", "avoid", null)).toBe("period=year");
    expect(withParam("", "avoid", null)).toBe("");
  });
});

describe("toggleInList", () => {
  it("apre e chiude una lista senza toccare le altre", () => {
    expect(toggleInList(null, "top-merchants")).toBe("top-merchants");
    expect(toggleInList("top-merchants", "by-source")).toBe("top-merchants,by-source");
    expect(toggleInList("top-merchants,by-source", "top-merchants")).toBe("by-source");
    expect(toggleInList("by-source", "by-source")).toBeNull();
  });
});
