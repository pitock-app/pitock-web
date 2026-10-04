import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout";
import { OnboardingChoices } from "@/features/settings";
import { it } from "@/lib/i18n/it";

export const metadata: Metadata = { title: it.pages.onboarding.title };

/** Dopo la registrazione: Pitock AI o la propria chiave. "Salta per ora" equivale a Pitock AI. */
export default function Page() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <Logo size={40} />
      <h1 className="text-2xl font-semibold">{it.onboarding.title}</h1>
      <p className="text-muted-foreground max-w-md">{it.onboarding.description}</p>
      <OnboardingChoices />
      <Link
        href="/dashboard"
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center px-2 text-sm underline underline-offset-4"
      >
        {it.onboarding.skip}
      </Link>
    </main>
  );
}
