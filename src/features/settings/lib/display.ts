import { it } from "@/lib/i18n/it";

/** Nome leggibile di un provider; quelli sconosciuti restano come sono. */
export function providerName(provider: string): string {
  return Object.hasOwn(it.aiProviders, provider)
    ? it.aiProviders[provider as keyof typeof it.aiProviders]
    : provider;
}
