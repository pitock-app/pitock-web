import type { Metadata } from "next";
import { AiSettingsView } from "@/features/settings";
import { it } from "@/lib/i18n/it";

export const metadata: Metadata = { title: it.pages.settingsAi.title };

export default function Page() {
  return (
    <>
      <h2 className="mb-4 text-lg font-semibold">{it.pages.settingsAi.title}</h2>
      <AiSettingsView />
    </>
  );
}
