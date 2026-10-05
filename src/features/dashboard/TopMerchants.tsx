import { formatShare } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { BarList } from "./BarList";
import { ChartCard, NoData, shareOf } from "./ChartCard";
import { NEUTRAL } from "./lib/colors";
import type { Summary } from "./lib/dataset";

const t = it.dashboard;

type TopMerchantsProps = {
  rows: Summary["topMerchants"];
  withoutMerchant: Summary["withoutMerchant"];
  total: number;
  colorOf(store: string): string;
};

/**
 * Esercenti per spesa, i primi 10 con "Mostra tutti", nel colore di ogni negozio. In fondo,
 * in grigio, gli scontrini senza esercente: così le righe sommano al totale del periodo.
 */
export function TopMerchants({ rows, withoutMerchant, total, colorOf }: TopMerchantsProps) {
  const detail = (nReceipts: number, amount: number) =>
    `${t.receipts(nReceipts)} · ${formatShare(shareOf(amount, total))}`;
  return (
    <ChartCard
      id="top-merchants"
      title={t.topMerchantsTitle}
      description={t.topMerchantsDescription}
    >
      {rows.length === 0 && !withoutMerchant ? (
        <NoData>{t.noData}</NoData>
      ) : (
        <BarList
          rows={[
            ...rows.map((row) => ({
              key: row.merchantName,
              label: row.merchantName,
              value: row.total,
              color: colorOf(row.merchantName),
              detail: detail(row.nReceipts, row.total),
            })),
            ...(withoutMerchant
              ? [
                  {
                    // Chiave che nessun nome di negozio può avere.
                    key: "\u0000without-merchant",
                    label: t.withoutMerchant,
                    value: withoutMerchant.total,
                    color: NEUTRAL,
                    detail: detail(withoutMerchant.nReceipts, withoutMerchant.total),
                  },
                ]
              : []),
          ]}
        />
      )}
    </ChartCard>
  );
}
