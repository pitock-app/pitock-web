import { api, unwrap } from "@/lib/api/client";
import { getStorageUploader } from "@/lib/storage";
import type { PipelineDeps } from "./upload-pipeline";
import { prepareFile } from "./prepare-file";
import { sha256 } from "./sha256";

/** Dipendenze reali della pipeline: tutte le chiamate passano dal client API. */
export const captureDeps: Omit<PipelineDeps, "onReceiptChanged"> = {
  prepareFile: (file, signal) => prepareFile(file, undefined, signal),
  sha256,
  requestUploadUrl: (body, signal) => unwrap(api.POST("/v1/receipts/upload-url", { body, signal })),
  upload: (upload) => getStorageUploader().uploadToSignedUrl(upload),
  complete: async (id, signal) => {
    await unwrap(api.POST("/v1/receipts/{id}/complete", { params: { path: { id } }, signal }));
  },
  getReceipt: (id, signal) =>
    unwrap(api.GET("/v1/receipts/{id}", { params: { path: { id } }, signal })),
  reextract: async (id) => {
    await unwrap(api.POST("/v1/receipts/{id}/reextract", { params: { path: { id } }, body: {} }));
  },
  deleteReceipt: async (id) => {
    await unwrap(api.DELETE("/v1/receipts/{id}", { params: { path: { id } } }));
  },
};
