"use client";

import { Bot, KeyRound, RotateCw } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/features/auth";
import { it } from "@/lib/i18n/it";
import { routes } from "@/lib/routes";
import { PlatformQuotaBar } from "../PlatformQuotaBar";

const t = it.onboarding;

/** Le due scelte dell'onboarding: Pitock AI (con la quota) o la propria chiave. */
export function OnboardingChoices() {
  const me = useMe();
  return (
    <section
      aria-label={t.choicesLabel}
      className="grid w-full max-w-3xl gap-4 text-left md:grid-cols-2"
    >
      <article className="bg-card flex flex-col gap-4 rounded-xl border p-5">
        <span className="bg-brand/15 text-foreground flex size-10 items-center justify-center rounded-full">
          <Bot className="size-5" aria-hidden />
        </span>
        <h2 className="text-lg font-semibold">{t.platformTitle}</h2>
        <p className="text-muted-foreground text-sm">{t.platformDescription}</p>
        {me.data ? (
          <PlatformQuotaBar quota={me.data.platformQuota} />
        ) : me.isPending ? (
          <Skeleton role="status" className="h-10 w-full">
            <span className="sr-only">{it.states.loading}</span>
          </Skeleton>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm">{t.quotaError}</span>
            <Button variant="outline" className="h-11" onClick={() => void me.refetch()}>
              <RotateCw aria-hidden />
              {it.states.retry}
            </Button>
          </div>
        )}
        <Link
          href="/dashboard"
          className={buttonVariants({
            className: "bg-brand text-brand-foreground hover:bg-brand/90 mt-auto h-11",
          })}
        >
          {t.platformAction}
        </Link>
      </article>
      <article className="bg-card flex flex-col gap-4 rounded-xl border p-5">
        <span className="bg-muted flex size-10 items-center justify-center rounded-full">
          <KeyRound className="size-5" aria-hidden />
        </span>
        <h2 className="text-lg font-semibold">{t.byokTitle}</h2>
        <p className="text-muted-foreground text-sm">{t.byokDescription}</p>
        <Link
          href={routes.settingsAi}
          className={buttonVariants({ variant: "outline", className: "mt-auto h-11" })}
        >
          {t.byokAction}
        </Link>
      </article>
    </section>
  );
}
