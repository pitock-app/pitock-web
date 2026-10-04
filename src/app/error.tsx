"use client";

import { ErrorState } from "@/components/layout";

export default function RootError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
      <div className="w-full">
        <ErrorState onRetry={retry} headingLevel="h1" />
      </div>
    </main>
  );
}
