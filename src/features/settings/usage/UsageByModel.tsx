import type { components } from "@/lib/api/schema";
import { formatNumber, formatTokens } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { providerName } from "../lib/display";
import { formatUsageCost } from "./UsageKpis";

type ByModel = components["schemas"]["UsageSummary"]["byModel"];

const t = it.settings.usage;

/** Tabella per modello: chiamate, token, costo. */
export function UsageByModel({ rows }: { rows: ByModel }) {
  return (
    <section
      aria-labelledby="usage-models-title"
      className="bg-card flex flex-col gap-3 rounded-xl border p-4"
    >
      <h2 id="usage-models-title" className="font-semibold">
        {t.byModelTitle}
      </h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.byModelEmpty}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((row) => (
              <li key={`${row.provider}/${row.model}`} className="rounded-lg border p-3 text-sm">
                <p className="font-mono text-xs break-all">{row.model}</p>
                <p className="text-muted-foreground text-xs">{providerName(row.provider)}</p>
                <dl className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <dt className="text-muted-foreground text-xs">{t.calls}</dt>
                    <dd className="tabular-nums">{formatNumber(row.calls, 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">{t.tokens}</dt>
                    <dd className="tabular-nums">
                      {formatTokens(row.inputTokens + row.outputTokens)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">{t.cost}</dt>
                    <dd className="tabular-nums">{formatUsageCost(row)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t.byModelTitle}</caption>
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t.model}
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    {t.calls}
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    {t.tokens}
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    {t.cost}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.provider}/${row.model}`} className="border-b last:border-0">
                    <th scope="row" className="py-2 pr-4 font-normal">
                      <span className="block font-mono text-xs break-all">{row.model}</span>
                      <span className="text-muted-foreground text-xs">
                        {providerName(row.provider)}
                      </span>
                    </th>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatNumber(row.calls, 0)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatTokens(row.inputTokens + row.outputTokens)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatUsageCost(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
