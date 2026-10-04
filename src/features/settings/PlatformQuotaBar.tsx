import { it } from "@/lib/i18n/it";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/utils";

type Quota = components["schemas"]["PlatformQuota"];

/** Quota mensile di Pitock AI: "12 / 100 scontrini questo mese". */
export function PlatformQuotaBar({ quota, className }: { quota: Quota; className?: string }) {
  const t = it.settings.quota;
  const percent = quota.limit > 0 ? Math.min(100, (quota.used / quota.limit) * 100) : 100;
  const exhausted = quota.used >= quota.limit;
  const text = t.value(quota.used, quota.limit);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-medium">{t.label}</span>
        <span className="text-muted-foreground tabular-nums">{text}</span>
      </div>
      <div
        role="progressbar"
        aria-label={t.label}
        aria-valuemin={0}
        aria-valuemax={quota.limit}
        aria-valuenow={Math.min(quota.used, quota.limit)}
        aria-valuetext={text}
        className="bg-muted h-2 w-full overflow-hidden rounded-full"
      >
        <div
          className={cn("h-full rounded-full", exhausted ? "bg-destructive" : "bg-brand")}
          style={{ width: `${percent}%` }}
        />
      </div>
      {exhausted && <p className="text-destructive text-sm">{t.exhausted}</p>}
    </div>
  );
}
