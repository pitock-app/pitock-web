import type { ReactNode } from "react";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";

const t = it.dashboard;

type ChartCardProps = {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
  /** Tabella dei dati, per chi non legge il grafico. */
  table?: ReactNode;
  /** Controlli accanto al titolo (es. scelta del prodotto). */
  actions?: ReactNode;
  className?: string;
};

/** Riquadro di un grafico della dashboard, con titolo, descrizione e tabella dei dati. */
export function ChartCard({
  id,
  title,
  description,
  children,
  table,
  actions,
  className,
}: ChartCardProps) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn("bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <h3 id={`${id}-title`} className="font-semibold">
            {title}
          </h3>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {actions}
      </div>
      {children}
      {table && (
        <details className="text-sm">
          <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 min-h-11 cursor-pointer content-center rounded-sm outline-none focus-visible:ring-[3px]">
            {t.chartTable}
          </summary>
          <div className="max-h-72 overflow-auto">{table}</div>
        </details>
      )}
    </section>
  );
}

type DataTableProps = {
  caption: string;
  headers: string[];
  /** La prima cella di ogni riga è l'intestazione della riga; le altre sono numeri. */
  rows: { key: string; cells: ReactNode[] }[];
};

export function DataTable({ caption, headers, rows }: DataTableProps) {
  return (
    <table className="w-full text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b">
          {headers.map((header, index) => (
            <th
              key={header}
              scope="col"
              className={cn("py-2 font-medium", index > 0 && "pl-4 text-right")}
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b last:border-0">
            {row.cells.map((cell, index) =>
              index === 0 ? (
                <th key={index} scope="row" className="py-1.5 font-normal">
                  {cell}
                </th>
              ) : (
                <td key={index} className="py-1.5 pl-4 text-right tabular-nums">
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Quota percentuale di un importo sul totale ("42%"). */
export function shareOf(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

/** Stile dei tooltip di Recharts, uguale in tutti i grafici. */
export const tooltipStyle = {
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

/** Etichette degli assi: testo secondario, niente trattini. */
export const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 };

/** Messaggio di grafico senza dati. */
export function NoData({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground py-6 text-center text-sm">{children}</p>;
}
