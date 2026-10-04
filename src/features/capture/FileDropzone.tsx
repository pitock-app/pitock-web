"use client";

import { FileUp } from "lucide-react";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";
import { ACCEPTED_FILE_TYPES } from "./lib/file-types";
import { validateFiles, type RejectedFile } from "./lib/validate-files";
import { useUploadQueue } from "./store/upload-queue.store";

const t = it.capture.dropzone;

/** Dropzone multipla: i file ammessi entrano nella coda con `source = "file"`. */
export function FileDropzone() {
  const add = useUploadQueue((state) => state.add);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);

  const onFiles = (files: File[]) => {
    const result = validateFiles(files);
    setRejected(result.rejected);
    if (result.accepted.length) {
      add(result.accepted.map((file) => ({ file, source: "file" as const })));
      toast.success(t.added(result.accepted.length));
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    // La validazione è nostra, per avere un messaggio per ogni file scartato.
    onDrop: (accepted, refused) => onFiles([...accepted, ...refused.map((entry) => entry.file)]),
    accept: Object.fromEntries(
      Object.entries(ACCEPTED_FILE_TYPES).map(([mime, ext]) => [mime, [...ext]]),
    ),
    multiple: true,
    useFsAccessApi: false,
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Fuori dalla zona con role="button": niente controlli annidati. */}
      <input {...getInputProps({ "aria-label": t.label })} data-testid="file-input" />
      <div
        {...getRootProps({
          role: "button",
          "aria-label": t.label,
          "aria-describedby": "dropzone-hint",
          className: cn(
            "border-input hover:border-brand hover:bg-brand/5 focus-visible:ring-ring focus-visible:ring-offset-background flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-offset-2",
            isDragActive && "border-brand bg-brand/10",
          ),
        })}
      >
        <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
          <FileUp className="size-6" aria-hidden />
        </span>
        <p className="text-base font-semibold">{isDragActive ? t.dropNow : t.title}</p>
        <p id="dropzone-hint" className="text-muted-foreground max-w-md text-sm">
          {t.hint}
        </p>
        <span className="bg-primary text-primary-foreground inline-flex h-11 items-center rounded-lg px-4 text-sm font-medium">
          {t.choose}
        </span>
      </div>

      {rejected.length > 0 && (
        <div role="alert" className="border-destructive/40 bg-destructive/5 rounded-lg border p-3">
          <p className="text-destructive text-sm font-medium">{t.rejectedTitle}</p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {rejected.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <span className="font-medium break-all">{file.name}</span>: {file.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
