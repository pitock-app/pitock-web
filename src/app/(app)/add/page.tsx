import type { Metadata } from "next";
import { PageHeader } from "@/components/layout";
import { AddReceiptTabs } from "@/features/capture";
import { ManualEntryForm } from "@/features/manual-entry";
import { it } from "@/lib/i18n/it";

export const metadata: Metadata = { title: it.pages.add.title };

export default function Page() {
  return (
    <>
      <PageHeader title={it.pages.add.title} description={it.pages.add.description} />
      <AddReceiptTabs manual={<ManualEntryForm />} />
    </>
  );
}
