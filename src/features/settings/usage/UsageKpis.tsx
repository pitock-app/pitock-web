import type { components } from "@/lib/api/schema";
import { formatNumber, formatTokens, formatUsd } from "@/lib/format";
import { it } from "@/lib/i18n/it";

type Totals = components["schemas"]["UsageTotals"];

const t = it.settings.usage;

/** Costo stimato: "n/d" se nessuna chiamata del periodo ha un prezzo noto. */
export function formatUsageCost(totals: Pick<Totals, "calls" | "costUsd" | "unpricedCalls">) {
  if (totals.calls > 0 && totals.unpricedCalls >= totals.calls) return t.notAvailable;
  return formatUsd(totals.costUsd);
}

/** KPI del consumo: chiamate, token in input e in output, costo stimato. */
export function UsageKpis({ totals }: { totals: Totals }) {
  const items = [
    { label: t.calls, value: formatNumber(totals.calls, 0) },
    { label: t.inputTokens, value: formatTokens(totals.inputTokens) },
    { label: t.outputTokens, value: formatTokens(totals.outputTokens) },
    { label: t.cost, value: formatUsageCost(totals) },
  ];
  const partial = totals.unpricedCalls > 0 && totals.unpricedCalls < totals.calls;
  return (
    <section aria-label={t.kpiLabel} className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="bg-card min-w-0 rounded-xl border p-4">
            <dt className="text-muted-foreground text-sm">{item.label}</dt>
            <dd
              className="mt-1 text-xl font-semibold break-words tabular-nums sm:text-2xl"
              data-testid={`usage-kpi-${item.label}`}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      {partial && (
        <p className="text-muted-foreground text-xs">{t.unpriced(totals.unpricedCalls)}</p>
      )}
    </section>
  );
}
