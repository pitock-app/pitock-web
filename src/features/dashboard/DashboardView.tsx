"use client";

import { Filter, LayoutDashboard, Loader2, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { EmptyState, ErrorState } from "@/components/layout";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/errors";
import { toRomeDateInput } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { lastDay, shiftMonth, ymd } from "@/lib/period";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { DashboardSections } from "./DashboardSections";
import { DimensionFilters } from "./DimensionFilters";
import { ForecastCard } from "./ForecastCard";
import { useDashboardFilters } from "./hooks/useDashboardFilters";
import { useStats } from "./hooks/useStats";
import { useStatsDataset } from "./hooks/useStatsDataset";
import { storeColors } from "./lib/colors";
import { currentRange, granularityOf, isRangeInvalid, periodKeys } from "./lib/dashboard-period";
import {
  filterDataset,
  receiptAmounts,
  storeOptions,
  type Dataset,
  type DatasetFilters,
} from "./lib/dataset";
import { FORECAST_HISTORY_MONTHS, forecastRange } from "./lib/forecast";
import { useDashboardLayout } from "./lib/layout";
import { dashboardView } from "./lib/view";
import { PeriodPicker } from "./PeriodPicker";

const t = it.dashboard;

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label={t.loading} className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
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

/** Storico della previsione: i mesi interi prima di quello in corso, più il mese in corso. */
function forecastQuery(today: string) {
  const [year, month] = today.split("-").map(Number);
  const start = shiftMonth(year, month, -FORECAST_HISTORY_MONTHS);
  return { from: ymd(start.year, start.month, 1), to: ymd(year, month, lastDay(year, month)) };
}

/** Spese del dataset per la previsione, con gli importi che contano per i filtri. */
function toSpends(dataset: Dataset, filters: DatasetFilters) {
  const { receipts, items } = filterDataset(dataset, filters);
  const amounts = receiptAmounts(receipts, items, filters.category);
  return receipts.map((receipt) => ({
    day: toRomeDateInput(new Date(receipt.date)),
    amount: amounts.get(receipt.id) ?? 0,
    merchant: receipt.merchantName,
  }));
}

/**
 * Dashboard di spesa: periodo e filtri nella query string. In alto previsione e risparmio,
 * poi l'andamento generale, poi il dettaglio per prodotto. Tutto si calcola da
 * `GET /v1/stats/dataset`, così negozio e categoria filtrano ogni grafico allo stesso modo.
 */
export function DashboardView() {
  const { filters, setPeriod, setDimensions } = useDashboardFilters();
  const { customized, reset: resetLayout } = useDashboardLayout();
  // Le date si calcolano al cambio di periodo, non a ogni render.
  const { range, query, keys, granularity, today, historyQuery } = useMemo(() => {
    const range = currentRange(filters);
    const day = toRomeDateInput();
    const granularityValue = granularityOf(range);
    return {
      range,
      query: isRangeInvalid(filters)
        ? null
        : { ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) },
      keys: periodKeys(range, granularityValue),
      granularity: granularityValue,
      today: day,
      historyQuery: forecastQuery(day),
    };
  }, [filters]);
  const dimensions = useMemo<DatasetFilters>(
    () => ({
      ...(filters.store ? { store: filters.store } : {}),
      ...(filters.category ? { category: filters.category } : {}),
    }),
    [filters.store, filters.category],
  );
  const filtered = Boolean(filters.store || filters.category);

  const dataset = useStatsDataset(query);
  const history = useStatsDataset(historyQuery);
  const periodEmpty = dataset.data?.receipts.length === 0;
  // Solo se il periodo è vuoto: distingue "nessuno scontrino in assoluto" da "nessuno nel periodo".
  const allTime = useStats(periodEmpty ? { granularity: "year" } : null);
  const noReceiptsAtAll = periodEmpty && allTime.data?.totals.nReceipts === 0;

  // Giorni già trascorsi del periodo: dall'inizio (o dal primo scontrino) a oggi o alla fine.
  const span = useMemo(() => {
    const days = dataset.data?.receipts.map((r) => toRomeDateInput(new Date(r.date))) ?? [];
    const from =
      range.from ?? days.reduce<string | null>((min, d) => (!min || d < min ? d : min), null);
    const to = range.to && range.to < today ? range.to : today;
    return from && from <= to ? { from, to } : null;
  }, [dataset.data, range, today]);

  const view = useMemo(
    () => (dataset.data ? dashboardView(dataset.data, dimensions, granularity) : null),
    [dataset.data, dimensions, granularity],
  );

  // Spesa reale del periodo scelto e previsione fino alla sua fine, dallo storico.
  const forecast = useMemo(
    () =>
      dataset.data && history.data
        ? forecastRange(
            toSpends(dataset.data, dimensions),
            toSpends(history.data, dimensions),
            range,
            today,
          )
        : null,
    [dataset.data, history.data, dimensions, range, today],
  );

  // Colori dei negozi dai dati senza filtri: il colore segue il negozio in tutti i grafici.
  const { stores, colorOf } = useMemo(() => {
    const ranking = storeOptions([
      ...(dataset.data?.receipts ?? []),
      ...(history.data?.receipts ?? []),
    ]);
    return { stores: storeOptions(dataset.data?.receipts ?? []), colorOf: storeColors(ranking) };
  }, [dataset.data, history.data]);

  const forecastSlot = () => {
    if (forecast) {
      return <ForecastCard forecast={forecast} filtered={filtered} className="lg:col-span-2" />;
    }
    if (history.isError) {
      return (
        <div className="bg-card flex flex-col items-start gap-2 rounded-xl border p-4 lg:col-span-2">
          <p className="font-semibold">{t.forecast.title}</p>
          <p className="text-muted-foreground text-sm">{t.forecast.loadError}</p>
          <Button variant="outline" className="h-11" onClick={() => void history.refetch()}>
            {it.states.retry}
          </Button>
        </div>
      );
    }
    return <Skeleton className="h-80 rounded-xl lg:col-span-2" />;
  };

  const body = () => {
    if (!query) return null;
    if (dataset.isPending || (periodEmpty && allTime.isPending)) return <DashboardSkeleton />;
    if (dataset.isError) {
      return (
        <ErrorState
          description={isApiError(dataset.error) ? dataset.error.message : t.loadError}
          onRetry={() => void dataset.refetch()}
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
    if (!view) return null;
    if (view.receipts.length === 0) {
      return (
        <EmptyState
          icon={Filter}
          title={t.filters.emptyTitle}
          description={t.filters.emptyDescription}
          action={
            <Button variant="outline" className="h-11" onClick={() => setDimensions({})}>
              {t.filters.clear}
            </Button>
          }
        />
      );
    }
    return (
      <DashboardSections
        view={view}
        truncated={dataset.data?.truncated ?? false}
        // Con i dati del periodo precedente ancora a schermo le chiavi non corrispondono.
        keys={dataset.isPlaceholderData ? null : keys}
        colorOf={colorOf}
        forecast={forecastSlot()}
        span={span}
      />
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start gap-3">
          <PeriodPicker value={filters} onChange={setPeriod} />
          <span
            role="status"
            className={cn(
              "text-muted-foreground flex items-center gap-2 text-sm",
              !(dataset.isFetching && dataset.isPlaceholderData) && "sr-only",
            )}
          >
            {dataset.isFetching && dataset.isPlaceholderData && (
              <>
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                {t.loading}
              </>
            )}
          </span>
          {customized && (
            <Button variant="ghost" size="sm" className="ml-auto h-11" onClick={resetLayout}>
              <RotateCcw aria-hidden />
              {t.layout.reset}
            </Button>
          )}
        </div>
        <DimensionFilters
          stores={stores}
          store={filters.store}
          category={filters.category}
          onChange={setDimensions}
        />
      </div>
      {body()}
    </div>
  );
}
