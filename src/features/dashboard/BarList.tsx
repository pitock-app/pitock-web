import { formatCurrency, formatShare } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { shareOf } from "./ChartCard";

const t = it.dashboard;

export type BarListRow = { key: string; label: string; total: number; nReceipts: number };

/**
 * Elenco con barre orizzontali proporzionali all'importo più alto. I valori sono sempre
 * scritti accanto alla barra: il grafico si legge anche senza colori.
 */
export function BarList({ rows, total }: { rows: BarListRow[]; total: number }) {
  const max = Math.max(...rows.map((row) => row.total), 0);
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium" title={row.label}>
              {row.label}
            </span>
            <span className="shrink-0 tabular-nums">{formatCurrency(row.total)}</span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
            <div
              className="h-full rounded-full bg-[var(--chart-1)]"
              style={{ width: `${max > 0 ? Math.max((row.total / max) * 100, 1) : 0}%` }}
            />
          </div>
          <p className="text-muted-foreground text-xs tabular-nums">
            {t.receipts(row.nReceipts)} · {formatShare(shareOf(row.total, total))}
          </p>
        </li>
      ))}
    </ol>
  );
}
