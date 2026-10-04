import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout";
import { SettingsNav } from "@/features/settings";
import { it } from "@/lib/i18n/it";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title={it.pages.settings.title} description={it.pages.settings.description} />
      <div className="flex flex-col gap-6 md:flex-row">
        <SettingsNav />
        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </>
  );
}
