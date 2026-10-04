"use client";

import { useId, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Input } from "@/components/ui/input";
import { formatCompactCurrency, formatDate, formatShortDay } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { axisTick, ChartCard, DataTable, NoData, tooltipStyle } from "./ChartCard";
import { priceHistory, type ProductStats, type Purchase } from "./lib/products";
import { formatUnitPrice } from "./ProductRankings";

const t = it.dashboard;

const selectClass =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full min-w-0 rounded-lg border px-3 text-sm outline-none focus-visible:ring-[3px]";

type PriceHistoryProps = {
  products: ProductStats[];
  purchases: Purchase[];
  colorOf(store: string | null): string;
};

/** Andamento del prezzo di un prodotto scelto, una linea per negozio. */
export function PriceHistory({ products, purchases, colorOf }: PriceHistoryProps) {
  const searchId = useId();
  const selectId = useId();
  const [search, setSearch] = useState("");
  // I prodotti comprati più spesso in cima: sono quelli con un andamento da vedere.
  const candidates = useMemo(
    () =>
      products
        .filter((p) => p.days >= 2)
        .sort((a, b) => b.days - a.days || b.totalSpent - a.totalSpent),
    [products],
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const needle = search.trim().toLowerCase();
  const matches = needle
    ? candidates.filter((p) => p.label.toLowerCase().includes(needle))
    : candidates;
  const selected =
    candidates.find((p) => p.key === selectedKey && matches.includes(p)) ?? matches[0] ?? null;

  const points = selected ? priceHistory(purchases, selected.key, selected.unit) : [];
  const stores = [...new Set(points.map((p) => p.merchant ?? t.unknownStore))];
  const data = [...new Set(points.map((p) => p.day))].map((day) => ({
    day,
    ...Object.fromEntries(
      points.filter((p) => p.day === day).map((p) => [p.merchant ?? t.unknownStore, p.price]),
    ),
  }));

  const controls = candidates.length > 0 && (
    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <label htmlFor={searchId} className="text-muted-foreground text-xs">
          {t.priceHistory.search}
        </label>
        <Input
          id={searchId}
          type="search"
          className="h-11"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={selectId} className="text-muted-foreground text-xs">
          {t.priceHistory.select}
        </label>
        <select
          id={selectId}
          className={selectClass}
          value={selected?.key ?? ""}
          onChange={(event) => setSelectedKey(event.target.value)}
          disabled={matches.length === 0}
        >
          {matches.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label} ({t.purchases(p.purchases)})
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <ChartCard
      id="price-history"
      title={t.priceHistory.title}
      description={t.priceHistory.description}
      className="lg:col-span-2"
      actions={controls}
      table={
        points.length > 0 && (
          <DataTable
            caption={`${t.priceHistory.title}: ${selected?.label}`}
            headers={[t.priceHistory.date, t.store, t.price]}
            rows={points.map((p) => ({
              key: `${p.day}|${p.merchant}`,
              cells: [
                formatDate(`${p.day}T12:00:00Z`),
                p.merchant ?? t.unknownStore,
                formatUnitPrice(p.price, selected!.unit),
              ],
            }))}
          />
        )
      }
    >
      {candidates.length === 0 ? (
        <NoData>{t.priceHistory.none}</NoData>
      ) : !selected ? (
        <NoData>{t.noData}</NoData>
      ) : (
        <>
          <div className="h-64 w-full" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                accessibilityLayer={false}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="day"
                  tickFormatter={formatShortDay}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  minTickGap={16}
                />
                <YAxis
                  tickFormatter={formatCompactCurrency}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(day) => formatDate(`${day}T12:00:00Z`)}
                  formatter={(value, name) => [
                    formatUnitPrice(Number(value), selected.unit),
                    String(name),
                  ]}
                />
                {stores.map((store) => {
                  const color = colorOf(store === t.unknownStore ? null : store);
                  return (
                    <Line
                      key={store}
                      dataKey={store}
                      name={store}
                      stroke={color}
                      strokeWidth={2}
                      dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: color }}
                      activeDot={{ r: 6, fill: color, stroke: "var(--card)" }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {stores.map((store) => (
              <li key={store} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ background: colorOf(store === t.unknownStore ? null : store) }}
                  aria-hidden
                />
                {store}
              </li>
            ))}
          </ul>
        </>
      )}
    </ChartCard>
  );
}
