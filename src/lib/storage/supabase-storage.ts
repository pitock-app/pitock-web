import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { StorageError, type StorageUploader } from "./types";

const BUCKET = "receipts";

/** Upload su Supabase Storage con il token firmato restituito da `POST /v1/receipts/upload-url`. */
export function createSupabaseStorageUploader(): StorageUploader {
  return {
    async uploadToSignedUrl({ path, token, file, contentType, onProgress, signal }) {
      signal?.throwIfAborted();
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new StorageError("STORAGE_NOT_CONFIGURED");
      // supabase-js non espone l'avanzamento: si segnala solo l'inizio e la fine.
      onProgress?.(0);
      const { error } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(path, token, file, { contentType });
      // supabase-js non accetta un AbortSignal: se l'utente ha annullato durante il
      // trasferimento, la pipeline scarta il risultato e "Elimina" cancella lo scontrino.
      signal?.throwIfAborted();
      if (error) throw new StorageError("UPLOAD_FAILED", error.message);
      onProgress?.(100);
    },
  };
}
