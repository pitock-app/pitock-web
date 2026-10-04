import type imageCompression from "browser-image-compression";
import type heic2any from "heic2any";
import { acceptedType, isHeic, isPdf, MAX_UPLOAD_BYTES, type MimeType } from "./file-types";

export const MAX_IMAGE_SIDE = 2000;
export const JPEG_QUALITY = 0.85;

export type PreparedFile = {
  file: File;
  mimeType: MimeType;
};

export type PrepareErrorCode = "PREPARE_FAILED" | "FILE_TOO_LARGE" | "FILE_TYPE_NOT_ACCEPTED";

export class PrepareFileError extends Error {
  readonly code: PrepareErrorCode;

  constructor(code: PrepareErrorCode, options?: { cause?: unknown }) {
    super(code, options);
    this.name = "PrepareFileError";
    this.code = code;
  }
}

type PrepareDeps = {
  heic2any: typeof heic2any;
  imageCompression: typeof imageCompression;
};

// Caricate solo nel browser e solo quando servono: entrambe le librerie usano il DOM.
async function loadDeps(): Promise<PrepareDeps> {
  const [heic, compression] = await Promise.all([
    import("heic2any"),
    import("browser-image-compression"),
  ]);
  return { heic2any: heic.default, imageCompression: compression.default };
}

function withExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "scontrino";
  return `${base}.${ext}`;
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Prepara un file per l'upload: HEIC/HEIF → JPEG; immagini ridimensionate a 2000 px
 * sul lato lungo e ricompresse in JPEG qualità 0,85; PDF invariati. Massimo 10 MB.
 */
export async function prepareFile(
  input: File,
  deps?: PrepareDeps,
  signal?: AbortSignal,
): Promise<PreparedFile> {
  if (isPdf(input)) {
    if (input.size > MAX_UPLOAD_BYTES) throw new PrepareFileError("FILE_TOO_LARGE");
    return {
      file: input.type ? input : new File([input], input.name, { type: "application/pdf" }),
      mimeType: "application/pdf",
    };
  }

  const heic = isHeic(input);
  // I file senza MIME (alcuni browser e sistemi) si riconoscono dall'estensione.
  const type = acceptedType(input);
  if (!heic && !(type && IMAGE_TYPES.has(type))) {
    throw new PrepareFileError("FILE_TYPE_NOT_ACCEPTED");
  }

  const { heic2any, imageCompression } = deps ?? (await loadDeps());
  let source: File =
    heic || input.type ? input : new File([input], input.name, { type: type ?? undefined });
  try {
    if (heic) {
      const converted = await heic2any({
        blob: input,
        toType: "image/jpeg",
        quality: JPEG_QUALITY,
      });
      const blob = Array.isArray(converted) ? converted[0] : converted;
      source = new File([blob], withExtension(input.name, "jpg"), { type: "image/jpeg" });
    }
    const compressed = await imageCompression(source, {
      maxWidthOrHeight: MAX_IMAGE_SIDE,
      fileType: "image/jpeg",
      initialQuality: JPEG_QUALITY,
      // Il web worker scaricherebbe la libreria da una CDN: si lavora nel thread principale.
      useWebWorker: false,
      signal,
    });
    const file = new File([compressed], withExtension(input.name, "jpg"), {
      type: "image/jpeg",
      lastModified: input.lastModified,
    });
    if (file.size > MAX_UPLOAD_BYTES) throw new PrepareFileError("FILE_TOO_LARGE");
    return { file, mimeType: "image/jpeg" };
  } catch (error) {
    if (error instanceof PrepareFileError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new PrepareFileError("PREPARE_FAILED", { cause: error });
  }
}
