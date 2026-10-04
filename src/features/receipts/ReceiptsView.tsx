"use client";

import { Loader2, Plus, Receipt, SearchX } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef } from "react";
import { EmptyState, ErrorState } from "@/components/layout";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { it } from "@/lib/i18n/it";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useReceipts } from "./hooks/useReceipts";
import {
  defaultReceiptFilters,
  hasActiveFilters,
  parseReceiptFilters,
  serializeReceiptFilters,
  toListQuery,
  type ReceiptFilters as Filters,
} from "./lib/receipt-filters";
import { ReceiptCardList } from "./ReceiptCardList";
import { ReceiptFilters } from "./ReceiptFilters";
import { ReceiptTable } from "./ReceiptTable";

const t = it.receipts;

export function ReceiptListSkeleton() {
  return (
    <div role="status" aria-label={t.loading} className="flex flex-col gap-2">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

/** Lista degli scontrini con i filtri nella query string (condivisibili). */
export function ReceiptsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseReceiptFilters(searchParams), [searchParams]);
  const query = useMemo(() => toListQuery(filters), [filters]);
  const receipts = useReceipts(query);
  const listRef = useRef<HTMLDivElement>(null);

  /** Carica la pagina successiva e porta il focus sul primo scontrino nuovo. */
  const loadMore = async () => {
    if (receipts.isFetchingNextPage) return;
    const before = items.length;
    await receipts.fetchNextPage();
    const links = [
      ...(listRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-receipt-link]") ?? []),
    ].filter((link) => link.offsetParent !== null || link.getClientRects().length > 0);
    links[before]?.focus();
  };

  const setFilters = (next: Filters) => {
    const search = serializeReceiptFilters(next).toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };

  const items = receipts.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = hasActiveFilters(filters);

  let content;
  if (receipts.isPending) {
    content = <ReceiptListSkeleton />;
  } else if (receipts.isError && items.length === 0) {
    content = <ErrorState description={t.loadError} onRetry={() => void receipts.refetch()} />;
  } else if (items.length === 0) {
    content = filtered ? (
      <EmptyState
        icon={SearchX}
        title={t.noResultsTitle}
        description={t.noResultsDescription}
        action={
          <Button
            variant="outline"
            className="h-11"
            onClick={() => setFilters(defaultReceiptFilters)}
          >
            {t.filters.reset}
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={Receipt}
        title={t.emptyTitle}
        description={t.emptyDescription}
        action={
          <Link
            href={routes.add}
            className={cn(
              buttonVariants(),
              "bg-brand text-brand-foreground hover:bg-brand/90 h-11",
            )}
          >
            <Plus aria-hidden />
            {t.addFirst}
          </Link>
        }
      />
    );
  } else {
    content = (
      <>
        <p
          className="text-muted-foreground mb-2 flex items-center gap-2 text-sm"
          aria-live="polite"
        >
          {receipts.isPlaceholderData ? (
            <>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              {it.states.loading}
            </>
          ) : (
            t.shown(items.length)
          )}
        </p>
        <div
          ref={listRef}
          aria-busy={receipts.isPlaceholderData}
          className={cn("transition-opacity", receipts.isPlaceholderData && "opacity-60")}
        >
          <div className="hidden md:block">
            <ReceiptTable items={items} />
          </div>
          <div className="md:hidden">
            <ReceiptCardList items={items} />
          </div>
        </div>
        <div className="mt-4 flex flex-col items-center gap-2">
          {receipts.isFetchNextPageError && (
            <p role="alert" className="text-destructive text-sm">
              {t.loadMoreError}
            </p>
          )}
          {receipts.hasNextPage && (
            <Button
              variant="outline"
              className="h-11"
              // Resta focalizzabile mentre carica, così il focus non si perde.
              focusableWhenDisabled
              disabled={receipts.isFetchingNextPage}
              onClick={() => void loadMore()}
            >
              {receipts.isFetchingNextPage && (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              )}
              {receipts.isFetchingNextPage ? t.loadingMore : t.loadMore}
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <ReceiptFilters filters={filters} onChange={setFilters} />
      {content}
    </>
  );
}
