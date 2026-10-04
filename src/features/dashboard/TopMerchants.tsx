import type { components } from "@/lib/api/schema";
import { it } from "@/lib/i18n/it";
import { BarList } from "./BarList";
import { ChartCard } from "./ChartCard";

type Stats = components["schemas"]["Stats"];

const t = it.dashboard;
export const TOP_MERCHANTS_SHOWN = 5;

/** I 5 esercenti con la spesa più alta (il backend ne restituisce fino a 10, già ordinati). */
export function TopMerchants({ rows, total }: { rows: Stats["topMerchants"]; total: number }) {
  const top = rows.slice(0, TOP_MERCHANTS_SHOWN);
  return (
    <ChartCard
      id="top-merchants"
      title={t.topMerchantsTitle}
      description={t.topMerchantsDescription}
    >
      {top.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">{t.noData}</p>
      ) : (
        <BarList
          total={total}
          rows={top.map((row) => ({ key: row.merchantName, label: row.merchantName, ...row }))}
        />
      )}
    </ChartCard>
  );
}
