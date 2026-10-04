import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout";
import { ReceiptListSkeleton, ReceiptsView } from "@/features/receipts";
import { it } from "@/lib/i18n/it";

export const metadata: Metadata = { title: it.pages.receipts.title };

export default function Page() {
  return (
    <>
      <PageHeader title={it.pages.receipts.title} description={it.pages.receipts.description} />
      {/* I filtri stanno nella query string: la lista si rende nel browser. */}
      <Suspense fallback={<ReceiptListSkeleton />}>
        <ReceiptsView />
      </Suspense>
    </>
  );
}
