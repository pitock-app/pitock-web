"use client";

import { ErrorState } from "@/components/layout";

/** Errore di una pagina dell'app: la shell (navigazione) resta visibile. */
export default function AppError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorState onRetry={retry} headingLevel="h1" />;
}
