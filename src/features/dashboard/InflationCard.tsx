"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency, formatPercentChange } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { AnimatedNumber } from "./AnimatedNumber";
import { ChartCard, DataTable, NoData } from "./ChartCard";
import { INCREASE, SAVING } from "./lib/colors";
import { personalInflation, type PersonalInflation } from "./lib/insights";
import type { ProductStats } from "./lib/products";

const t = it.dashboard.inflation;

/** Scala del quadrante: ±10% riempie metà arco. */
const GAUGE_RANGE = 10;

/** Quadrante a semicerchio: lo zero in alto, a destra i rincari, a sinistra i ribassi. */
function Gauge({ rate }: { rate: number }) {
  const clamped = Math.max(-GAUGE_RANGE, Math.min(GAUGE_RANGE, rate));
  const angle = (clamped / GAUGE_RANGE) * 90;
  const color = rate > 0.05 ? INCREASE : rate < -0.05 ? SAVING : "var(--muted-foreground)";
  // Arco da 0° (cima) all'angolo, raggio 80 con centro (100, 100).
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const point = (deg: number) => [100 + 80 * Math.cos(rad(deg)), 100 + 80 * Math.sin(rad(deg))];
  const [ex, ey] = point(angle);
  return (
    <svg viewBox="0 0 200 112" className="w-full max-w-60" aria-hidden>
      <path
        d="M20,100 A80,80 0 0 1 180,100"
        fill="none"
        stroke="var(--muted)"
        strokeWidth={14}
        strokeLinecap="round"
      />
      {Math.abs(angle) > 0.5 && (
        <path
          d={`M100,20 A80,80 0 0 ${angle > 0 ? 1 : 0} ${ex},${ey}`}
          fill="none"
          stroke={color}
          strokeWidth={14}
          strokeLinecap="round"
          className="dash-gauge"
        />
      )}
      <line x1={100} y1={12} x2={100} y2={28} stroke="var(--border)" strokeWidth={2} />
      <circle cx={ex} cy={ey} r={9} fill="var(--card)" stroke={color} strokeWidth={4} />
    </svg>
  );
}

function MoverList({
  title,
  items,
  up,
}: {
  title: string;
  items: PersonalInflation["risers"];
  up: boolean;
}) {
  if (items.length === 0) return null;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h4 className="text-muted-foreground text-xs font-medium">{title}</h4>
      <ul className="flex flex-col gap-1.5 text-sm">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2">
            <Icon
              className="size-4 shrink-0"
              style={{ color: up ? INCREASE : SAVING }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="font-medium tabular-nums" style={{ color: up ? INCREASE : SAVING }}>
              {formatPercentChange(item.priceChange)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Inflazione personale: la variazione media dei prezzi di ciò che compri davvero, pesata su
 * quanto spendi per ogni prodotto, con i rincari e i ribassi più forti.
 */
export function InflationCard({ products }: { products: ProductStats[] }) {
  const inflation = personalInflation(products);
  return (
    <ChartCard
      id="inflation"
      title={t.title}
      description={t.description}
      table={
        inflation && (
          <DataTable
            caption={t.title}
            headers={[it.dashboard.product, it.dashboard.priceChanges.change]}
            rows={[...inflation.risers, ...inflation.fallers].map((item) => ({
              key: item.key,
              cells: [item.label, formatPercentChange(item.priceChange)],
            }))}
          />
        )
      }
    >
      {!inflation ? (
        <NoData>{t.none}</NoData>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center">
            <Gauge rate={inflation.rate} />
            <p
              className="-mt-10 text-4xl font-bold tabular-nums"
              style={{
                color:
                  inflation.rate > 0.05 ? INCREASE : inflation.rate < -0.05 ? SAVING : undefined,
              }}
              data-testid="inflation-rate"
            >
              <AnimatedNumber value={inflation.rate} format={formatPercentChange} />
            </p>
            <p className="text-muted-foreground text-center text-sm">
              {Math.abs(inflation.rate) < 0.05 ? `${t.stable} · ` : ""}
              {t.tracked(inflation.tracked)} · {t.up(inflation.up)} · {t.down(inflation.down)}
            </p>
            {Math.abs(inflation.impact) >= 0.01 && (
              <p className="mt-1 text-center text-sm">
                {t.impact(formatCurrency(Math.abs(inflation.impact)))}{" "}
                <span
                  className="font-medium"
                  style={{ color: inflation.impact > 0 ? INCREASE : SAVING }}
                >
                  {inflation.impact > 0 ? t.impactMore : t.impactLess}
                </span>
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <MoverList title={t.risers} items={inflation.risers} up />
            <MoverList title={t.fallers} items={inflation.fallers} up={false} />
          </div>
        </div>
      )}
    </ChartCard>
  );
}
