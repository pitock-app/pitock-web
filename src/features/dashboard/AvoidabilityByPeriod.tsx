"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactCurrency, formatCurrency, formatNumber, formatPeriodKey } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";
import { bucketLabel, bucketOpacity, DIMMED, LEVEL_BUTTON, Swatch } from "./avoidability-ui";
import { axisTick, ChartCard, DataTable, NoData, tooltipStyle } from "./ChartCard";
import { LineDrill } from "./LineDrill";
import {
  AVOIDABILITY_BUCKETS,
  avoidabilityByPeriod,
  avoidabilityLines,
  type AvoidabilityBucket,
} from "./lib/avoidability";
import { AVOIDABILITY_COLORS } from "./lib/colors";
import type { CategoryLine } from "./lib/dataset";

const t = it.dashboard.avoidability;

type PeriodRow = ReturnType<typeof avoidabilityByPeriod>[number];

/** Tooltip del periodo: livelli dall'alto della pila, totale e indice. */
function PeriodTooltip({
  active,
  payload,
  buckets,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  buckets: AvoidabilityBucket[];
}) {
  const row = payload?.[0]?.payload as { row: PeriodRow } | undefined;
  if (!active || !row) return null;
  const { period, amounts, index } = row.row;
  const shown = [...buckets].reverse().filter((bucket) => amounts[bucket] > 0);
  const total = buckets.reduce((sum, bucket) => sum + Math.max(amounts[bucket], 0), 0);
  return (
    <div style={tooltipStyle} className="min-w-44 px-3 py-2 shadow-md">
      <p className="mb-1.5 font-medium">{formatPeriodKey(period)}</p>
      <ul className="flex flex-col gap-1">
        {shown.map((bucket) => (
          <li key={bucket} className="flex items-center gap-2">
            <Swatch bucket={bucket} />
            <span className="flex-1">{bucketLabel(bucket)}</span>
            <span className="tabular-nums">{formatCurrency(amounts[bucket])}</span>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex justify-between gap-4 border-t pt-1.5">
        <span className="text-muted-foreground">{t.total}</span>
        <span className="font-medium tabular-nums">{formatCurrency(total)}</span>
      </div>
      {index !== null && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{t.index}</span>
          <span className="font-medium tabular-nums">
            {formatNumber(Math.round(index), 0)} {t.indexLabel}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Barre impilate per periodo: essenziale, utile, superfluo e non classificato. Passando sopra
 * a un periodo o a un livello il resto si attenua; un clic su un segmento apre gli acquisti di
 * quel livello in quel periodo, un clic sulla legenda quelli del livello in tutto l'intervallo.
 */
export function AvoidabilityByPeriod({
  lines,
  granularity,
  keys,
  className,
}: {
  lines: CategoryLine[];
  granularity: "month" | "year";
  keys: string[] | null;
  className?: string;
}) {
  const [selected, setSelected] = useState<{
    bucket: AvoidabilityBucket;
    period: string | null;
  } | null>(null);
  const [hoverPeriod, setHoverPeriod] = useState<number | null>(null);
  const [hoverBucket, setHoverBucket] = useState<AvoidabilityBucket | null>(null);
  const rows = avoidabilityByPeriod(lines, granularity, keys);
  const buckets = AVOIDABILITY_BUCKETS.filter((bucket) =>
    rows.some((row) => row.amounts[bucket] > 0),
  );
  const data = rows.map((row) => ({
    period: row.period,
    row,
    ...Object.fromEntries(buckets.map((bucket) => [bucket, Math.max(row.amounts[bucket], 0)])),
  }));
  const totals = Object.fromEntries(
    buckets.map((bucket) => [
      bucket,
      rows.reduce((sum, row) => sum + Math.max(row.amounts[bucket], 0), 0),
    ]),
  ) as Record<AvoidabilityBucket, number>;
  const top = buckets.at(-1);
  const active =
    selected &&
    buckets.includes(selected.bucket) &&
    (selected.period === null || rows.some((row) => row.period === selected.period))
      ? selected
      : null;
  const title = t.byPeriodTitle[granularity];

  return (
    <ChartCard
      id="avoidability-by-period"
      title={title}
      description={
        active
          ? t.purchasesOf(
              bucketLabel(active.bucket),
              active.period && formatPeriodKey(active.period),
            )
          : t.byPeriodDescription
      }
      className={className}
      table={
        rows.length > 0 && (
          <DataTable
            caption={title}
            headers={[it.dashboard.periodColumn[granularity], ...buckets.map(bucketLabel), t.index]}
            rows={rows.map((row) => ({
              key: row.period,
              cells: [
                formatPeriodKey(row.period),
                ...buckets.map((bucket) => formatCurrency(row.amounts[bucket])),
                row.index === null ? "–" : formatNumber(Math.round(row.index), 0),
              ],
            }))}
          />
        )
      }
    >
      {active ? (
        <LineDrill
          lines={avoidabilityLines(lines, active.bucket, active.period)}
          color={AVOIDABILITY_COLORS[active.bucket]}
          backLabel={t.back}
          onBack={() => setSelected(null)}
          testId="avoidability-period-purchases-total"
        />
      ) : buckets.length === 0 ? (
        <NoData>{it.dashboard.noData}</NoData>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-wrap gap-1 text-xs" data-testid="avoidability-period-legend">
            {buckets.map((bucket) => (
              <li key={bucket}>
                <button
                  type="button"
                  onClick={() => setSelected({ bucket, period: null })}
                  onMouseEnter={() => setHoverBucket(bucket)}
                  onMouseLeave={() => setHoverBucket(null)}
                  onFocus={() => setHoverBucket(bucket)}
                  onBlur={() => setHoverBucket(null)}
                  className={cn(
                    LEVEL_BUTTON,
                    "flex min-h-9 items-center gap-1.5 border px-2.5 transition-opacity",
                    hoverBucket && hoverBucket !== bucket && "opacity-50",
                  )}
                >
                  <Swatch bucket={bucket} />
                  <span>{bucketLabel(bucket)}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatCompactCurrency(totals[bucket])}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="h-64 w-full" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                accessibilityLayer={false}
                onMouseMove={(state) =>
                  setHoverPeriod(
                    state.activeTooltipIndex == null ? null : Number(state.activeTooltipIndex),
                  )
                }
                onMouseLeave={() => setHoverPeriod(null)}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
                <XAxis
                  dataKey="period"
                  tickFormatter={(value: string) => formatPeriodKey(value, "short")}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  minTickGap={8}
                />
                <YAxis
                  tickFormatter={formatCompactCurrency}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <Tooltip
                  cursor={false}
                  content={(props) => <PeriodTooltip {...props} buckets={buckets} />}
                  wrapperStyle={{ outline: "none" }}
                />
                {buckets.map((bucket) => (
                  <Bar
                    key={bucket}
                    dataKey={bucket}
                    stackId="avoidability"
                    fill={AVOIDABILITY_COLORS[bucket]}
                    // Spazio di 2px tra i segmenti impilati, del colore della card.
                    stroke="var(--card)"
                    strokeWidth={2}
                    radius={bucket === top ? [4, 4, 0, 0] : 0}
                    maxBarSize={40}
                    isAnimationActive={false}
                    className="cursor-pointer"
                    onClick={(_, index) => {
                      const period = data[index]?.period;
                      if (period) setSelected({ bucket, period });
                    }}
                  >
                    {data.map((entry, index) => {
                      const dimmed =
                        (hoverPeriod !== null && hoverPeriod !== index) ||
                        (hoverBucket !== null && hoverBucket !== bucket);
                      return (
                        <Cell
                          key={entry.period}
                          fillOpacity={bucketOpacity(bucket) * (dimmed ? DIMMED : 1)}
                          style={{ transition: "fill-opacity 150ms" }}
                        />
                      );
                    })}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-muted-foreground text-xs">{t.byPeriodHint}</p>
        </div>
      )}
    </ChartCard>
  );
}
