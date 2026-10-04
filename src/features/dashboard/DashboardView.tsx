"use client";

import { LayoutDashboard, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { EmptyState, ErrorState } from "@/components/layout";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/errors";
import { it } from "@/lib/i18n/it";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { CategoryPie } from "./CategoryPie";
import { useStats } from "./hooks/useStats";
import { KpiCards } from "./KpiCards";
import {
  currentRange,
  isRangeInvalid,
  parseDashboardFilters,
  periodKeys,
  previousRange,
  serializeDashboardFilters,
  toStatsQuery,
  type DashboardFilters,
} from "./lib/dashboard-period";
import { PeriodBars } from "./PeriodBars";
import { PeriodPicker } from "./PeriodPicker";
import { SourceSplit } from "./SourceSplit";
import { TopMerchants } from "./TopMerchants";

const t = it.dashboard;

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label={t.loading} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

function AddReceiptLink() {
  return (
    <Link
      href={routes.add}
      className={cn(buttonVariants(), "bg-brand text-brand-foreground hover:bg-brand/90 h-11")}
    >
      <Plus aria-hidden />
      {t.addReceipt}
    </Link>
  );
}

/** Dashboard di spesa: periodo nella query string, KPI, grafici e stato vuoto. */
export function DashboardView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseDashboardFilters(searchParams), [searchParams]);
  // Le date si calcolano al cambio di periodo, non a ogni render.
  const { query, keys, previous, previousQuery } = useMemo(() => {
    const range = currentRange(filters);
    const statsQuery = isRangeInvalid(filters) ? null : toStatsQuery(range);
    const previousDates = previousRange(filters);
    return {
      query: statsQuery,
      keys: statsQuery ? periodKeys(range, statsQuery.granularity) : null,
      previous: previousDates,
      previousQuery: previousDates ? { ...previousDates, granularity: "month" as const } : null,
    };
  }, [filters]);

  const stats = useStats(query);
  const previousStats = useStats(previousQuery);
  const periodEmpty = stats.data?.totals.nReceipts === 0;
  // Solo se il periodo è vuoto: distingue "nessuno scontrino in assoluto" da "nessuno nel periodo".
  const allTime = useStats(periodEmpty ? { granularity: "year" } : null);
  const noReceiptsAtAll = periodEmpty && allTime.data?.totals.nReceipts === 0;

  // `router.replace` aggiorna l'URL dopo: due modifiche ravvicinate (data iniziale e finale)
  // partono dall'ultimo periodo scritto, altrimenti la seconda cancellerebbe la prima.
  const latestFilters = useRef(filters);
  useEffect(() => {
    latestFilters.current = filters;
  }, [filters]);

  const setFilters = (update: (previous: DashboardFilters) => DashboardFilters) => {
    const next = update(latestFilters.current);
    latestFilters.current = next;
    const search = serializeDashboardFilters(next).toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };

  const body = () => {
    if (!query) return null;
    if (stats.isPending || (periodEmpty && allTime.isPending)) return <DashboardSkeleton />;
    if (stats.isError) {
      return (
        <ErrorState
          description={isApiError(stats.error) ? stats.error.message : t.loadError}
          onRetry={() => void stats.refetch()}
        />
      );
    }
    if (noReceiptsAtAll) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          title={t.firstReceiptTitle}
          description={t.firstReceiptDescription}
          action={<AddReceiptLink />}
        />
      );
    }
    // Periodo senza scontrini: solo il messaggio, niente KPI a zero né grafici vuoti.
    if (periodEmpty) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          title={t.emptyPeriodTitle}
          description={t.emptyPeriodDescription}
          action={<AddReceiptLink />}
        />
      );
    }
    const data = stats.data;
    return (
      <>
        <KpiCards
          totals={data.totals}
          previousRange={previous}
          previousTotals={previousStats.isPlaceholderData ? undefined : previousStats.data?.totals}
          previousPending={
            !previousStats.isError && (previousStats.isPending || previousStats.isPlaceholderData)
          }
          previousError={previousStats.isError}
          onRetryPrevious={() => void previousStats.refetch()}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <PeriodBars
            rows={data.byPeriod}
            granularity={data.granularity}
            // Con i dati del periodo precedente ancora a schermo le chiavi non corrispondono.
            keys={data.granularity === query.granularity ? keys : null}
          />
          <CategoryPie rows={data.byCategory} total={data.totals.total} />
          <TopMerchants rows={data.topMerchants} total={data.totals.total} />
          <SourceSplit rows={data.bySource} total={data.totals.total} />
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-3">
        <PeriodPicker value={filters} onChange={setFilters} />
        <span
          role="status"
          className={cn(
            "text-muted-foreground flex items-center gap-2 text-sm sm:mt-6 sm:h-11",
            !(stats.isFetching && stats.isPlaceholderData) && "sr-only",
          )}
        >
          {stats.isFetching && stats.isPlaceholderData && (
            <>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              {t.loading}
            </>
          )}
        </span>
      </div>
      {body()}
    </div>
  );
}
