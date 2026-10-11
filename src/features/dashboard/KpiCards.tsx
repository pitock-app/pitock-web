"use client";

import { CalendarDays, Receipt, ReceiptText, Wallet } from "lucide-react";
import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency, formatDayRange, formatNumber, formatShortDay } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { addDays, daysBetween } from "@/lib/period";
import { AnimatedNumber } from "./AnimatedNumber";
import { tooltipStyle } from "./ChartCard";
import type { Summary } from "./lib/dataset";
import { weekdayOf } from "./lib/insights";

const t = it.dashboard;

type KpiCardsProps = {
  totals: Summary["totals"];
  /** Spesa per giorno (YYYY-MM-DD) del periodo. */
  daily: Map<string, number>;
  /** Primo e ultimo giorno trascorso del periodo; null se non si conoscono. */
  from: string | null;
  to: string | null;
};

/** Oltre due mesi la serie è per settimana: giorno per giorno sarebbe una fila di picchi. */
const WEEKLY_AFTER_DAYS = 62;

/**
 * Spesa da `from` a `to`, anche zero: per giorno o, sui periodi lunghi, per settimana
 * (`day` è il primo giorno della settimana nel periodo).
 */
function spendSeries(daily: Map<string, number>, from: string, to: string, weekly: boolean) {
  const series: { day: string; amount: number }[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const amount = daily.get(day) ?? 0;
    const last = series[series.length - 1];
    if (weekly && last && weekdayOf(day) !== 0) last.amount += amount;
    else series.push({ day, amount });
  }
  return series;
}

/**
 * Apertura della dashboard: il totale speso in grande, con l'andamento giorno per giorno, e le
 * altre misure del periodo (scontrini, scontrino medio, media al giorno).
 */
export function KpiCards({ totals, daily, from, to }: KpiCardsProps) {
  const gradientId = `hero-${useId().replace(/[^\w-]/g, "")}`;
  const days = from && to && from <= to ? daysBetween(from, to) : 0;
  const weekly = days > WEEKLY_AFTER_DAYS;
  const series = from && to && days > 1 ? spendSeries(daily, from, to, weekly) : [];
  const perDay = days > 0 ? totals.total / days : null;
  const items = [
    {
      id: "count",
      label: t.count,
      icon: ReceiptText,
      value: totals.nReceipts,
      format: (value: number) => formatNumber(Math.round(value), 0),
    },
    {
      id: "average",
      label: t.average,
      icon: Receipt,
      value: totals.average,
      format: formatCurrency,
    },
    ...(perDay !== null
      ? [
          {
            id: "per-day",
            label: t.hero.perDay,
            icon: CalendarDays,
            value: perDay,
            format: formatCurrency,
          },
        ]
      : []),
  ];

  return (
    <section
      aria-label={t.kpiLabel}
      className="dash-hero animate-in fade-in slide-in-from-bottom-2 relative isolate overflow-hidden rounded-2xl border p-5 duration-500 motion-reduce:animate-none sm:p-6"
    >
      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <dl className="min-w-0">
          <dt className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <Wallet className="text-brand size-4" aria-hidden />
            {t.total}
          </dt>
          <dd
            className="dash-hero-total mt-1 text-4xl font-bold tracking-tight break-words tabular-nums sm:text-5xl lg:text-6xl"
            data-testid="dashboard-kpi-total"
          >
            <AnimatedNumber value={totals.total} format={formatCurrency} />
          </dd>
          {from && to && (
            <dd className="text-muted-foreground mt-2 text-sm">
              {formatDayRange(from, to)} · {t.hero.activeDays(daily.size)}
            </dd>
          )}
        </dl>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:min-w-[28rem]">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-background/60 min-w-0 rounded-xl border p-3 backdrop-blur-sm"
            >
              <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <item.icon className="size-3.5" aria-hidden />
                {item.label}
              </dt>
              <dd
                className="mt-1 text-lg font-semibold break-words tabular-nums sm:text-xl"
                data-testid={`dashboard-kpi-${item.id}`}
              >
                <AnimatedNumber value={item.value} format={item.format} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {series.length > 1 && (
        <div className="relative z-10 -mx-5 mt-4 -mb-5 h-24 sm:-mx-6 sm:-mb-6" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={series}
              margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
              accessibilityLayer={false}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ stroke: "var(--chart-1)", strokeOpacity: 0.4 }}
                labelFormatter={(_, payload) =>
                  payload?.[0]
                    ? weekly
                      ? t.hero.weekOf(formatShortDay(String(payload[0].payload.day)))
                      : formatShortDay(String(payload[0].payload.day))
                    : ""
                }
                formatter={(value) => [formatCurrency(Number(value)), t.amount]}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
