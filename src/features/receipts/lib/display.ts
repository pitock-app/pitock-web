import type { components } from "@/lib/api/schema";
import { formatCurrency, formatDate } from "@/lib/format";
import { it } from "@/lib/i18n/it";

type ReceiptListItem = components["schemas"]["ReceiptListItem"];

const t = it.receipts;

export function merchantLabel(name: string | null | undefined): string {
  return name?.trim() || t.unknownMerchant;
}

export function totalLabel(item: Pick<ReceiptListItem, "total" | "currency">): string {
  return item.total === null ? t.noValue : formatCurrency(item.total, item.currency ?? "EUR");
}

/** Data d'acquisto, oppure di caricamento se manca (come i filtri del backend). */
export function dateLabel(item: Pick<ReceiptListItem, "purchasedAt" | "createdAt">): string {
  return formatDate(item.purchasedAt ?? item.createdAt);
}

export function categoryLabel(category: ReceiptListItem["category"]): string {
  return category ? it.categories[category] : t.noValue;
}
