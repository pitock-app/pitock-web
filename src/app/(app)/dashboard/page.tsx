import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout";
import { DashboardSkeleton, DashboardView } from "@/features/dashboard";
import { it } from "@/lib/i18n/it";

export const metadata: Metadata = { title: it.pages.dashboard.title };

export default function Page() {
  return (
    <>
      <PageHeader title={it.pages.dashboard.title} description={it.pages.dashboard.description} />
      {/* Il periodo sta nella query string: la dashboard si rende nel browser. */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardView />
      </Suspense>
    </>
  );
}
