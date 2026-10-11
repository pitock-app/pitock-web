"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPeriodKey,
  formatShare,
} from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { BarList } from "./BarList";
import { axisTick, ChartCard, DataTable, NoData, shareOf, tooltipStyle } from "./ChartCard";
import {
  AVOIDABILITY_BUCKETS,
  avoidabilityByCategory,
  avoidabilityByPeriod,
  type AvoidabilityBucket,
  type AvoidabilityTotals,
  topSuperfluous,
} from "./lib/avoidability";
import { AVOIDABILITY_COLORS, categoryColor, UNCLASSIFIED_OPACITY } from "./lib/colors";
import type { CategoryLine } from "./lib/dataset";

const t = it.dashboard.avoidability;

const bucketLabel = (bucket: AvoidabilityBucket) =>
  bucket === "unclassified" ? t.unclassified : it.avoidability[bucket];
const bucketOpacity = (bucket: AvoidabilityBucket) =>
  bucket === "unclassified" ? UNCLASSIFIED_OPACITY : 1;

function Swatch({ bucket }: { bucket: AvoidabilityBucket }) {
  return (
    <span
      className="size-3 shrink-0 rounded-sm"
      style={{ background: AVOIDABILITY_COLORS[bucket], opacity: bucketOpacity(bucket) }}
      aria-hidden
    />
  );
}

/** Legenda dei livelli, sempre visibile sopra o accanto al grafico. */
function Legend({ buckets }: { buckets: AvoidabilityBucket[] }) {
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {buckets.map((bucket) => (
        <li key={bucket} className="flex items-center gap-1.5">
          <Swatch bucket={bucket} />
          {bucketLabel(bucket)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Indice del periodo con la spesa divisa per livello: numero in evidenza, barra al 100% e
 * importi. La spesa non classificata resta fuori dall'indice ed è segnalata a parte.
 */
export function AvoidabilityOverview({
  totals,
  className,
}: {
  totals: AvoidabilityTotals;
  className?: string;
}) {
  const { amounts, index } = totals;
  const all = AVOIDABILITY_BUCKETS.reduce((sum, bucket) => sum + Math.max(amounts[bucket], 0), 0);
  const buckets = AVOIDABILITY_BUCKETS.filter((bucket) => amounts[bucket] > 0);
  return (
    <ChartCard
      id="avoidability"
      title={t.title}
      description={t.description}
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
      {index === null ? (
        <NoData>{t.none}</NoData>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-4xl font-semibold tabular-nums" data-testid="avoidability-index">
              {formatNumber(Math.round(index), 0)}
              <span className="text-muted-foreground ml-1 text-base font-normal">
                {t.indexLabel}
              </span>
            </p>
            <p className="text-muted-foreground text-sm" data-testid="avoidability-avoidable">
              {t.avoidable(formatCurrency(totals.avoidable))}
            </p>
          </div>
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {buckets.map((bucket) => (
              <div
                key={bucket}
                className="h-full first:rounded-l-full last:rounded-r-full"
                title={`${bucketLabel(bucket)}: ${formatCurrency(amounts[bucket])}`}
                style={{
                  width: `${shareOf(amounts[bucket], all)}%`,
                  background: AVOIDABILITY_COLORS[bucket],
                  opacity: bucketOpacity(bucket),
                }}
              />
            ))}
          </div>
          <ul className="flex flex-col text-sm" data-testid="avoidability-legend">
            {buckets.map((bucket) => (
              <li key={bucket} className="flex min-h-8 items-center gap-2">
                <Swatch bucket={bucket} />
                <span className="min-w-0 flex-1 truncate">{bucketLabel(bucket)}</span>
                <span className="tabular-nums">{formatCurrency(amounts[bucket])}</span>
                <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
                  {formatShare(shareOf(amounts[bucket], all))}
                </span>
              </li>
            ))}
          </ul>
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

/** Barre impilate per periodo: essenziale, utile, superfluo e non classificato. */
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
  const rows = avoidabilityByPeriod(lines, granularity, keys);
  const buckets = AVOIDABILITY_BUCKETS.filter((bucket) =>
    rows.some((row) => row.amounts[bucket] > 0),
  );
  const data = rows.map((row) => ({
    period: row.period,
    ...Object.fromEntries(buckets.map((bucket) => [bucket, Math.max(row.amounts[bucket], 0)])),
  }));
  const top = buckets.at(-1);
  return (
    <ChartCard
      id="avoidability-by-period"
      title={t.byPeriodTitle[granularity]}
      description={t.byPeriodDescription}
      className={className}
      table={
        rows.length > 0 && (
          <DataTable
            caption={t.byPeriodTitle[granularity]}
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
      {buckets.length === 0 ? (
        <NoData>{it.dashboard.noData}</NoData>
      ) : (
        <>
          <Legend buckets={buckets} />
          <div className="h-64 w-full" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                accessibilityLayer={false}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" />
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
                  cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                  labelFormatter={(label) => formatPeriodKey(String(label))}
                  formatter={(value, name) => [
                    formatCurrency(Number(value)),
                    bucketLabel(name as AvoidabilityBucket),
                  ]}
                  contentStyle={tooltipStyle}
                />
                {buckets.map((bucket) => (
                  <Bar
                    key={bucket}
                    dataKey={bucket}
                    stackId="avoidability"
                    fill={AVOIDABILITY_COLORS[bucket]}
                    fillOpacity={bucketOpacity(bucket)}
                    // Spazio di 2px tra i segmenti impilati, del colore della card.
                    stroke="var(--card)"
                    strokeWidth={2}
                    radius={bucket === top ? [4, 4, 0, 0] : 0}
                    maxBarSize={36}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </ChartCard>
  );
}

/** Indice per categoria, dalla più evitabile: la barra è l'indice, il colore la categoria. */
export function AvoidabilityByCategory({
  lines,
  className,
}: {
  lines: CategoryLine[];
  className?: string;
}) {
  const rows = avoidabilityByCategory(lines);
  return (
    <ChartCard
      id="avoidability-by-category"
      title={t.byCategoryTitle}
      description={t.byCategoryDescription}
      className={className}
      table={
        rows.length > 0 && (
          <DataTable
            caption={t.byCategoryTitle}
            headers={[
              it.dashboard.category,
              t.index,
              it.avoidability.superfluo,
              it.avoidability.utile,
              it.avoidability.essenziale,
            ]}
            rows={rows.map((row) => ({
              key: row.category,
              cells: [
                it.categories[row.category],
                formatNumber(Math.round(row.index), 0),
                formatCurrency(row.amounts.superfluo),
                formatCurrency(row.amounts.utile),
                formatCurrency(row.amounts.essenziale),
              ],
            }))}
          />
        )
      }
    >
      {rows.length === 0 ? (
        <NoData>{t.none}</NoData>
      ) : (
        <BarList
          rows={rows.map((row) => ({
            key: row.category,
            label: it.categories[row.category],
            value: row.index,
            valueLabel: formatNumber(Math.round(row.index), 0),
            color: categoryColor(row.category),
            detail: t.byCategoryDetail(
              formatCurrency(row.amounts.superfluo),
              formatCurrency(row.amounts.utile),
            ),
          }))}
        />
      )}
    </ChartCard>
  );
}

/** Prodotti superflui su cui si spende di più, con il link allo scontrino più recente. */
export function TopSuperfluous({
  lines,
  className,
}: {
  lines: CategoryLine[];
  className?: string;
}) {
  const rows = topSuperfluous(lines);
  return (
    <ChartCard
      id="avoidability-top"
      title={t.topTitle}
      description={t.topDescription}
      className={className}
      table={
        rows.length > 0 && (
          <DataTable
            caption={t.topTitle}
            headers={[it.dashboard.product, it.dashboard.amount, t.topCount]}
            rows={rows.map((row) => ({
              key: row.key,
              cells: [row.label, formatCurrency(row.total), formatNumber(row.count, 0)],
            }))}
          />
        )
      }
    >
      {rows.length === 0 ? (
        <NoData>{t.topNone}</NoData>
      ) : (
        <BarList
          rows={rows.map((row) => ({
            key: row.key,
            label: row.label,
            value: row.total,
            color: AVOIDABILITY_COLORS.superfluo,
            href: `/receipts/${row.receiptId}`,
            detail: t.topDetail(it.dashboard.purchases(row.count), formatDate(row.day)),
          }))}
        />
      )}
    </ChartCard>
  );
}
