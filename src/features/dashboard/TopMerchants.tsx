import { formatShare } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { BarList } from "./BarList";
import { ChartCard, NoData, shareOf } from "./ChartCard";
import type { Summary } from "./lib/dataset";

const t = it.dashboard;

type TopMerchantsProps = {
  rows: Summary["topMerchants"];
  total: number;
  colorOf(store: string): string;
};

/** Esercenti per spesa, i primi 10 con "Mostra tutti", nel colore di ogni negozio. */
export function TopMerchants({ rows, total, colorOf }: TopMerchantsProps) {
  return (
    <ChartCard
      id="top-merchants"
      title={t.topMerchantsTitle}
      description={t.topMerchantsDescription}
    >
      {rows.length === 0 ? (
        <NoData>{t.noData}</NoData>
      ) : (
        <BarList
          rows={rows.map((row) => ({
            key: row.merchantName,
            label: row.merchantName,
            value: row.total,
            color: colorOf(row.merchantName),
            detail: `${t.receipts(row.nReceipts)} · ${formatShare(shareOf(row.total, total))}`,
          }))}
        />
      )}
    </ChartCard>
  );
}
