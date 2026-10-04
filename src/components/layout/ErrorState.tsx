"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { it } from "@/lib/i18n/it";

type ErrorStateProps = {
  title?: string;
  description?: string;
  /** Livello del titolo: h1 quando lo stato occupa tutta la pagina. */
  headingLevel?: "h1" | "h2" | "h3";
  onRetry?: () => void;
};

export function ErrorState({
  title = it.states.errorTitle,
  description = it.states.errorDescription,
  onRetry,
  headingLevel: Heading = "h2",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="border-destructive/30 flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-12 text-center"
    >
      <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <Heading className="text-lg font-semibold">{title}</Heading>
      <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      {onRetry && (
        <Button variant="outline" className="h-11" onClick={onRetry}>
          <RotateCw aria-hidden />
          {it.states.retry}
        </Button>
      )}
    </div>
  );
}
