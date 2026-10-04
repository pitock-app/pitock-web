"use client";

import { CheckCircle2, FlaskConical, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, isApiError } from "@/lib/api/errors";
import { it } from "@/lib/i18n/it";
import { useTestAiConfig, type Provider } from "../hooks/useAiSettings";

const t = it.settings.test;

type Outcome = { ok: true; text: string } | { ok: false; text: string };

/** "Prova configurazione" con la chiave salvata e il modello scelto; esito sotto il pulsante. */
export function TestConfigButton({
  provider,
  model,
}: {
  provider: Provider;
  model: string | null;
}) {
  const test = useTestAiConfig();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const ready = model !== null;

  const run = async () => {
    if (!model) return;
    setOutcome(null);
    try {
      const result = await test.mutateAsync({ provider, model });
      setOutcome(
        result.ok
          ? { ok: true, text: t.ok(it.aiProviders[provider], model) }
          : {
              ok: false,
              text: result.error ? t.errors[result.error.code] : apiErrorMessage("UNKNOWN"),
            },
      );
    } catch (err) {
      setOutcome({ ok: false, text: isApiError(err) ? err.message : apiErrorMessage("UNKNOWN") });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-11 self-start"
        disabled={!ready || test.isPending}
        focusableWhenDisabled
        aria-describedby={!ready ? "ai-test-unavailable" : undefined}
        onClick={() => void run()}
      >
        <FlaskConical aria-hidden />
        {test.isPending ? t.testing : t.action}
      </Button>
      {!ready && (
        <p id="ai-test-unavailable" className="text-muted-foreground text-xs">
          {t.needsConfig}
        </p>
      )}
      <div role="status" aria-live="polite">
        {outcome && (
          <p
            className={
              outcome.ok
                ? "flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-300"
                : "text-destructive flex items-start gap-2 text-sm"
            }
          >
            {outcome.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            {outcome.text}
          </p>
        )}
      </div>
    </div>
  );
}
