import { isMockMode } from "@/lib/env";
import { createMockStorageUploader } from "./mock-storage";
import { createSupabaseStorageUploader } from "./supabase-storage";
import type { StorageUploader } from "./types";

export { StorageError, type SignedUpload, type StorageUploader } from "./types";

let uploader: StorageUploader | null = null;

/** Upload dei file: finto con NEXT_PUBLIC_API_MOCKING=true, altrimenti Supabase Storage. */
export function getStorageUploader(): StorageUploader {
  uploader ??= isMockMode ? createMockStorageUploader() : createSupabaseStorageUploader();
  return uploader;
}
