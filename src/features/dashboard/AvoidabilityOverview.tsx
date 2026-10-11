"use client";

import { useState } from "react";
import { formatCurrency, formatNumber, formatShare } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";
import { bucketLabel, bucketOpacity, LEVEL_BUTTON, Swatch } from "./avoidability-ui";
import { ChartCard, DataTable, NoData, shareOf } from "./ChartCard";
import { LineDrill } from "./LineDrill";
import {
  AVOIDABILITY_BUCKETS,
  avoidabilityLines,
  type AvoidabilityBucket,
  type AvoidabilityTotals,
} from "./lib/avoidability";
import { AVOIDABILITY_COLORS } from "./lib/colors";
import type { CategoryLine } from "./lib/dataset";

const t = it.dashboard.avoidability;

/**
 * Indice del periodo con la spesa divisa per livello: numero in evidenza, barra al 100% e
 * importi. Un clic su un livello (segmento o riga) apre i suoi acquisti, dal più costoso.
 * La spesa non classificata resta fuori dall'indice ed è segnalata a parte.
 */
export function AvoidabilityOverview({
  totals,
  lines,
  className,
}: {
  totals: AvoidabilityTotals;
  lines: CategoryLine[];
  className?: string;
}) {
  const [selected, setSelected] = useState<AvoidabilityBucket | null>(null);
  const { amounts, index } = totals;
  const all = AVOIDABILITY_BUCKETS.reduce((sum, bucket) => sum + Math.max(amounts[bucket], 0), 0);
  const buckets = AVOIDABILITY_BUCKETS.filter((bucket) => amounts[bucket] > 0);
  const active = selected && buckets.includes(selected) ? selected : null;
  return (
    <ChartCard
      id="avoidability"
      title={t.title}
      description={active ? t.purchasesOf(bucketLabel(active), null) : t.description}
      className={className}
      table={
        buckets.length > 0 && (
          <DataTable
            caption={t.title}
            headers={[t.level, it.dashboard.amount, t.share]}
            rows={buckets.map((bucket) => ({
              key: bucket,
              cells: [
                bucketLabel(bucket),
                formatCurrency(amounts[bucket]),
                formatShare(shareOf(amounts[bucket], all), 1),
              ],
            }))}
          />
        )
      }
    >
      {active ? (
        <LineDrill
          lines={avoidabilityLines(lines, active)}
          color={AVOIDABILITY_COLORS[active]}
          backLabel={t.back}
          onBack={() => setSelected(null)}
          testId="avoidability-purchases-total"
        />
      ) : index === null && buckets.length === 0 ? (
        <NoData>{t.none}</NoData>
      ) : (
        <div className="flex flex-col gap-4">
          {index === null ? (
            <NoData>{t.none}</NoData>
          ) : (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-5xl font-semibold tabular-nums" data-testid="avoidability-index">
                {formatNumber(Math.round(index), 0)}
                <span className="text-muted-foreground ml-1 text-base font-normal">
                  {t.indexLabel}
                </span>
              </p>
              <p className="text-muted-foreground text-sm" data-testid="avoidability-avoidable">
                {t.avoidable(formatCurrency(totals.avoidable))}
              </p>
            </div>
          )}
          {/* Segmenti cliccabili: la stessa scelta è disponibile da tastiera nella legenda. */}
          <div className="flex h-4 w-full gap-0.5" aria-hidden>
            {buckets.map((bucket) => (
              <button
                key={bucket}
                type="button"
                tabIndex={-1}
                onClick={() => setSelected(bucket)}
                className="h-full cursor-pointer transition-[filter,transform] first:rounded-l-full last:rounded-r-full hover:scale-y-125 hover:brightness-110"
                title={`${bucketLabel(bucket)}: ${formatCurrency(amounts[bucket])}`}
                style={{
                  width: `${shareOf(amounts[bucket], all)}%`,
                  background: AVOIDABILITY_COLORS[bucket],
                  opacity: bucketOpacity(bucket),
                }}
              />
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <ul className="flex flex-col text-sm" data-testid="avoidability-legend">
              {buckets.map((bucket) => (
                <li key={bucket}>
                  <button
                    type="button"
                    onClick={() => setSelected(bucket)}
                    className={cn(
                      LEVEL_BUTTON,
                      "flex min-h-9 w-full items-center gap-2 px-1 text-left",
                    )}
                  >
                    <Swatch bucket={bucket} />
                    <span className="min-w-0 flex-1 truncate">{bucketLabel(bucket)}</span>
                    <span className="tabular-nums">{formatCurrency(amounts[bucket])}</span>
                    <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
                      {formatShare(shareOf(amounts[bucket], all))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs">{t.hint}</p>
          </div>
          {amounts.unclassified > 0 && (
            <p className="text-muted-foreground text-xs">
              {t.unclassifiedNote(formatCurrency(amounts.unclassified))}
            </p>
          )}
        </div>
      )}
    </ChartCard>
  );
}
