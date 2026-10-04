import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercentChange,
  formatShare,
} from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { BarList } from "./BarList";
import { ChartCard, DataTable, NoData } from "./ChartCard";
import { categoryColor, INCREASE, SAVING } from "./lib/colors";
import { priceChanges, savingsRanking, type ProductStats } from "./lib/products";

const t = it.dashboard;

/** Prezzo unitario con l'unità: "1,49 €/pz", "1,79 €/kg". */
export function formatUnitPrice(value: number, unit: string) {
  return `${formatCurrency(value)}${t.perUnit[unit] ?? ""}`;
}

const dayLabel = (day: string) => formatDate(`${day}T12:00:00Z`);

/** Prodotti con la spesa più alta, nel colore della loro categoria. */
export function TopProducts({ products }: { products: ProductStats[] }) {
  return (
    <ChartCard
      id="top-products"
      title={t.topProducts.title}
      description={t.topProducts.description}
      table={
        products.length > 0 && (
          <DataTable
            caption={t.topProducts.title}
            headers={[t.product, t.amount, t.count, t.price]}
            rows={products.map((p) => ({
              key: p.key,
              cells: [
                p.label,
                formatCurrency(p.totalSpent),
                formatNumber(p.purchases, 0),
                formatUnitPrice(p.averagePrice, p.unit),
              ],
            }))}
          />
        )
      }
    >
      {products.length === 0 ? (
        <NoData>{t.noProducts}</NoData>
      ) : (
        <BarList
          rows={products.map((p) => ({
            key: p.key,
            label: p.label,
            value: p.totalSpent,
            color: categoryColor(p.category),
            detail: `${it.categories[p.category]} · ${t.purchases(p.purchases)} · ${formatUnitPrice(p.averagePrice, p.unit)}`,
          }))}
        />
      )}
    </ChartCard>
  );
}

/** Classifica dei prodotti dove si perde di più rispetto al miglior prezzo registrato. */
export function SavingsRanking({ products }: { products: ProductStats[] }) {
  const rows = savingsRanking(products);
  return (
    <ChartCard
      id="savings-ranking"
      title={t.savingsRanking.title}
      description={t.savingsRanking.description}
      table={
        rows.length > 0 && (
          <DataTable
            caption={t.savingsRanking.title}
            headers={[t.product, t.savings.title, t.price, t.store]}
            rows={rows.map((p) => ({
              key: p.key,
              cells: [
                p.label,
                formatCurrency(p.potentialSaving),
                formatUnitPrice(p.bestPrice, p.unit),
                p.bestMerchant ?? t.unknownStore,
              ],
            }))}
          />
        )
      }
    >
      {rows.length === 0 ? (
        <NoData>{t.savings.none}</NoData>
      ) : (
        <BarList
          rows={rows.map((p) => ({
            key: p.key,
            label: p.label,
            value: p.potentialSaving,
            color: SAVING,
            valueClassName: "text-[var(--saving)] font-medium",
            detail: t.savingsRanking.detail(
              formatUnitPrice(p.bestPrice, p.unit),
              p.bestMerchant ? ` ${it.dashboard.tips.at(p.bestMerchant).trim()}` : "",
            ),
          }))}
        />
      )}
    </ChartCard>
  );
}

/** Rincari (rosso) e ribassi (verde) tra il primo e l'ultimo acquisto del periodo. */
export function PriceChanges({ products }: { products: ProductStats[] }) {
  const rows = priceChanges(products);
  return (
    <ChartCard
      id="price-changes"
      title={t.priceChanges.title}
      description={t.priceChanges.description}
      table={
        rows.length > 0 && (
          <DataTable
            caption={t.priceChanges.title}
            headers={[t.product, t.priceChanges.change, t.price]}
            rows={rows.map((p) => ({
              key: p.key,
              cells: [
                p.label,
                formatPercentChange(p.priceChange),
                `${formatUnitPrice(p.firstPrice, p.unit)} → ${formatUnitPrice(p.lastPrice, p.unit)}`,
              ],
            }))}
          />
        )
      }
    >
      {rows.length === 0 ? (
        <NoData>{t.priceChanges.none}</NoData>
      ) : (
        <BarList
          rows={rows.map((p) => {
            const up = p.priceChange > 0;
            return {
              key: p.key,
              label: p.label,
              value: p.priceChange,
              valueLabel: formatPercentChange(p.priceChange),
              color: up ? INCREASE : SAVING,
              valueClassName: up
                ? "text-[var(--increase)] font-medium"
                : "text-[var(--saving)] font-medium",
              detail: t.priceChanges.detail(
                dayLabel(p.firstDay),
                dayLabel(p.lastDay),
                formatUnitPrice(p.firstPrice, p.unit),
                formatUnitPrice(p.lastPrice, p.unit),
              ),
            };
          })}
        />
      )}
    </ChartCard>
  );
}

/** Quota percentuale con un decimale ("18,5%"). */
export const formatGap = (gap: number) => formatShare(gap, gap < 10 ? 1 : 0);
