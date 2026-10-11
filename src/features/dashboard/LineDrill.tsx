"use client";

import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { BarList } from "./BarList";
import { NoData } from "./ChartCard";
import type { CategoryLine } from "./lib/dataset";

const t = it.dashboard.categoryDrill;

/** "× 2", "× 0,296"; nulla per il singolo pezzo. */
function quantityLabel(line: CategoryLine) {
  if (line.quantity === null || line.quantity === 1) return null;
  return `× ${formatNumber(line.quantity, Number.isInteger(line.quantity) ? 0 : 3)}`;
}

function lineLabel(line: CategoryLine) {
  if (line.kind === "item") return line.label ?? "";
  return line.kind === "rest" ? (line.amount < 0 ? t.discounts : t.rest) : t.wholeReceipt;
}

type LineDrillProps = {
  /** Voci da elencare, già nell'ordine voluto. */
  lines: CategoryLine[];
  /** Colore delle barre: quello della fetta o del segmento da cui si è arrivati. */
  color: string;
  backLabel: string;
  onBack(): void;
  testId: string;
};

/**
 * Dettaglio di un grafico: le voci che compongono la parte scelta, riga per riga, ciascuna
 * con il link al suo scontrino. Il totale in testa è la somma delle voci.
 */
export function LineDrill({ lines, color, backLabel, onBack, testId }: LineDrillProps) {
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  return (
    <div className="flex flex-col gap-3">
      <Button variant="ghost" size="sm" className="h-11 self-start" onClick={onBack}>
        <ChevronLeft aria-hidden />
        {backLabel}
      </Button>
      {lines.length === 0 ? (
        <NoData>{t.none}</NoData>
      ) : (
        <>
          <p className="text-muted-foreground text-sm tabular-nums" data-testid={testId}>
            {t.lines(lines.length)} · {formatCurrency(total)}
          </p>
          <BarList
            rows={lines.map((line) => ({
              key: line.key,
              label: lineLabel(line),
              value: line.amount,
              color,
              href: `/receipts/${line.receiptId}`,
              detail: [formatDate(line.day), line.merchant, quantityLabel(line)]
                .filter(Boolean)
                .join(" · "),
            }))}
          />
        </>
      )}
    </div>
  );
}
