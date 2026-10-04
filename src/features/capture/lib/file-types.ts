import type { components } from "@/lib/api/schema";

export type MimeType = components["schemas"]["MimeType"];

/** Dimensione massima del file dopo la preparazione (come il backend). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Dimensione massima di un'immagine scelta dall'utente, prima del ridimensionamento. */
export const MAX_IMAGE_INPUT_BYTES = 25 * 1024 * 1024;
export const MAX_FILES_PER_DROP = 20;

/** Tipi accettati nella dropzone, con le estensioni (i file HEIC spesso non hanno MIME). */
export const ACCEPTED_FILE_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
  "application/pdf": [".pdf"],
} as const;

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

export function isHeic(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    [".heic", ".heif"].includes(extension(file.name))
  );
}

export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || (!file.type && extension(file.name) === ".pdf");
}

/** Tipo del file tra quelli ammessi, o null. Per i file senza MIME si guarda l'estensione. */
export function acceptedType(file: File): keyof typeof ACCEPTED_FILE_TYPES | null {
  const ext = extension(file.name);
  for (const [mime, extensions] of Object.entries(ACCEPTED_FILE_TYPES)) {
    if (file.type === mime) return mime as keyof typeof ACCEPTED_FILE_TYPES;
    if (!file.type && (extensions as readonly string[]).includes(ext)) {
      return mime as keyof typeof ACCEPTED_FILE_TYPES;
    }
  }
  return null;
}

/** Limite di dimensione prima della preparazione: i PDF non vengono compressi. */
export function maxInputBytes(file: File): number {
  return isPdf(file) ? MAX_UPLOAD_BYTES : MAX_IMAGE_INPUT_BYTES;
}
