"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, DataTable, NEUTRAL, SERIES, tooltipStyle } from "@/features/dashboard";
import { formatCompactCurrency, formatCurrency, formatPeriodKey } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import type { ChatChart as Chart } from "./store";

const t = it.chat;
const MONTH = /^\d{4}-\d{2}$/;
/** Fette con colore proprio; le altre diventano "Altri". */
const PIE_SLICES = 5;

const label = (value: string) => (MONTH.test(value) ? formatPeriodKey(value, "short") : value);

/** Fette della torta: le prime 5 più "Altri" (somma solo per il disegno, non mostrata come dato). */
export function pieSlices(points: Chart["points"]) {
  const sorted = [...points].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, PIE_SLICES).map((p, i) => ({ ...p, color: SERIES[i] ?? NEUTRAL }));
  const rest = sorted.slice(PIE_SLICES).reduce((sum, p) => sum + p.value, 0);
  return rest > 0 ? [...head, { label: t.others, value: rest, color: NEUTRAL }] : head;
}

const tooltip = (
  <Tooltip
    formatter={(value) => [formatCurrency(Number(value)), t.amount]}
    labelFormatter={(value) => label(String(value))}
    contentStyle={tooltipStyle}
  />
);

function Plot({ chart }: { chart: Chart }) {
  const data = chart.points.map((p) => ({ ...p, label: label(p.label) }));
  if (chart.type === "pie") {
    const slices = pieSlices(chart.points);
    return (
      <PieChart accessibilityLayer={false}>
        <Pie data={slices} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="100%">
          {slices.map((s) => (
            <Cell key={s.label} fill={s.color} />
          ))}
        </Pie>
        {tooltip}
      </PieChart>
    );
  }
  if (chart.type === "line") {
    return (
      <LineChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        accessibilityLayer={false}
      >
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <YAxis
          tickFormatter={formatCompactCurrency}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        {tooltip}
        <Line dataKey="value" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    );
  }
  return (
    <BarChart
      data={data}
      layout="vertical"
      margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
      accessibilityLayer={false}
    >
      <XAxis type="number" hide />
      <YAxis
        type="category"
        dataKey="label"
        tick={axisTick}
        tickLine={false}
        axisLine={false}
        width={110}
      />
      {tooltip}
      <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
    </BarChart>
  );
}

/** Grafico deciso dall'assistente; i valori sono anche in una tabella apribile, per chi non vede il grafico. */
export function ChatChart({ chart }: { chart: Chart }) {
  const height = chart.type === "bar" ? Math.min(40 + chart.points.length * 28, 320) : 200;
  return (
    <figure className="bg-card flex flex-col gap-2 rounded-lg border p-3">
      <figcaption className="text-sm font-medium">{chart.title}</figcaption>
      <div style={{ height }} className="w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <Plot chart={chart} />
        </ResponsiveContainer>
      </div>
      <details className="text-xs">
        <summary className="text-muted-foreground cursor-pointer">{t.showData}</summary>
        <DataTable
          caption={chart.title}
          headers={[t.item, t.amount]}
          rows={chart.points.map((p) => ({
            key: p.label,
            cells: [label(p.label), formatCurrency(p.value)],
          }))}
        />
      </details>
    </figure>
  );
}
