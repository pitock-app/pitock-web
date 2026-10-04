import type { components } from "@/lib/api/schema";
import { it } from "@/lib/i18n/it";
import { BarList } from "./BarList";
import { ChartCard } from "./ChartCard";

type Stats = components["schemas"]["Stats"];

const t = it.dashboard;

/** Ripartizione della spesa per sorgente: Foto, File, Manuale. */
export function SourceSplit({ rows, total }: { rows: Stats["bySource"]; total: number }) {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  return (
    <ChartCard id="by-source" title={t.bySourceTitle} description={t.bySourceDescription}>
      {sorted.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">{t.noData}</p>
      ) : (
        <BarList
          total={total}
          rows={sorted.map((row) => ({
            key: row.source,
            label: it.receiptSources[row.source],
            total: row.total,
            nReceipts: row.nReceipts,
          }))}
        />
      )}
    </ChartCard>
  );
}
