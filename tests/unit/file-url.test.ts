import { describe, expect, it } from "vitest";
import { checkFileUrl } from "@/features/receipts/lib/file-url";

const real = { supabaseUrl: "https://proj.supabase.co", mock: false };
const mock = { supabaseUrl: "", mock: true, appOrigin: "http://localhost:3100" };
const signed = "https://proj.supabase.co/storage/v1/object/sign/receipts/u/r.jpg?token=abc";

describe("checkFileUrl", () => {
  it("accetta solo gli URL firmati del bucket receipts del nostro Supabase", () => {
    expect(checkFileUrl(signed, real)).toBe(signed);
    expect(checkFileUrl("https://proj.supabase.co/storage/v1/object/public/receipts/a", real)).toBe(
      undefined,
    );
    expect(checkFileUrl("https://altro.supabase.co/storage/v1/object/sign/receipts/a", real)).toBe(
      undefined,
    );
    expect(checkFileUrl("javascript:alert(1)", real)).toBeUndefined();
    expect(checkFileUrl("blob:http://localhost:3100/x", real)).toBeUndefined();
    expect(checkFileUrl(null, real)).toBeUndefined();
  });

  it("in modalità mock accetta i blob e i file di esempio dell'app", () => {
    expect(checkFileUrl("blob:http://localhost:3100/x", mock)).toBe("blob:http://localhost:3100/x");
    expect(checkFileUrl("http://localhost:3100/mock/scontrino-esempio.svg", mock)).toBeDefined();
    expect(checkFileUrl("http://evil.test/a.svg", mock)).toBeUndefined();
  });
});
