"use client";

import "./globals.css";
import { ErrorState } from "@/components/layout";

/** Errore nel layout radice: sostituisce tutta la pagina, quindi ha html e body propri. */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="it">
      <body className="min-h-dvh antialiased">
        <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
          <div className="w-full">
            <ErrorState onRetry={retry} headingLevel="h1" />
          </div>
        </main>
      </body>
    </html>
  );
}
