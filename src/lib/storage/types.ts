export type SignedUpload = {
  path: string;
  token: string;
  file: Blob;
  contentType: string;
  /** Avanzamento da 0 a 100, se l'implementazione lo conosce. */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
};

export type StorageErrorCode = "UPLOAD_FAILED" | "STORAGE_NOT_CONFIGURED";

export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message?: string) {
    super(message ?? code);
    this.name = "StorageError";
    this.code = code;
  }
}

/**
 * Caricamento dei file con gli URL firmati del backend. Due implementazioni:
 * Supabase Storage (reale) e Mock (ritardo e avanzamento finti).
 */
export interface StorageUploader {
  uploadToSignedUrl(upload: SignedUpload): Promise<void>;
}
