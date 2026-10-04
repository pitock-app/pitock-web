import { TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/schema";
import { formatCurrency, formatDayRange, formatNumber, formatPercentChange } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { percentChange } from "./lib/dashboard-period";

type Totals = components["schemas"]["StatsTotals"];

const t = it.dashboard;

type KpiCardsProps = {
  totals: Totals;
  /** Periodo di confronto; null se non c'è (intervallo personalizzato aperto). */
  previousRange: { from: string; to: string } | null;
  /** Totali del periodo di confronto: undefined mentre si caricano o se la richiesta fallisce. */
  previousTotals: Totals | undefined;
  previousPending: boolean;
  /** La richiesta del periodo di confronto è fallita. */
  previousError?: boolean;
  onRetryPrevious?: () => void;
};

function ChangeValue({
  totals,
  previousRange,
  previousTotals,
  previousPending,
  previousError,
  onRetryPrevious,
}: KpiCardsProps) {
  if (previousRange && previousPending) {
    return (
      <dd className="mt-1">
        <Skeleton className="h-8 w-24" />
      </dd>
    );
  }
  if (previousRange && previousError) {
    return (
      <>
        <dd className="mt-1 text-xl font-semibold sm:text-2xl">{t.changeNotAvailable}</dd>
        <dd className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 text-xs">
          {t.changeLoadError}
          {onRetryPrevious && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={onRetryPrevious}
            >
              {it.states.retry}
            </Button>
          )}
        </dd>
      </>
    );
  }
  const change =
    previousRange && previousTotals ? percentChange(totals.total, previousTotals.total) : null;
  const hint = !previousRange
    ? t.changeNoRange
    : previousTotals && previousTotals.total === 0
      ? t.changeNoPrevious
      : t.changeVs(formatDayRange(previousRange.from, previousRange.to));

  const Icon = change === null || change === 0 ? null : change > 0 ? TrendingUp : TrendingDown;
  return (
    <>
      <dd className="mt-1 flex items-center gap-1.5 text-xl font-semibold tabular-nums sm:text-2xl">
        {Icon && <Icon className="size-5 shrink-0" aria-hidden />}
        {Icon && <span className="sr-only">{change! > 0 ? t.changeUp : t.changeDown}</span>}
        <span data-testid="dashboard-kpi-change">
          {change === null ? t.changeNotAvailable : formatPercentChange(change)}
        </span>
      </dd>
      <dd className="text-muted-foreground mt-1 text-xs">{hint}</dd>
    </>
  );
}

/** KPI del periodo: totale speso, numero di scontrini, scontrino medio, variazione. */
export function KpiCards(props: KpiCardsProps) {
  const { totals } = props;
  const items = [
    { id: "total", label: t.total, value: formatCurrency(totals.total) },
    { id: "count", label: t.count, value: formatNumber(totals.nReceipts, 0) },
    { id: "average", label: t.average, value: formatCurrency(totals.average) },
  ];
  return (
    <section aria-label={t.kpiLabel}>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.id} className="bg-card min-w-0 rounded-xl border p-4">
            <dt className="text-muted-foreground text-sm">{item.label}</dt>
            <dd
              className="mt-1 text-xl font-semibold break-words tabular-nums sm:text-2xl"
              data-testid={`dashboard-kpi-${item.id}`}
            >
              {item.value}
            </dd>
          </div>
        ))}
        <div className="bg-card min-w-0 rounded-xl border p-4">
          <dt className="text-muted-foreground text-sm">{t.change}</dt>
          <ChangeValue {...props} />
        </div>
      </dl>
    </section>
  );
}
