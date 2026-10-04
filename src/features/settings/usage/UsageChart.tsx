"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { components } from "@/lib/api/schema";
import { formatCompactNumber, formatShortDay, formatTokens } from "@/lib/format";
import { it } from "@/lib/i18n/it";

type SeriesPoint = components["schemas"]["UsageSummary"]["series"][number];

const t = it.settings.usage;

/** Giorni del periodo con i totali, compresi quelli senza chiamate (se `days` è dato). */
export function toChartData(series: SeriesPoint[], days: string[] | null) {
  const byDay = new Map(series.map((point) => [point.key, point]));
  const keys = days ?? series.map((point) => point.key);
  return keys.map((day) => ({
    day,
    input: byDay.get(day)?.inputTokens ?? 0,
    output: byDay.get(day)?.outputTokens ?? 0,
  }));
}

/**
 * Barre impilate dei token per giorno: input e output. Colori del brand (inchiostro e ambra)
 * con legenda e tabella dei dati, così il colore non è l'unico modo di leggere il grafico.
 */
export function UsageChart({ series, days }: { series: SeriesPoint[]; days: string[] | null }) {
  const data = toChartData(series, days);
  const empty = series.length === 0;

  return (
    <section
      aria-labelledby="usage-chart-title"
      className="bg-card flex flex-col gap-3 rounded-xl border p-4"
    >
      <div>
        <h2 id="usage-chart-title" className="font-semibold">
          {t.chartTitle}
        </h2>
        <p className="text-muted-foreground text-sm">{t.chartDescription}</p>
      </div>
      {empty ? (
        <p className="text-muted-foreground py-10 text-center text-sm">{t.chartEmpty}</p>
      ) : (
        <>
          <div className="h-64 w-full" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="day"
                  tickFormatter={formatShortDay}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  minTickGap={16}
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
                  labelFormatter={(label) => formatShortDay(String(label))}
                  formatter={(value) => formatTokens(Number(value))}
                  contentStyle={{
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }} />
                <Bar
                  dataKey="input"
                  name={t.inputTokens}
                  stackId="tokens"
                  fill="var(--chart-2)"
                  stroke="var(--card)"
                  strokeWidth={1}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="output"
                  name={t.outputTokens}
                  stackId="tokens"
                  fill="var(--chart-1)"
                  stroke="var(--card)"
                  strokeWidth={1}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="text-sm">
            <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 min-h-11 cursor-pointer content-center rounded-sm outline-none focus-visible:ring-[3px]">
              {t.chartTable}
            </summary>
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{t.chartTitle}</caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      {t.day}
                    </th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">
                      {t.inputTokens}
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      {t.outputTokens}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data
                    .filter((row) => row.input + row.output > 0)
                    .map((row) => (
                      <tr key={row.day} className="border-b last:border-0">
                        <th scope="row" className="py-1.5 pr-4 font-normal">
                          {formatShortDay(row.day)}
                        </th>
                        <td className="py-1.5 pr-4 text-right tabular-nums">
                          {formatTokens(row.input)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {formatTokens(row.output)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
