import { describe, expect, it } from "vitest";
import { validateFiles } from "@/features/capture/lib/validate-files";

const file = (name: string, type: string, size = 100) =>
  new File([new Uint8Array(size)], name, { type });

describe("validateFiles", () => {
  it("accetta immagini, HEIC e PDF e scarta il resto con un motivo", () => {
    const { accepted, rejected } = validateFiles([
      file("a.jpg", "image/jpeg"),
      file("b.heic", ""),
      file("c.pdf", "application/pdf"),
      file("d.txt", "text/plain"),
      file("e.gif", "image/gif"),
      file("vuoto.png", "image/png", 0),
    ]);
    expect(accepted.map((f) => f.name)).toEqual(["a.jpg", "b.heic", "c.pdf"]);
    expect(rejected).toEqual([
      { name: "d.txt", reason: "tipo di file non ammesso" },
      { name: "e.gif", reason: "tipo di file non ammesso" },
      { name: "vuoto.png", reason: "file vuoto" },
    ]);
  });

  it("scarta i file troppo grandi", () => {
    const { rejected } = validateFiles([
      file("big.pdf", "application/pdf", 10 * 1024 * 1024 + 1),
      file("big.jpg", "image/jpeg", 25 * 1024 * 1024 + 1),
    ]);
    expect(rejected.map((r) => r.reason)).toEqual([
      "file troppo grande (massimo 10 MB)",
      "file troppo grande (massimo 25 MB)",
    ]);
  });

  it("accetta al massimo 20 file per volta", () => {
    const files = Array.from({ length: 22 }, (_, i) => file(`${i}.jpg`, "image/jpeg"));
    const { accepted, rejected } = validateFiles(files);
    expect(accepted).toHaveLength(20);
    expect(rejected).toHaveLength(2);
    expect(rejected[0].reason).toBe("massimo 20 file per volta");
  });
});
