"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/layout";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { useExtractions } from "./hooks/useReceipt";
import { providerLabel } from "./ExtractionMeta";
import { merchantLabel } from "./lib/display";

const t = it.receipt.history;

/** Storico delle estrazioni dello scontrino, dalla più recente. */
export function ExtractionHistory({ receiptId }: { receiptId: string }) {
  const history = useExtractions(receiptId);

  let content;
  if (history.isPending) {
    content = (
      <div role="status" aria-label={it.states.loading} className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  } else if (history.isError) {
    content = (
      <ErrorState
        headingLevel="h3"
        description={t.loadError}
        onRetry={() => void history.refetch()}
      />
    );
  } else if (history.data.items.length === 0) {
    content = <p className="text-muted-foreground text-sm">{t.empty}</p>;
  } else {
    content = (
      <ol className="flex flex-col gap-2" data-testid="extraction-history">
        {history.data.items.map((extraction) => (
          <li
            key={extraction.id}
            data-testid="extraction-history-item"
            className="bg-card flex flex-col gap-1 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t.entry(formatDateTime(extraction.createdAt))}</span>
              <span className="text-muted-foreground">
                {[
                  it.receipt.extraction.methods[extraction.method],
                  extraction.provider && providerLabel(extraction.provider),
                  extraction.model,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>{merchantLabel(extraction.merchantName)}</span>
              {extraction.total !== null && (
                <span className="font-semibold tabular-nums">
                  {formatCurrency(extraction.total, extraction.currency)}
                </span>
              )}
              {extraction.isCurrent && (
                <Badge className="bg-brand text-brand-foreground">{t.current}</Badge>
              )}
              {extraction.editedByUser && <Badge variant="outline">{t.edited}</Badge>}
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <section aria-labelledby="extraction-history-title" className="flex flex-col gap-3">
      <h2 id="extraction-history-title" className="text-lg font-semibold">
        {t.title}
      </h2>
      {content}
    </section>
  );
}
