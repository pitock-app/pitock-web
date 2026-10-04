import Link from "next/link";
import type { components } from "@/lib/api/schema";
import { it } from "@/lib/i18n/it";
import { routes } from "@/lib/routes";
import { categoryLabel, dateLabel, merchantLabel, totalLabel } from "./lib/display";
import { ReceiptThumbnail } from "./ReceiptThumbnail";
import { SourceBadge } from "./SourceBadge";
import { StatusBadge } from "./StatusBadge";

type ReceiptListItem = components["schemas"]["ReceiptListItem"];

const t = it.receipts;

/** Tabella degli scontrini (desktop). */
export function ReceiptTable({ items }: { items: ReceiptListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm" data-testid="receipt-table">
        <caption className="sr-only">{t.tableCaption}</caption>
        <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
          <tr>
            <th scope="col" className="w-16 px-3 py-2 font-medium">
              <span className="sr-only">{t.columns.file}</span>
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t.columns.merchant}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t.columns.date}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t.columns.total}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t.columns.category}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t.columns.source}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t.columns.status}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              data-testid="receipt-row"
              data-status={item.status}
              className="hover:bg-muted/40 border-t"
            >
              <td className="px-3 py-2">
                <ReceiptThumbnail item={item} className="size-10" />
              </td>
              <td className="px-3 py-2 font-medium">
                <Link
                  data-receipt-link
                  href={routes.receipt(item.id)}
                  className="focus-visible:ring-ring inline-flex min-h-11 items-center rounded underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  {merchantLabel(item.merchantName)}
                </Link>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{dateLabel(item)}</td>
              <td className="px-3 py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                {totalLabel(item)}
              </td>
              <td className="px-3 py-2">{categoryLabel(item.category)}</td>
              <td className="px-3 py-2">
                <SourceBadge source={item.source} />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={item.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
