"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";

const t = it.dashboard;

/** Righe mostrate prima di "Mostra tutti". */
export const RANKING_LIMIT = 10;

export type BarListRow = {
  key: string;
  label: string;
  /** Valore che decide la lunghezza della barra. */
  value: number;
  /** Testo del valore; di default l'importo in euro. */
  valueLabel?: string;
  /** Riga sotto la barra (numero di scontrini, quota, dettaglio). */
  detail?: ReactNode;
  /** Colore della barra (identità della serie); di default l'accento. */
  color?: string;
  /** Colore del valore, per i soli stati (verde risparmio, rosso rincaro). */
  valueClassName?: string;
};

type BarListProps = {
  rows: BarListRow[];
  /** Oltre questo numero di righe compare "Mostra tutti". */
  limit?: number;
  /** Rende le righe selezionabili (es. dettaglio di una categoria). */
  onSelect?(key: string): void;
};

/**
 * Elenco con barre orizzontali proporzionali al valore più alto. I valori sono sempre scritti
 * accanto alla barra: il grafico si legge anche senza colori.
 */
export function BarList({ rows, limit = RANKING_LIMIT, onSelect }: BarListProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, limit);
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 0);
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-3">
        {shown.map((row) => {
          const content = (
            <>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-left font-medium" title={row.label}>
                  {row.label}
                </span>
                <span className={cn("shrink-0 tabular-nums", row.valueClassName)}>
                  {row.valueLabel ?? formatCurrency(row.value)}
                </span>
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${max > 0 ? Math.max((Math.abs(row.value) / max) * 100, 1) : 0}%`,
                    background: row.color ?? "var(--chart-1)",
                  }}
                />
              </div>
              {row.detail && (
                <p className="text-muted-foreground text-left text-xs tabular-nums">{row.detail}</p>
              )}
            </>
          );
          return (
            <li key={row.key}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(row.key)}
                  className="hover:bg-muted/60 focus-visible:ring-ring/50 -mx-2 flex w-[calc(100%+1rem)] flex-col gap-1 rounded-lg px-2 py-1 outline-none focus-visible:ring-[3px]"
                >
                  {content}
                </button>
              ) : (
                <div className="flex flex-col gap-1">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
      {rows.length > limit && (
        <Button
          variant="ghost"
          size="sm"
          className="h-11 self-start"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t.showLess : t.showAll(rows.length)}
        </Button>
      )}
    </div>
  );
}
