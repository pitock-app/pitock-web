"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Loader2, Settings, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { EmptyState, ErrorState, PageHeader } from "@/components/layout";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage, isApiError, needsAiSettings, suggestsOwnKey } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import type { components } from "@/lib/api/schema";
import { formatDateTime } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { DeleteReceiptDialog } from "./DeleteReceiptDialog";
import { ExtractionForm } from "./ExtractionForm";
import { ExtractionHistory } from "./ExtractionHistory";
import { ExtractionMeta } from "./ExtractionMeta";
import { useReceipt } from "./hooks/useReceipt";
import { merchantLabel } from "./lib/display";
import { isPendingStatus } from "./lib/status";
import { ReceiptViewer } from "./ReceiptViewer";
import { ReextractDialog } from "./ReextractDialog";
import { SourceBadge } from "./SourceBadge";
import { StatusBadge } from "./StatusBadge";

type ReceiptDetail = components["schemas"]["ReceiptDetail"];

const t = it.receipt;

function BackLink() {
  return (
    <Link
      href={routes.receipts}
      className={cn(buttonVariants({ variant: "ghost" }), "mb-2 -ml-2 h-11 w-fit")}
    >
      <ArrowLeft aria-hidden />
      {t.backToList}
    </Link>
  );
}

function Notice({
  tone = "info",
  icon: Icon,
  title,
  children,
}: {
  tone?: "info" | "error";
  icon: typeof AlertCircle;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border p-4",
        tone === "error" ? "border-destructive/30 bg-destructive/5" : "bg-muted/40",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          tone === "error" ? "text-destructive" : "text-muted-foreground",
          Icon === Loader2 && "animate-spin motion-reduce:animate-none",
        )}
        aria-hidden
      />
      <div className="flex flex-col gap-2 text-sm">
        <p className="font-semibold">{title}</p>
        {children}
      </div>
    </div>
  );
}

function StatusNotice({ detail }: { detail: ReceiptDetail }) {
  const { status, errorCode } = detail.receipt;
  if (isPendingStatus(status)) {
    return (
      <div role="status">
        <Notice icon={Loader2} title={t.extraction.processingTitle}>
          <p className="text-muted-foreground">{t.extraction.processingDescription}</p>
        </Notice>
      </div>
    );
  }
  if (status === "pending_upload") {
    return (
      <Notice icon={UploadCloud} title={t.extraction.pendingUploadTitle}>
        <p className="text-muted-foreground">{t.extraction.pendingUploadDescription}</p>
      </Notice>
    );
  }
  if (status === "failed") {
    return (
      <Notice tone="error" icon={AlertCircle} title={t.extraction.failedTitle}>
        <p>{apiErrorMessage(errorCode ?? "UNKNOWN")}</p>
        {needsAiSettings(errorCode) && (
          <Link
            href={routes.settingsAi}
            className={cn(buttonVariants({ variant: "outline" }), "h-11 w-fit")}
          >
            <Settings aria-hidden />
            {suggestsOwnKey(errorCode) ? it.capture.queue.addKey : it.capture.queue.goToSettings}
          </Link>
        )}
      </Notice>
    );
  }
  return null;
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label={t.loading} className="flex flex-col gap-4">
      <Skeleton className="h-8 w-60" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Dettaglio: file originale, estrazione modificabile, azioni e storico. */
export function ReceiptDetailView({ id, edit = false }: { id: string; edit?: boolean }) {
  const queryClient = useQueryClient();
  const receipt = useReceipt(id);
  const status = receipt.data?.receipt.status;

  // A elaborazione finita lo storico ha una nuova estrazione.
  const previousStatus = useRef(status);
  useEffect(() => {
    if (
      previousStatus.current &&
      status &&
      isPendingStatus(previousStatus.current) &&
      !isPendingStatus(status)
    ) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.receipts.extractions(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.receipts.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.receipts.allStats() });
    }
    previousStatus.current = status;
  }, [id, queryClient, status]);

  if (receipt.isPending) {
    return (
      <>
        <BackLink />
        <DetailSkeleton />
      </>
    );
  }

  if (receipt.isError) {
    const missing =
      isApiError(receipt.error) && (receipt.error.status === 404 || receipt.error.status === 400);
    return (
      <>
        <BackLink />
        {missing ? (
          <EmptyState
            headingLevel="h1"
            title={t.notFoundTitle}
            description={t.notFoundDescription}
          />
        ) : (
          <ErrorState
            headingLevel="h1"
            description={t.loadError}
            onRetry={() => void receipt.refetch()}
          />
        )}
      </>
    );
  }

  const detail = receipt.data;
  const { extraction } = detail;
  const isManual = detail.receipt.source === "manual";
  const pending = isPendingStatus(detail.receipt.status);
  const canReextract =
    !isManual && (detail.receipt.status === "extracted" || detail.receipt.status === "failed");
  const purchasedAt = extraction?.purchasedAt ?? detail.receipt.createdAt;

  return (
    <>
      <BackLink />
      <PageHeader
        title={merchantLabel(extraction?.merchantName)}
        description={formatDateTime(purchasedAt)}
        actions={
          <div className="flex flex-wrap gap-2" role="group" aria-label={t.actions.label}>
            {!isManual && (
              <ReextractDialog
                receiptId={id}
                disabled={!canReextract}
                describedBy="reextract-unavailable"
              />
            )}
            <DeleteReceiptDialog receiptId={id} />
          </div>
        }
      />
      <div className="-mt-4 mb-6 flex flex-wrap items-center gap-2">
        <SourceBadge source={detail.receipt.source} />
        <StatusBadge status={detail.receipt.status} />
        {!isManual && !canReextract && (
          <span id="reextract-unavailable" className="text-muted-foreground text-xs">
            {t.actions.reextractUnavailable}
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="viewer-title" className="flex flex-col gap-3">
          <h2 id="viewer-title" className="text-lg font-semibold">
            {t.viewer.title}
          </h2>
          <ReceiptViewer receipt={detail.receipt} fileUrl={detail.fileUrl} />
        </section>

        <section aria-labelledby="extraction-title" className="flex flex-col gap-4">
          <h2 id="extraction-title" className="text-lg font-semibold">
            {t.extraction.title}
          </h2>
          <StatusNotice detail={detail} />
          {extraction && !pending && (
            <>
              <ExtractionMeta extraction={extraction} usage={detail.usage} />
              <ExtractionForm key={extraction.id} extraction={extraction} autoFocus={edit} />
            </>
          )}
          {!extraction && !pending && detail.receipt.status !== "failed" && (
            <p className="text-muted-foreground text-sm">{t.extraction.noExtraction}</p>
          )}
        </section>
      </div>

      <div className="mt-8">
        <ExtractionHistory receiptId={id} />
      </div>
    </>
  );
}
