import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { components } from "@/lib/api/schema";
import { routes } from "@/lib/routes";
import { categoryLabel, dateLabel, merchantLabel, totalLabel } from "./lib/display";
import { ReceiptThumbnail } from "./ReceiptThumbnail";
import { SourceBadge } from "./SourceBadge";
import { StatusBadge } from "./StatusBadge";

type ReceiptListItem = components["schemas"]["ReceiptListItem"];

/** Lista di card degli scontrini (mobile): ogni card è un link al dettaglio. */
export function ReceiptCardList({ items }: { items: ReceiptListItem[] }) {
  return (
    <ul className="flex flex-col gap-2" data-testid="receipt-cards">
      {items.map((item) => (
        <li key={item.id} data-testid="receipt-card" data-status={item.status}>
          <Link
            data-receipt-link
            href={routes.receipt(item.id)}
            className="bg-card hover:bg-muted/40 focus-visible:ring-ring flex items-center gap-3 rounded-xl border p-3 focus-visible:ring-2 focus-visible:outline-none"
          >
            <ReceiptThumbnail item={item} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate font-medium">{merchantLabel(item.merchantName)}</span>
                <span className="shrink-0 font-semibold tabular-nums">{totalLabel(item)}</span>
              </span>
              <span className="text-muted-foreground text-xs">
                {dateLabel(item)} · {categoryLabel(item.category)}
              </span>
              <span className="flex flex-wrap gap-1.5">
                <SourceBadge source={item.source} />
                <StatusBadge status={item.status} />
              </span>
            </span>
            <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
