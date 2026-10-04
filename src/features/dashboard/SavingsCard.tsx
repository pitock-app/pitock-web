import { PiggyBank } from "lucide-react";
import { formatCurrency, formatShare } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";
import { shareOf } from "./ChartCard";
import { SAVING } from "./lib/colors";
import type { ProductStats } from "./lib/products";

const t = it.dashboard.savings;

/** Totale del risparmio potenziale: miglior prezzo registrato per ogni prodotto. */
export function SavingsCard({
  products,
  className,
}: {
  products: ProductStats[];
  className?: string;
}) {
  const losing = products.filter((p) => p.potentialSaving >= 0.01);
  const total = losing.reduce((sum, p) => sum + p.potentialSaving, 0);
  const spent = products.reduce((sum, p) => sum + p.totalSpent, 0);
  return (
    <section
      aria-labelledby="savings-title"
      className={cn("bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-4", className)}
    >
      <div className="flex items-center gap-2">
        <PiggyBank className="size-5 shrink-0" style={{ color: SAVING }} aria-hidden />
        <h3 id="savings-title" className="font-semibold">
          {t.title}
        </h3>
      </div>
      <p className="text-muted-foreground text-sm">{t.description}</p>
      {losing.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">{t.none}</p>
      ) : (
        <>
          <p
            className="mt-2 text-3xl font-semibold"
            style={{ color: SAVING }}
            data-testid="savings-total"
          >
            {formatCurrency(Math.round(total * 100) / 100)}
          </p>
          <p className="text-muted-foreground text-sm">
            {t.products(losing.length)} · {t.ofSpend(formatShare(shareOf(total, spent), 1))}
          </p>
        </>
      )}
    </section>
  );
}
