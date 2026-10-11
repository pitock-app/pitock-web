"use client";

import { ChartNoAxesCombined, Package, Scale, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { daysBetween } from "@/lib/period";
import { it } from "@/lib/i18n/it";
import { AvoidabilityByPeriod } from "./AvoidabilityByPeriod";
import { AvoidabilityOverview } from "./AvoidabilityOverview";
import { CategoryPie } from "./CategoryPie";
import { DashboardSection } from "./DashboardSection";
import { FrequencyChart } from "./FrequencyChart";
import { Highlights } from "./Highlights";
import { InflationCard } from "./InflationCard";
import { KpiCards } from "./KpiCards";
import type { DashboardViewData } from "./lib/view";
import { PeriodBars } from "./PeriodBars";
import { PriceHistory } from "./PriceHistory";
import { PriceChanges, SavingsRanking, TopProducts } from "./ProductRankings";
import { SavingsCard } from "./SavingsCard";
import { SavingsTips } from "./SavingsTips";
import { SortableCards } from "./SortableCards";
import { SourceSplit } from "./SourceSplit";
import { SpendingCalendar } from "./SpendingCalendar";
import { SpendingFlow } from "./SpendingFlow";
import { StoreComparison } from "./StoreComparison";
import { TopMerchants } from "./TopMerchants";
import { UnitPrices } from "./UnitPrices";

const t = it.dashboard;

type DashboardSectionsProps = {
  view: DashboardViewData;
  /** Il periodo ha più scontrini di quanti ne scarica la dashboard. */
  truncated: boolean;
  /** Periodi dell'asse dei grafici per periodo; null mentre a schermo ci sono dati vecchi. */
  keys: string[] | null;
  colorOf: (store: string | null) => string;
  /** Previsione (o il suo stato di caricamento ed errore), in testa alla sintesi. */
  forecast: ReactNode;
  /** Primo e ultimo giorno già trascorso del periodo, per le misure giorno per giorno. */
  span: { from: string; to: string } | null;
};

/** Le quattro sezioni della dashboard con i loro grafici, calcolati da `view`. */
export function DashboardSections({
  view,
  truncated,
  keys,
  colorOf,
  forecast,
  span,
}: DashboardSectionsProps) {
  const { summary, products, purchases, lines, avoidability, daily, highlights } = view;
  // Oltre sei settimane il calendario diventa una striscia: serve tutta la riga.
  const longCalendar = span !== null && daysBetween(span.from, span.to) > 42;
  return (
    <>
      {truncated && (
        <p role="status" className="bg-muted rounded-lg px-3 py-2 text-sm">
          {t.truncated}
        </p>
      )}
      <DashboardSection
        id="summary"
        title={t.sections.summary}
        description={t.sections.summaryDescription}
        icon={Sparkles}
      >
        <KpiCards
          totals={summary.totals}
          daily={daily}
          from={span?.from ?? null}
          to={span?.to ?? null}
        />
        <Highlights highlights={highlights} />
        <div className="grid gap-4 lg:grid-cols-3">
          {forecast}
          <div className="flex flex-col gap-4">
            <SavingsCard products={products} />
            <SavingsTips products={products} className="flex-1" />
          </div>
        </div>
      </DashboardSection>

      <DashboardSection
        id="overview"
        title={t.sections.overview}
        description={t.sections.overviewDescription}
        icon={ChartNoAxesCombined}
      >
        <SortableCards
          section="overview"
          cards={[
            {
              id: "by-period",
              wide: true,
              node: (
                <PeriodBars rows={summary.byPeriod} granularity={summary.granularity} keys={keys} />
              ),
            },
            {
              id: "by-category",
              node: (
                <CategoryPie rows={summary.byCategory} total={summary.totals.total} lines={lines} />
              ),
            },
            {
              id: "top-merchants",
              node: (
                <TopMerchants
                  rows={summary.topMerchants}
                  withoutMerchant={summary.withoutMerchant}
                  total={summary.totals.total}
                  colorOf={colorOf}
                />
              ),
            },
            {
              id: "flow",
              wide: true,
              node: <SpendingFlow lines={lines} colorOf={colorOf} />,
            },
            {
              id: "calendar",
              wide: longCalendar,
              node: (
                <SpendingCalendar daily={daily} from={span?.from ?? null} to={span?.to ?? null} />
              ),
            },
            {
              id: "by-source",
              node: <SourceSplit rows={summary.bySource} total={summary.totals.total} />,
            },
          ]}
        />
      </DashboardSection>

      <DashboardSection
        id="avoidability"
        title={t.sections.avoidability}
        description={t.sections.avoidabilityDescription}
        icon={Scale}
      >
        <SortableCards
          section="avoidability"
          cards={[
            {
              id: "avoidability",
              node: <AvoidabilityOverview totals={avoidability} lines={lines} />,
            },
            {
              id: "avoidability-by-period",
              node: (
                <AvoidabilityByPeriod lines={lines} granularity={summary.granularity} keys={keys} />
              ),
            },
          ]}
        />
      </DashboardSection>

      <DashboardSection
        id="products"
        title={t.sections.products}
        description={t.sections.productsDescription}
        icon={Package}
      >
        <SortableCards
          section="products"
          cards={[
            { id: "inflation", node: <InflationCard products={products} /> },
            { id: "top-products", node: <TopProducts products={products} /> },
            { id: "savings-ranking", node: <SavingsRanking products={products} /> },
            {
              id: "store-comparison",
              node: <StoreComparison products={products} colorOf={colorOf} />,
            },
            { id: "price-changes", node: <PriceChanges products={products} /> },
            {
              id: "price-history",
              wide: true,
              node: <PriceHistory products={products} purchases={purchases} colorOf={colorOf} />,
            },
            { id: "unit-prices", node: <UnitPrices products={products} /> },
            { id: "frequency", node: <FrequencyChart products={products} /> },
          ]}
        />
      </DashboardSection>
    </>
  );
}
