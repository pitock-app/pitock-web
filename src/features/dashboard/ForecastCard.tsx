"use client";

import { Info, TrendingDown, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { formatCompactCurrency, formatCurrency, formatPercentChange } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";
import { axisTick, tooltipStyle } from "./ChartCard";
import { INCREASE, SAVING } from "./lib/colors";
import type { MonthForecast } from "./lib/forecast";

const t = it.dashboard.forecast;

function reliabilityNote(forecast: MonthForecast): string | null {
  if (forecast.reliability === "good") return null;
  if (forecast.historyMonths === 0) return t.reasonNoHistory;
  if (forecast.dayOfMonth < 10) return t.reasonEarly(forecast.historyMonths);
  return t.reasonShortHistory(forecast.historyMonths);
}

/** Confronto della previsione con un riferimento: importo e variazione, rossa se è di più. */
function Comparison({
  label,
  hint,
  reference,
  projected,
}: {
  label: string;
  hint: string;
  reference: number | null;
  projected: number;
}) {
  const change = reference && reference > 0 ? ((projected - reference) / reference) * 100 : null;
  const up = change !== null && change > 0;
  const Icon = change === null || Math.abs(change) < 0.05 ? null : up ? TrendingUp : TrendingDown;
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium">
        {reference === null ? t.noComparison : formatCurrency(reference)}
      </dd>
      {change !== null && (
        <dd
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: Icon ? (up ? INCREASE : SAVING) : undefined }}
        >
          {Icon && <Icon className="size-3.5" aria-hidden />}
          {formatPercentChange(change)}{" "}
          <span className="text-muted-foreground font-normal">{hint}</span>
        </dd>
      )}
    </div>
  );
}

type ForecastCardProps = {
  forecast: MonthForecast;
  /** Vero se negozio o categoria filtrano la previsione. */
  filtered: boolean;
  className?: string;
};

/** Previsione della spesa del mese in corso, con confronti e mini grafico della proiezione. */
export function ForecastCard({ forecast, filtered, className }: ForecastCardProps) {
  const note = reliabilityNote(forecast);
  const weight = Math.round(forecast.currentWeight * 100);
  return (
    <section
      aria-labelledby="forecast-title"
      className={cn("bg-card flex min-w-0 flex-col gap-4 rounded-xl border p-4", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="forecast-title" className="font-semibold">
            {t.title}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t.dayOf(forecast.dayOfMonth, forecast.daysInMonth)}
          </p>
        </div>
        {note && (
          <Badge variant="secondary" className="gap-1" data-testid="forecast-indicative">
            <Info className="size-3" aria-hidden />
            {t.indicative}
          </Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <dt className="text-muted-foreground text-sm">{t.spent}</dt>
          <dd className="text-2xl font-semibold" data-testid="forecast-spent">
            {formatCurrency(forecast.spent)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground text-sm">{t.projected}</dt>
          <dd className="text-2xl font-semibold" data-testid="forecast-projected">
            {note ? "≈ " : ""}
            {formatCurrency(forecast.projected)}
          </dd>
        </div>
        <Comparison
          label={t.averageOf(forecast.averageMonths)}
          hint={t.vsAverage}
          reference={forecast.averageMonthTotal}
          projected={forecast.projected}
        />
        <Comparison
          label={t.previousMonth}
          hint={t.vsPrevious}
          reference={forecast.previousMonthTotal}
          projected={forecast.projected}
        />
      </dl>

      <figure className="flex flex-col gap-2">
        <div className="h-40 w-full" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={forecast.series}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              accessibilityLayer={false}
            >
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="day"
                tick={axisTick}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                tickFormatter={formatCompactCurrency}
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(day) => t.day(Number(day))}
                formatter={(value, name) => [
                  formatCurrency(Number(value)),
                  name === "actual" ? t.actual : t.projection,
                ]}
              />
              {forecast.averageMonthTotal !== null && (
                <ReferenceLine
                  y={forecast.averageMonthTotal}
                  ifOverflow="extendDomain"
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.6}
                />
              )}
              <Line
                dataKey="actual"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
              <Line
                dataKey="projected"
                stroke="var(--chart-1)"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <figcaption className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-[var(--chart-1)]" aria-hidden />
            {t.actual}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-[var(--chart-1)]" aria-hidden />
            {t.projection}
          </span>
          {forecast.averageMonthTotal !== null && (
            <span className="flex items-center gap-1.5">
              <span className="bg-muted-foreground/60 h-px w-4" aria-hidden />
              {t.average}
            </span>
          )}
        </figcaption>
      </figure>

      <div className="text-muted-foreground flex flex-col gap-1 text-xs">
        {note && <p>{note}</p>}
        <p>{t.method(formatCurrency(forecast.dailyRate), weight)}</p>
        {forecast.pendingRecurring.length > 0 && (
          <p>
            {t.pendingRecurring}:{" "}
            {forecast.pendingRecurring
              .map((spend) => `${spend.merchant} ${formatCurrency(spend.amount)}`)
              .join(", ")}
          </p>
        )}
        {filtered && <p>{t.filtered}</p>}
      </div>
    </section>
  );
}
