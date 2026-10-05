import { describe, expect, it, vi } from "vitest";
import {
  JPEG_QUALITY,
  MAX_IMAGE_SIDE,
  PrepareFileError,
  prepareFile,
  targetLongSide,
} from "@/features/capture/lib/prepare-file";
import { MAX_UPLOAD_BYTES } from "@/features/capture/lib/file-types";

function file(name: string, type: string, size = 1000) {
  return new File([new Uint8Array(size)], name, { type });
}

function deps(output: Blob = new Blob([new Uint8Array(500)], { type: "image/jpeg" })) {
  return {
    heic2any: vi.fn(async () => new Blob([new Uint8Array(800)], { type: "image/jpeg" })),
    imageCompression: Object.assign(
      vi.fn(async () => new File([output], "out.jpg", { type: "image/jpeg" })),
      {},
    ),
  } as unknown as Parameters<typeof prepareFile>[1] & {
    heic2any: ReturnType<typeof vi.fn>;
    imageCompression: ReturnType<typeof vi.fn>;
  };
}

describe("prepareFile", () => {
  it("converte HEIC in JPEG e poi ridimensiona", async () => {
    const d = deps();
    const result = await prepareFile(file("IMG_0001.HEIC", "image/heic"), d);

    expect(d!.heic2any).toHaveBeenCalledWith(
      expect.objectContaining({ toType: "image/jpeg", quality: JPEG_QUALITY }),
    );
    const [converted, options] = d!.imageCompression.mock.calls[0];
    expect((converted as File).type).toBe("image/jpeg");
    expect((converted as File).name).toBe("IMG_0001.jpg");
    expect(options).toMatchObject({
      maxWidthOrHeight: MAX_IMAGE_SIDE,
      fileType: "image/jpeg",
      initialQuality: JPEG_QUALITY,
      useWebWorker: false,
    });
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.file.name).toBe("IMG_0001.jpg");
    expect(result.file.type).toBe("image/jpeg");
  });

  it("riduce le foto per area ma tiene leggibili gli scontrini lunghi", () => {
    // Foto 4:3 da 12 MP: circa 3,5 MP, come prima (lato lungo ~2160).
    expect(targetLongSide(4000, 3000)).toBe(2160);
    // Scontrino 1:10 da 1500×15000: il lato corto resta 1200 px, non ~590.
    expect(targetLongSide(1500, 15000)).toBe(12000);
    // Già piccolo o stretto: non si ingrandisce.
    expect(targetLongSide(800, 1200)).toBe(1200);
    expect(targetLongSide(1080, 9000)).toBe(9000);
    // Limiti del canvas: al massimo 16.000 px di lato e 16 milioni di pixel.
    expect(targetLongSide(1200, 30000)).toBe(16000);
    const long = targetLongSide(3000, 40000);
    expect(long).toBe(14605);
    expect(long * ((long * 3000) / 40000)).toBeLessThanOrEqual(16_000_000);
  });

  it("passa al ridimensionamento il lato lungo calcolato dalle dimensioni", async () => {
    const d = deps();
    const readSize = vi.fn(async () => ({ width: 1500, height: 15000 }));
    await prepareFile(file("lungo.jpg", "image/jpeg"), { ...d, readSize });
    expect(d.imageCompression).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ maxWidthOrHeight: 12000 }),
    );
  });

  it("riconosce un HEIC senza MIME dall'estensione", async () => {
    const d = deps();
    await prepareFile(file("foto.heif", ""), d);
    expect(d!.heic2any).toHaveBeenCalled();
  });

  it("senza dimensioni leggibili ridimensiona PNG e WebP in JPEG a 2000 px sul lato lungo", async () => {
    const d = deps();
    const result = await prepareFile(file("scontrino.png", "image/png"), d);
    expect(d!.heic2any).not.toHaveBeenCalled();
    expect(d!.imageCompression).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ maxWidthOrHeight: 2000, fileType: "image/jpeg" }),
    );
    expect(result).toMatchObject({ mimeType: "image/jpeg" });
    expect(result.file.name).toBe("scontrino.jpg");
  });

  it("lascia invariati i PDF", async () => {
    const d = deps();
    const pdf = file("fattura.pdf", "application/pdf");
    const result = await prepareFile(pdf, d);
    expect(result.file).toBe(pdf);
    expect(result.mimeType).toBe("application/pdf");
    expect(d!.imageCompression).not.toHaveBeenCalled();
  });

  it("rifiuta i file oltre 10 MB dopo la preparazione", async () => {
    await expect(
      prepareFile(file("grande.pdf", "application/pdf", MAX_UPLOAD_BYTES + 1), deps()),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    const big = new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)]);
    await expect(prepareFile(file("enorme.jpg", "image/jpeg"), deps(big))).rejects.toMatchObject({
      code: "FILE_TOO_LARGE",
    });
  });

  it("segnala PREPARE_FAILED se la conversione non riesce", async () => {
    const d = deps();
    d!.heic2any.mockRejectedValueOnce(new Error("formato non supportato"));
    const error = await prepareFile(file("rotto.heic", "image/heic"), d).catch((e) => e);
    expect(error).toBeInstanceOf(PrepareFileError);
    expect(error.code).toBe("PREPARE_FAILED");
  });

  it("rifiuta i tipi non ammessi", async () => {
    await expect(prepareFile(file("nota.txt", "text/plain"), deps())).rejects.toMatchObject({
      code: "FILE_TYPE_NOT_ACCEPTED",
    });
  });

  it("riconosce dall'estensione le immagini senza MIME", async () => {
    const d = deps();
    const prepared = await prepareFile(file("foto.png", ""), d);
    expect(prepared.mimeType).toBe("image/jpeg");
    expect(d!.imageCompression.mock.calls[0][0].type).toBe("image/png");
  });
});

describe("unione dei pezzi di uno scontrino", () => {
  it("porta tutti i pezzi alla larghezza del più stretto e li impila con una fascia in mezzo", async () => {
    const { stitchLayout, STITCH_GAP } = await import("@/features/capture/lib/image-tools");
    const layout = stitchLayout([
      { width: 1600, height: 2000 },
      { width: 1200, height: 1600 },
    ]);
    expect(layout.width).toBe(1200);
    expect(layout.pieces).toEqual([
      { y: 0, height: 1500 },
      { y: 1500 + STITCH_GAP, height: 1600 },
    ]);
    expect(layout.height).toBe(1500 + STITCH_GAP + 1600);
  });

  it("non supera la larghezza massima né i pixel del canvas", async () => {
    const { stitchLayout, STITCH_MAX_WIDTH } = await import("@/features/capture/lib/image-tools");
    expect(stitchLayout([{ width: 4000, height: 3000 }]).width).toBe(STITCH_MAX_WIDTH);
    const long = stitchLayout(Array.from({ length: 8 }, () => ({ width: 3000, height: 4000 })));
    expect(long.width * long.height).toBeLessThanOrEqual(16_000_000);
  });
});
