"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { formatCompactCurrency, formatCurrency, formatNumber } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { axisTick, ChartCard, DataTable, NoData, tooltipStyle } from "./ChartCard";
import { categoryColor } from "./lib/colors";
import type { ProductStats } from "./lib/products";
import { formatUnitPrice } from "./ProductRankings";

const t = it.dashboard;

type Point = {
  label: string;
  purchases: number;
  price: number;
  total: number;
  unit: string;
  color: string;
};

function PointTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div style={tooltipStyle} className="flex flex-col gap-0.5 px-3 py-2">
      <span className="font-medium">{point.label}</span>
      <span>
        {t.frequency.x}: {formatNumber(point.purchases, 0)}
      </span>
      <span>
        {t.frequency.y}: {formatUnitPrice(point.price, point.unit)}
      </span>
      <span>
        {t.frequency.z}: {formatCurrency(point.total)}
      </span>
    </div>
  );
}

/** Frequenza d'acquisto × prezzo medio; l'area del punto è la spesa totale. */
export function FrequencyChart({ products }: { products: ProductStats[] }) {
  // Prezzi al pezzo e al kg non stanno sullo stesso asse: solo l'unità più comune.
  const recurring = products.filter((p) => p.purchases >= 2);
  const kg = recurring.filter((p) => p.unit === "kg").length;
  const unit = kg > recurring.length - kg ? "kg" : "pz";
  const points: Point[] = recurring
    .filter((p) => p.unit === unit)
    .map((p) => ({
      label: p.label,
      purchases: p.purchases,
      price: p.averagePrice,
      total: p.totalSpent,
      unit: p.unit,
      color: categoryColor(p.category),
    }));
  return (
    <ChartCard
      id="frequency"
      title={t.frequency.title}
      description={t.frequency.description}
      table={
        points.length > 0 && (
          <DataTable
            caption={t.frequency.title}
            headers={[t.product, t.frequency.x, t.frequency.y, t.frequency.z]}
            rows={[...points]
              .sort((a, b) => b.total - a.total)
              .map((p) => ({
                key: p.label,
                cells: [
                  p.label,
                  formatNumber(p.purchases, 0),
                  formatUnitPrice(p.price, p.unit),
                  formatCurrency(p.total),
                ],
              }))}
          />
        )
      }
    >
      {points.length === 0 ? (
        <NoData>{t.frequency.none}</NoData>
      ) : (
        <div className="h-64 w-full" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
              accessibilityLayer={false}
            >
              <CartesianGrid stroke="var(--border)" />
              <XAxis
                type="number"
                dataKey="purchases"
                name={t.frequency.x}
                allowDecimals={false}
                tick={axisTick}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                domain={[0, "dataMax + 1"]}
                label={{ value: t.frequency.x, position: "insideBottom", offset: -8, ...axisTick }}
              />
              <YAxis
                type="number"
                dataKey="price"
                name={t.frequency.y}
                tickFormatter={formatCompactCurrency}
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                width={56}
                // Spazio sopra il punto più alto: le bolle grandi non escono dal grafico.
                domain={[0, (max: number) => Math.ceil(max * 1.2)]}
              />
              <ZAxis type="number" dataKey="total" range={[60, 600]} name={t.frequency.z} />
              <Tooltip content={<PointTooltip />} cursor={{ stroke: "var(--border)" }} />
              <Scatter
                data={points}
                isAnimationActive={false}
                shape={(props: { cx?: number; cy?: number; size?: number; payload?: Point }) => (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={Math.sqrt((props.size ?? 64) / Math.PI)}
                    fill={props.payload?.color}
                    fillOpacity={0.75}
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                )}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
