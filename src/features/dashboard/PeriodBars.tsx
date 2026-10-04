"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { components } from "@/lib/api/schema";
import { formatCompactNumber, formatCurrency, formatNumber, formatPeriodKey } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { ChartCard, DataTable } from "./ChartCard";

type Stats = components["schemas"]["Stats"];

const t = it.dashboard;

/** Periodi del grafico con i totali, compresi quelli senza spese (se `keys` è dato). */
export function toBarsData(rows: Stats["byPeriod"], keys: string[] | null) {
  const byKey = new Map(rows.map((row) => [row.period, row]));
  return (keys ?? rows.map((row) => row.period)).map((period) => ({
    period,
    total: byKey.get(period)?.total ?? 0,
    nReceipts: byKey.get(period)?.nReceipts ?? 0,
  }));
}

type PeriodBarsProps = {
  rows: Stats["byPeriod"];
  granularity: Stats["granularity"];
  keys: string[] | null;
};

/** Barre della spesa per mese (o per anno sui periodi lunghi). */
export function PeriodBars({ rows, granularity, keys }: PeriodBarsProps) {
  const data = toBarsData(rows, keys);
  return (
    <ChartCard
      id="by-period"
      title={t.byPeriodTitle[granularity]}
      description={t.byPeriodDescription}
      className="lg:col-span-2"
      table={
        data.length > 0 && (
          <DataTable
            caption={t.byPeriodTitle[granularity]}
            headers={[t.periodColumn[granularity], t.amount, t.count]}
            rows={data.map((row) => ({
              key: row.period,
              cells: [
                formatPeriodKey(row.period),
                formatCurrency(row.total),
                formatNumber(row.nReceipts, 0),
              ],
            }))}
          />
        )
      }
    >
      {data.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">{t.noData}</p>
      ) : (
        <div className="h-64 w-full" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="period"
                tickFormatter={(value: string) => formatPeriodKey(value, "short")}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                minTickGap={8}
              />
              <YAxis
                tickFormatter={formatCompactNumber}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                labelFormatter={(label) => formatPeriodKey(String(label))}
                formatter={(value) => [formatCurrency(Number(value)), t.amount]}
                contentStyle={{
                  background: "var(--popover)",
                  color: "var(--popover-foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="total"
                // Inchiostro: contrasto ≥ 3:1 con lo sfondo della card in entrambi i temi.
                fill="var(--chart-2)"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
