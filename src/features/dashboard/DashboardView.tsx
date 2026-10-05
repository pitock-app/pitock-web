"use client";

import { Filter, LayoutDashboard, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { EmptyState, ErrorState } from "@/components/layout";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/errors";
import { toRomeDateInput } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { lastDay, shiftMonth, ymd } from "@/lib/period";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { CategoryPie } from "./CategoryPie";
import { DashboardSection } from "./DashboardSection";
import { DimensionFilters } from "./DimensionFilters";
import { ForecastCard } from "./ForecastCard";
import { FrequencyChart } from "./FrequencyChart";
import { useStats } from "./hooks/useStats";
import { useStatsDataset } from "./hooks/useStatsDataset";
import { KpiCards } from "./KpiCards";
import { storeColors } from "./lib/colors";
import {
  currentRange,
  granularityOf,
  isRangeInvalid,
  parseDashboardFilters,
  periodKeys,
  serializeDashboardFilters,
  type DashboardFilters,
} from "./lib/dashboard-period";
import {
  filterDataset,
  receiptAmounts,
  storeOptions,
  summarize,
  type Dataset,
  type DatasetFilters,
} from "./lib/dataset";
import { FORECAST_HISTORY_MONTHS, forecastRange } from "./lib/forecast";
import { productStats, toPurchases } from "./lib/products";
import { PeriodBars } from "./PeriodBars";
import { PeriodPicker } from "./PeriodPicker";
import { PriceHistory } from "./PriceHistory";
import { PriceChanges, SavingsRanking, TopProducts } from "./ProductRankings";
import { SavingsCard } from "./SavingsCard";
import { SavingsTips } from "./SavingsTips";
import { SourceSplit } from "./SourceSplit";
import { StoreComparison } from "./StoreComparison";
import { TopMerchants } from "./TopMerchants";
import { UnitPrices } from "./UnitPrices";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseDashboardFilters(searchParams), [searchParams]);
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

  const view = useMemo(() => {
    if (!dataset.data) return null;
    const { receipts, items } = filterDataset(dataset.data, dimensions);
    const amounts = receiptAmounts(receipts, items, dimensions.category);
    const purchases = toPurchases(receipts, items);
    return {
      receipts,
      summary: summarize(receipts, amounts, granularity),
      purchases,
      products: productStats(purchases),
    };
  }, [dataset.data, dimensions, granularity]);

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

  // `router.replace` aggiorna l'URL dopo: due modifiche ravvicinate (data iniziale e finale)
  // partono dall'ultimo periodo scritto, altrimenti la seconda cancellerebbe la prima.
  const latestFilters = useRef(filters);
  useEffect(() => {
    latestFilters.current = filters;
  }, [filters]);

  const writeFilters = (next: DashboardFilters) => {
    latestFilters.current = next;
    const search = serializeDashboardFilters(next).toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };
  // Il selettore del periodo non conosce negozio e categoria: si conservano.
  const setPeriod = (update: (previous: DashboardFilters) => DashboardFilters) => {
    const { store, category } = latestFilters.current;
    writeFilters({
      ...update(latestFilters.current),
      ...(store ? { store } : {}),
      ...(category ? { category } : {}),
    });
  };
  const setDimensions = (next: DatasetFilters) => {
    const { store: _store, category: _category, ...period } = latestFilters.current;
    writeFilters({
      ...period,
      ...(next.store ? { store: next.store } : {}),
      ...(next.category ? { category: next.category } : {}),
    });
  };

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
    const { summary, products, purchases } = view;
    return (
      <>
        {dataset.data?.truncated && (
          <p role="status" className="bg-muted rounded-lg px-3 py-2 text-sm">
            {t.truncated}
          </p>
        )}
        <DashboardSection
          id="summary"
          title={t.sections.summary}
          description={t.sections.summaryDescription}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {forecastSlot()}
            <div className="flex flex-col gap-4">
              <SavingsCard products={products} />
              <SavingsTips products={products} className="flex-1" />
            </div>
          </div>
          <KpiCards totals={summary.totals} />
        </DashboardSection>

        <DashboardSection
          id="overview"
          title={t.sections.overview}
          description={t.sections.overviewDescription}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <PeriodBars
              rows={summary.byPeriod}
              granularity={summary.granularity}
              // Con i dati del periodo precedente ancora a schermo le chiavi non corrispondono.
              keys={dataset.isPlaceholderData ? null : keys}
            />
            <CategoryPie
              rows={summary.byCategory}
              total={summary.totals.total}
              products={products}
            />
            <TopMerchants
              rows={summary.topMerchants}
              withoutMerchant={summary.withoutMerchant}
              total={summary.totals.total}
              colorOf={colorOf}
            />
            <SourceSplit rows={summary.bySource} total={summary.totals.total} />
          </div>
        </DashboardSection>

        <DashboardSection
          id="products"
          title={t.sections.products}
          description={t.sections.productsDescription}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <TopProducts products={products} />
            <SavingsRanking products={products} />
            <StoreComparison products={products} colorOf={colorOf} />
            <PriceChanges products={products} />
            <PriceHistory products={products} purchases={purchases} colorOf={colorOf} />
            <UnitPrices products={products} />
            <FrequencyChart products={products} />
          </div>
        </DashboardSection>
      </>
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
