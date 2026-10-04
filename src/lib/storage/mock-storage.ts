import { rememberMockFile } from "./mock-files";
import { StorageError, type StorageUploader } from "./types";

type MockStorageOptions = {
  /** Durata totale dell'upload finto in millisecondi. */
  durationMs?: number;
  steps?: number;
};

const abortError = () => new DOMException("Upload annullato", "AbortError");

/** Upload finto per la modalità mock: nessuna rete, solo un ritardo con avanzamento. */
export function createMockStorageUploader(options: MockStorageOptions = {}): StorageUploader {
  const { durationMs = 1200, steps = 6 } = options;
  return {
    async uploadToSignedUrl({ path, token, file, onProgress, signal }) {
      if (!path || !token) throw new StorageError("UPLOAD_FAILED", "Missing path or token");
      for (let step = 0; step <= steps; step += 1) {
        if (signal?.aborted) throw abortError();
        onProgress?.(Math.round((step / steps) * 100));
        if (step < steps) await new Promise((resolve) => setTimeout(resolve, durationMs / steps));
      }
      rememberMockFile(path, file);
    },
  };
}
