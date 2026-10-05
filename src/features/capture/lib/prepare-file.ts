import type imageCompression from "browser-image-compression";
import type heic2any from "heic2any";
import { acceptedType, isHeic, isPdf, MAX_UPLOAD_BYTES, type MimeType } from "./file-types";

/** Lato lungo quando le dimensioni dell'immagine non si riescono a leggere. */
export const MAX_IMAGE_SIDE = 2000;
export const JPEG_QUALITY = 0.85;
/** Pixel di una foto normale dopo il ridimensionamento (una 4:3 diventa circa 2160×1620). */
export const MAX_PIXELS = 3_500_000;
/**
 * Lato corto minimo: uno scontrino lungo (1:8, 1:10) ridotto per area diventerebbe largo poche
 * centinaia di pixel e illeggibile. Il backend lo taglia poi a fasce per il modello.
 */
export const MIN_SHORT_SIDE = 1200;
/** Limiti del canvas dei browser (iOS: circa 16,7 milioni di pixel). */
const CANVAS_MAX_SIDE = 16_000;
const CANVAS_MAX_PIXELS = 16_000_000;

/**
 * Lato lungo da passare al ridimensionamento: si riduce per area, ma senza scendere sotto
 * `MIN_SHORT_SIDE` sul lato corto e senza mai ingrandire.
 */
export function targetLongSide(width: number, height: number): number {
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  let scale = Math.min(
    1,
    Math.max(Math.sqrt(MAX_PIXELS / (width * height)), MIN_SHORT_SIDE / short),
  );
  scale = Math.min(scale, CANVAS_MAX_SIDE / long, Math.sqrt(CANVAS_MAX_PIXELS / (width * height)));
  // Per difetto: arrotondare per eccesso potrebbe superare i limiti del canvas.
  return Math.floor(long * scale);
}

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

type ImageSize = { width: number; height: number };

type PrepareDeps = {
  heic2any: typeof heic2any;
  imageCompression: typeof imageCompression;
  /** Dimensioni dell'immagine; null se il browser non le sa leggere. */
  readSize?: (file: Blob) => Promise<ImageSize | null>;
};

async function readImageSize(file: Blob): Promise<ImageSize | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

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
 * Prepara un file per l'upload: HEIC/HEIF → JPEG; immagini ridimensionate per area (vedi
 * `targetLongSide`) e ricompresse in JPEG qualità 0,85; PDF invariati. Massimo 10 MB.
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

  const { heic2any, imageCompression, readSize = readImageSize } = deps ?? (await loadDeps());
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
    const size = await readSize(source);
    const compressed = await imageCompression(source, {
      maxWidthOrHeight: size ? targetLongSide(size.width, size.height) : MAX_IMAGE_SIDE,
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
