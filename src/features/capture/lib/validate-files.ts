import { it } from "@/lib/i18n/it";
import { acceptedType, MAX_FILES_PER_DROP, maxInputBytes } from "./file-types";

export type RejectedFile = { name: string; reason: string };

const t = it.capture.dropzone;

/** Separa i file ammessi da quelli scartati, con il motivo per ciascuno. */
export function validateFiles(files: readonly File[]): {
  accepted: File[];
  rejected: RejectedFile[];
} {
  const accepted: File[] = [];
  const rejected: RejectedFile[] = [];
  for (const file of files) {
    if (!acceptedType(file)) {
      rejected.push({ name: file.name, reason: t.invalidType });
    } else if (file.size === 0) {
      rejected.push({ name: file.name, reason: t.empty });
    } else if (file.size > maxInputBytes(file)) {
      rejected.push({ name: file.name, reason: t.tooLarge(maxInputBytes(file) / (1024 * 1024)) });
    } else if (accepted.length >= MAX_FILES_PER_DROP) {
      rejected.push({ name: file.name, reason: t.tooMany });
    } else {
      accepted.push(file);
    }
  }
  return { accepted, rejected };
}
