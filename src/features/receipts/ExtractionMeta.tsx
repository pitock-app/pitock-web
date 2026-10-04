import { AlertTriangle } from "lucide-react";
import type { components } from "@/lib/api/schema";
import { isLowConfidence } from "@/lib/extraction";
import { formatNumber } from "@/lib/format";
import { it } from "@/lib/i18n/it";

type Schemas = components["schemas"];

const t = it.receipt.extraction;
export { LOW_CONFIDENCE } from "@/lib/extraction";

export function providerLabel(provider: string | null | undefined): string {
  if (!provider) return t.notAvailable;
  return Object.hasOwn(it.aiProviders, provider)
    ? it.aiProviders[provider as keyof typeof it.aiProviders]
    : provider;
}

/** Confidenza, provider, modello e token dell'estrazione corrente. */
export function ExtractionMeta({
  extraction,
  usage,
}: {
  extraction: Schemas["ExtractionDetail"];
  usage?: Schemas["ReceiptDetail"]["usage"];
}) {
  const lowConfidence = isLowConfidence(extraction.confidence);
  const isLlm = extraction.method === "llm";
  const rows: [string, string][] = [[t.method, t.methods[extraction.method]]];
  if (isLlm) {
    rows.push(
      [
        t.confidence,
        extraction.confidence === null
          ? t.notAvailable
          : `${formatNumber(Math.round(extraction.confidence * 100), 0)}%`,
      ],
      [t.provider, providerLabel(usage?.provider ?? extraction.provider)],
      [t.model, usage?.model || extraction.model || t.notAvailable],
      [
        t.tokens,
        usage?.totalTokens === null || usage?.totalTokens === undefined
          ? t.notAvailable
          : formatNumber(usage.totalTokens, 0),
      ],
    );
    if (extraction.keySource) rows.push([t.keySource, t.keySources[extraction.keySource]]);
  }

  return (
    <section aria-labelledby="extraction-meta-title" className="flex flex-col gap-3">
      <h3 id="extraction-meta-title" className="sr-only">
        {t.details}
      </h3>
      {lowConfidence && (
        <p
          className="flex items-start gap-2 rounded-lg border border-amber-600/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          data-testid="low-confidence"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t.lowConfidence}
        </p>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="font-medium break-all">{value}</dd>
          </div>
        ))}
        {extraction.editedByUser && (
          <div className="flex flex-col">
            <dt className="text-muted-foreground text-xs">{t.correction}</dt>
            <dd className="font-medium">{t.edited}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
