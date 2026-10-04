import { Lightbulb, TrendingUp } from "lucide-react";
import { formatCurrency, formatDate, formatPercentChange } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";
import { INCREASE, SAVING } from "./lib/colors";
import { savingTips, type ProductStats, type SavingTip } from "./lib/products";
import { formatGap, formatUnitPrice } from "./ProductRankings";

const t = it.dashboard.tips;

function tipText(tip: SavingTip): string {
  switch (tip.kind) {
    case "store":
      return t.store(tip.product, formatGap(tip.gap), tip.cheaper, tip.pricier);
    case "format": {
      const type = tip.type.charAt(0).toUpperCase() + tip.type.slice(1);
      const text = t.format(
        type,
        tip.cheaper,
        formatGap(tip.gap),
        tip.unit === "kg" ? "kg" : "litro",
        tip.pricier,
      );
      // "Caffe: Caffe macinato 500g…" → "Caffe macinato 500g…" quando il prodotto ripete già il tipo.
      return tip.cheaper.toLowerCase().startsWith(tip.type) ? text.slice(type.length + 2) : text;
    }
    case "increase":
      return t.increase(
        tip.product,
        formatPercentChange(tip.change).replace("+", ""),
        formatDate(`${tip.since}T12:00:00Z`),
      );
    case "best-price":
      return t.bestPrice(
        tip.product,
        formatUnitPrice(tip.price, tip.unit),
        tip.merchant ? t.at(tip.merchant) : "",
        formatCurrency(tip.saving),
      );
  }
}

/** Consigli di risparmio generati dai dati. */
export function SavingsTips({
  products,
  className,
}: {
  products: ProductStats[];
  className?: string;
}) {
  const tips = savingTips(products);
  return (
    <section
      aria-labelledby="tips-title"
      className={cn("bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4", className)}
    >
      <div>
        <h3 id="tips-title" className="font-semibold">
          {t.title}
        </h3>
        <p className="text-muted-foreground text-sm">{t.description}</p>
      </div>
      {tips.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.none}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm" data-testid="savings-tips">
          {tips.map((tip, index) => {
            const Icon = tip.kind === "increase" ? TrendingUp : Lightbulb;
            return (
              <li key={index} className="flex gap-2">
                <Icon
                  className="mt-0.5 size-4 shrink-0"
                  style={{ color: tip.kind === "increase" ? INCREASE : SAVING }}
                  aria-hidden
                />
                <span>{tipText(tip)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
