"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Flag,
  Loader2,
  Pencil,
  RotateCcw,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { suggestsOwnKey } from "@/lib/api/errors";
import { formatCurrency, formatDate, formatFileSize } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { isPdf } from "./lib/file-types";
import { needsSettings, queueErrorMessage } from "./lib/queue-messages";
import { queueOutcome, reviewIssues, type QueueOutcome } from "./lib/queue-review";
import type { QueueItem } from "./store/upload-queue.store";

const t = it.capture.queue;

type UploadQueueItemProps = {
  item: QueueItem;
  onRetry(id: string): void;
  onRemove(id: string): void;
  onDismiss(id: string): void;
  removing?: boolean;
};

function canPreview(file: File) {
  return file.type.startsWith("image/") && !file.type.includes("hei") && !isPdf(file);
}

function Thumbnail({ file }: { file: File }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const preview = canPreview(file);
  // L'URL blob: si crea e si revoca nell'effetto, collegandolo direttamente all'<img>.
  useEffect(() => {
    if (!preview || !imageRef.current) return;
    const objectUrl = URL.createObjectURL(file);
    imageRef.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, preview]);

  return (
    <span className="bg-muted text-muted-foreground flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- anteprima locale (blob:)
        <img ref={imageRef} alt="" className="size-full object-cover" />
      ) : (
        <FileText className="size-6" aria-hidden />
      )}
    </span>
  );
}

function StatusBadge({ status, outcome }: { status: QueueItem["status"]; outcome: QueueOutcome }) {
  const label = t.status[status];
  if (outcome === "attention") {
    return (
      <Badge className="bg-amber-400 text-amber-950 dark:bg-amber-400 dark:text-amber-950">
        <AlertTriangle aria-hidden />
        {t.attention}
      </Badge>
    );
  }
  if (status === "done") {
    return (
      <Badge className="bg-emerald-700 text-white dark:bg-emerald-400 dark:text-emerald-950">
        <CheckCircle2 aria-hidden />
        {label}
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge className="bg-destructive text-white dark:bg-red-600 dark:text-white">
        <Flag aria-hidden />
        {label}
      </Badge>
    );
  }
  if (status === "duplicate") {
    return (
      <Badge variant="outline">
        <Copy aria-hidden />
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
      {label}
    </Badge>
  );
}

const linkButton = cn(buttonVariants({ variant: "outline" }), "h-11");

/** Bordo e sfondo della card in base all'esito: rosso, giallo, verde o neutro. */
const cardTone: Record<QueueOutcome, string> = {
  failed: "border-destructive/50 border-l-destructive bg-destructive/5 border-l-4",
  attention: "border-amber-500/60 border-l-amber-500 border-l-4 bg-amber-50 dark:bg-amber-950/30",
  active: "bg-card",
  ok: "bg-card border-l-emerald-600 dark:border-l-emerald-400 border-l-4",
};

/** Card di un elemento della coda: stato, avanzamento, risultato o errore con le azioni. */
export function UploadQueueItem({
  item,
  onRetry,
  onRemove,
  onDismiss,
  removing,
}: UploadQueueItemProps) {
  const { status, result, receiptId } = item;
  const sourceLabel = t.sources[item.source];
  const outcome = queueOutcome(item);
  const issues = reviewIssues(result);
  const attention = outcome === "attention";

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-3 sm:p-4",
        status === "duplicate" ? "bg-card" : cardTone[outcome],
      )}
      data-testid="upload-queue-item"
      data-status={status}
      data-outcome={outcome}
      aria-label={item.name}
    >
      <div className="flex items-start gap-3">
        <Thumbnail file={item.file} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="truncate text-sm font-medium" title={item.name}>
              {item.name}
            </p>
            <StatusBadge status={status} outcome={outcome} />
          </div>
          <p className="text-muted-foreground text-xs">
            {sourceLabel} · {formatFileSize(item.file.size)}
          </p>
          {status === "uploading" && (
            <Progress
              value={item.progress ?? 0}
              aria-label={t.progress(item.name)}
              className="mt-1"
            />
          )}
        </div>
        {(status === "done" || status === "duplicate") && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={`${t.dismiss}: ${item.name}`}
            onClick={() => onDismiss(item.id)}
          >
            <X aria-hidden />
          </Button>
        )}
      </div>

      {status === "done" && result && receiptId && (
        <div
          className={cn(
            "flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between",
            attention && "border-amber-500/40",
          )}
        >
          {attention && (
            <p
              className="flex items-start gap-2 text-sm text-amber-900 sm:basis-full dark:text-amber-100"
              data-testid="queue-attention"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {t.attentionHint}{" "}
                <span className="font-medium">
                  ({issues.map((issue) => t.issues[issue]).join(", ")})
                </span>
              </span>
            </p>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:flex sm:flex-wrap sm:gap-x-6">
            <div>
              <dt className="sr-only">{it.manualEntry.merchantName}</dt>
              <dd className="font-medium">{result.merchantName ?? t.unknownMerchant}</dd>
            </div>
            {result.purchasedAt && (
              <div>
                <dt className="sr-only">{it.manualEntry.purchasedAt}</dt>
                <dd>{formatDate(result.purchasedAt)}</dd>
              </div>
            )}
            {result.total !== null && (
              <div>
                <dt className="sr-only">{it.manualEntry.total}</dt>
                <dd className="font-semibold tabular-nums">
                  {formatCurrency(result.total, result.currency)}
                </dd>
              </div>
            )}
            {result.category && (
              <div>
                <dt className="sr-only">{it.manualEntry.category}</dt>
                <dd>{it.categories[result.category]}</dd>
              </div>
            )}
          </dl>
          <div className="flex gap-2">
            <Link href={routes.receipt(receiptId)} className={linkButton}>
              <ExternalLink aria-hidden />
              {t.open}
            </Link>
            <Link
              href={routes.editReceipt(receiptId)}
              className={
                attention
                  ? cn(
                      buttonVariants(),
                      "h-11 bg-amber-400 text-amber-950 hover:bg-amber-400/90 dark:bg-amber-400 dark:text-amber-950",
                    )
                  : linkButton
              }
            >
              <Pencil aria-hidden />
              {t.edit}
            </Link>
          </div>
        </div>
      )}

      {status === "duplicate" && item.duplicateOf && (
        <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">{it.apiErrors.DUPLICATE}</p>
          <Link href={routes.receipt(item.duplicateOf)} className={linkButton}>
            <ExternalLink aria-hidden />
            {t.openDuplicate}
          </Link>
        </div>
      )}

      {status === "failed" && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-destructive text-sm">{queueErrorMessage(item.errorCode)}</p>
          <div className="flex flex-wrap gap-2">
            {needsSettings(item.errorCode) && (
              <Link href={routes.settingsAi} className={linkButton}>
                <Settings aria-hidden />
                {suggestsOwnKey(item.errorCode) ? t.addKey : t.goToSettings}
              </Link>
            )}
            {item.failedStep === "timeout" && receiptId && (
              <Link href={routes.receipt(receiptId)} className={linkButton}>
                <ExternalLink aria-hidden />
                {t.open}
              </Link>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onRetry(item.id)}
            >
              <RotateCcw aria-hidden />
              {t.retry}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              disabled={removing}
              onClick={() => onRemove(item.id)}
            >
              <Trash2 aria-hidden />
              {t.remove}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
