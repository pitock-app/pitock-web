import { formatCurrency, formatNumber } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import type { Summary } from "./lib/dataset";

const t = it.dashboard;

/** KPI del periodo: totale speso, numero di scontrini, scontrino medio. */
export function KpiCards({ totals }: { totals: Summary["totals"] }) {
  const items = [
    { id: "total", label: t.total, value: formatCurrency(totals.total) },
    { id: "count", label: t.count, value: formatNumber(totals.nReceipts, 0) },
    { id: "average", label: t.average, value: formatCurrency(totals.average) },
  ];
  return (
    <section aria-label={t.kpiLabel}>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="bg-card min-w-0 rounded-xl border p-4">
            <dt className="text-muted-foreground text-sm">{item.label}</dt>
            <dd
              className="mt-1 text-xl font-semibold break-words sm:text-2xl"
              data-testid={`dashboard-kpi-${item.id}`}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
