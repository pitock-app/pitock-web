"use client";

import { BarChart3, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState } from "@/components/layout";
import { Field, NativeSelect } from "@/components/form";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/errors";
import { it } from "@/lib/i18n/it";
import { useUsage } from "../hooks/useUsage";
import {
  daysOfPeriod,
  isUsagePeriod,
  toUsageQuery,
  usagePeriods,
  type UsagePeriod,
} from "../lib/usage-period";
import { RecentCalls } from "./RecentCalls";
import { UsageByModel } from "./UsageByModel";
import { UsageChart } from "./UsageChart";
import { UsageKpis } from "./UsageKpis";

const t = it.settings.usage;

/** Consumo token (`/settings/usage`): periodo, KPI, grafico, per modello, ultime chiamate. */
export function UsageView() {
  const [period, setPeriod] = useState<UsagePeriod>("this-month");
  // Le date si calcolano al cambio di periodo, non a ogni render.
  const { query, days } = useMemo(
    () => ({ query: toUsageQuery(period), days: daysOfPeriod(period) }),
    [period],
  );
  const usage = useUsage(query);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="usage-period" label={t.period} className="w-full sm:w-56">
          {(control) => (
            <NativeSelect
              {...control}
              value={period}
              onChange={(event) =>
                isUsagePeriod(event.target.value) && setPeriod(event.target.value)
              }
            >
              {usagePeriods.map((value) => (
                <option key={value} value={value}>
                  {t.periods[value]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <span role="status" className="text-muted-foreground flex h-11 items-center gap-2 text-sm">
          {usage.isFetching && usage.isPlaceholderData && (
            <>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              {t.loading}
            </>
          )}
        </span>
      </div>

      {usage.isPending ? (
        <div role="status" aria-label={t.loading} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : usage.isError ? (
        <ErrorState
          description={isApiError(usage.error) ? usage.error.message : t.loadError}
          onRetry={() => void usage.refetch()}
        />
      ) : (
        <>
          <UsageKpis totals={usage.data.totals} />
          {usage.data.totals.calls === 0 ? (
            <EmptyState icon={BarChart3} title={t.emptyTitle} description={t.emptyDescription} />
          ) : (
            <>
              <UsageChart series={usage.data.series} days={days} />
              <UsageByModel rows={usage.data.byModel} />
            </>
          )}
        </>
      )}

      <RecentCalls />
    </div>
  );
}
