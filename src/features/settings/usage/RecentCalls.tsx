"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { ErrorState } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { formatDateTime, formatTokens } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { routes } from "@/lib/routes";
import { useUsageCalls } from "../hooks/useUsage";
import { providerName } from "../lib/display";

type UsageCall = components["schemas"]["UsageCall"];

const t = it.settings.usage;

function Result({ call }: { call: UsageCall }) {
  if (call.success) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle2 className="size-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
        {t.success}
      </span>
    );
  }
  return (
    <span className="inline-flex items-start gap-1.5">
      <XCircle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        {t.failure}
        {call.errorCode && (
          <span className="text-muted-foreground block text-xs">
            {apiErrorMessage(call.errorCode)}
          </span>
        )}
      </span>
    </span>
  );
}

function ReceiptLink({ call }: { call: UsageCall }) {
  if (!call.receiptId) return <span className="text-muted-foreground">{it.receipts.noValue}</span>;
  const name = call.merchantName ?? t.receiptWithoutName;
  return (
    <Link
      href={routes.receipt(call.receiptId)}
      className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
      aria-label={t.openReceipt(name)}
    >
      {name}
    </Link>
  );
}

/** Card di una chiamata, per gli schermi stretti. */
function CallCard({ call }: { call: UsageCall }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3 text-sm" data-testid="usage-call-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{t.operations[call.operation]}</span>
        <Result call={call} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">{t.date}</dt>
        <dd>{formatDateTime(call.createdAt)}</dd>
        <dt className="text-muted-foreground self-center">{t.receipt}</dt>
        <dd>
          <ReceiptLink call={call} />
        </dd>
        <dt className="text-muted-foreground">{t.model}</dt>
        <dd className="min-w-0">
          <span className="block font-mono text-xs break-all">{call.model}</span>
          <span className="text-muted-foreground text-xs">
            {providerName(call.provider)} · {it.receipt.extraction.keySources[call.keySource]}
          </span>
        </dd>
        <dt className="text-muted-foreground">{t.tokens}</dt>
        <dd className="tabular-nums">
          {call.totalTokens === null ? t.notAvailable : formatTokens(call.totalTokens)}
        </dd>
      </dl>
    </li>
  );
}

/** Ultime chiamate LLM: data, scontrino, operazione, modello, token, esito. */
export function RecentCalls() {
  const calls = useUsageCalls();
  const items = calls.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section
      aria-labelledby="usage-calls-title"
      className="bg-card flex flex-col gap-3 rounded-xl border p-4"
    >
      <h2 id="usage-calls-title" className="font-semibold">
        {t.recentTitle}
      </h2>
      {calls.isPending ? (
        <div role="status" aria-label={it.states.loading} className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : calls.isError && items.length === 0 ? (
        <ErrorState
          headingLevel="h3"
          description={t.recentError}
          onRetry={() => void calls.refetch()}
        />
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.recentEmpty}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2 md:hidden">
            {items.map((call) => (
              <CallCard key={call.id} call={call} />
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t.recentTitle}</caption>
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t.date}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t.receipt}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t.operation}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t.model}
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    {t.tokens}
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    {t.result}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((call) => (
                  <tr key={call.id} className="border-b align-top last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {formatDateTime(call.createdAt)}
                    </td>
                    <td className="py-2 pr-4">
                      <ReceiptLink call={call} />
                    </td>
                    <td className="py-2 pr-4">
                      {t.operations[call.operation]}
                      <span className="text-muted-foreground block text-xs">
                        {it.receipt.extraction.keySources[call.keySource]}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="block font-mono text-xs break-all">{call.model}</span>
                      <span className="text-muted-foreground text-xs">
                        {providerName(call.provider)}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {call.totalTokens === null ? t.notAvailable : formatTokens(call.totalTokens)}
                    </td>
                    <td className="py-2">
                      <Result call={call} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {calls.isFetchNextPageError && (
            <p role="alert" className="text-destructive text-sm">
              {t.loadMoreError}
            </p>
          )}
          {calls.hasNextPage && (
            <Button
              variant="outline"
              className="h-11 self-center"
              disabled={calls.isFetchingNextPage}
              onClick={() => void calls.fetchNextPage()}
            >
              {calls.isFetchingNextPage ? t.loadingMore : t.loadMore}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
