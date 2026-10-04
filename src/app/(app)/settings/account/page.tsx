import type { Metadata } from "next";
import { AccountInfo } from "@/features/settings";
import { it } from "@/lib/i18n/it";

export const metadata: Metadata = { title: it.pages.settingsAccount.title };

export default function Page() {
  return (
    <>
      <h2 className="mb-4 text-lg font-semibold">{it.pages.settingsAccount.title}</h2>
      <AccountInfo />
    </>
  );
}
