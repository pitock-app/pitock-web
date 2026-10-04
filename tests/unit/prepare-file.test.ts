import { describe, expect, it, vi } from "vitest";
import {
  JPEG_QUALITY,
  MAX_IMAGE_SIDE,
  PrepareFileError,
  prepareFile,
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

  it("riconosce un HEIC senza MIME dall'estensione", async () => {
    const d = deps();
    await prepareFile(file("foto.heif", ""), d);
    expect(d!.heic2any).toHaveBeenCalled();
  });

  it("ridimensiona PNG e WebP in JPEG a 2000 px sul lato lungo", async () => {
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
