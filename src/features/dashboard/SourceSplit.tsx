import { formatShare } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { BarList } from "./BarList";
import { ChartCard, NoData, shareOf } from "./ChartCard";
import type { Summary } from "./lib/dataset";

const t = it.dashboard;

/** Ripartizione della spesa per sorgente: Foto, File, Manuale. */
export function SourceSplit({ rows, total }: { rows: Summary["bySource"]; total: number }) {
  return (
    <ChartCard id="by-source" title={t.bySourceTitle} description={t.bySourceDescription}>
      {rows.length === 0 ? (
        <NoData>{t.noData}</NoData>
      ) : (
        <BarList
          rows={rows.map((row) => ({
            key: row.source,
            label: it.receiptSources[row.source],
            value: row.total,
            color: "var(--chart-2)",
            detail: `${t.receipts(row.nReceipts)} · ${formatShare(shareOf(row.total, total))}`,
          }))}
        />
      )}
    </ChartCard>
  );
}
