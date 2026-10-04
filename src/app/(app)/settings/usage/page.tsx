import type { Metadata } from "next";
import { UsageView } from "@/features/settings";
import { it } from "@/lib/i18n/it";

export const metadata: Metadata = { title: it.pages.settingsUsage.title };

export default function Page() {
  return (
    <>
      <h2 className="mb-4 text-lg font-semibold">{it.pages.settingsUsage.title}</h2>
      <UsageView />
    </>
  );
}
