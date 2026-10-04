import { aiProviders } from "@/lib/api/enums";
import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];
export type Provider = Schemas["Provider"];
type StoredSettings = Omit<Schemas["AiSettings"], "keys" | "platformQuota">;

/** Provider e modello della piattaforma (DEFAULT_PROVIDER / DEFAULT_MODEL del backend). */
export const PLATFORM_PROVIDER: Provider = "anthropic";
export const PLATFORM_MODEL = "claude-haiku-4-5";

/** Scontrini al mese con Pitock AI (PLATFORM_MONTHLY_RECEIPT_LIMIT del backend). */
export const PLATFORM_MONTHLY_LIMIT = 100;

const DEFAULT_SETTINGS: StoredSettings = {
  mode: "platform",
  provider: null,
  model: null,
  fallbackToPlatform: false,
};

const settings = new Map<string, StoredSettings>();
/** Chiavi salvate: solo last4 e data di verifica, come le restituisce il backend. */
const keys = new Map<string, Map<Provider, Schemas["ApiKeyInfo"]>>();

export function resetMockSettings() {
  settings.clear();
  keys.clear();
}

/** Cancella impostazioni e chiavi dell'utente (eliminazione dell'account). */
export function forgetMockSettings(owner: string) {
  settings.delete(owner);
  // Come un account nuovo: le email "byok…" ritrovano le chiavi di esempio.
  keys.delete(owner);
}

/**
 * Chiavi dell'utente finto. Le email che iniziano con "byok" partono con una chiave per
 * ogni provider, per provare la rielaborazione con un altro provider e modello.
 */
function keysOf(owner: string): Map<Provider, Schemas["ApiKeyInfo"]> {
  let map = keys.get(owner);
  if (!map) {
    map = new Map();
    if (/^byok/i.test(owner)) {
      const verifiedAt = new Date().toISOString();
      for (const provider of aiProviders) {
        map.set(provider, { provider, last4: "1234", verifiedAt });
      }
    }
    keys.set(owner, map);
  }
  return map;
}

export function getMockSettings(owner: string): StoredSettings {
  return settings.get(owner) ?? { ...DEFAULT_SETTINGS };
}

export function setMockSettings(owner: string, next: StoredSettings) {
  settings.set(owner, next);
}

export function listMockApiKeys(owner: string): Schemas["ApiKeyInfo"][] {
  return aiProviders.flatMap((provider) => {
    const info = keysOf(owner).get(provider);
    return info ? [info] : [];
  });
}

export function hasMockApiKey(owner: string, provider: Provider): boolean {
  return keysOf(owner).has(provider);
}

export function saveMockApiKey(owner: string, provider: Provider, apiKey: string) {
  const info: Schemas["ApiKeyInfo"] = {
    provider,
    last4: apiKey.slice(-4),
    verifiedAt: new Date().toISOString(),
  };
  keysOf(owner).set(provider, info);
  return info;
}

/** Come il backend: se la chiave cancellata era quella in uso, si torna a `platform`. */
export function deleteMockApiKey(owner: string, provider: Provider): boolean {
  if (!keysOf(owner).delete(provider)) return false;
  const current = getMockSettings(owner);
  if (current.mode === "byok" && current.provider === provider) {
    setMockSettings(owner, { ...current, mode: "platform" });
  }
  return true;
}

/**
 * Esito della verifica di una chiave sul provider finto, scelto dal testo della chiave:
 * "invalid"/"non-valida" → rifiutata, "quota" → senza credito, "offline" → provider irraggiungibile.
 */
export function verifyMockApiKey(
  apiKey: string,
): null | "USER_KEY_INVALID" | "USER_KEY_QUOTA" | "PROVIDER_UNAVAILABLE" {
  if (/invalid|non-?valida/i.test(apiKey)) return "USER_KEY_INVALID";
  if (/quota/i.test(apiKey)) return "USER_KEY_QUOTA";
  if (/offline/i.test(apiKey)) return "PROVIDER_UNAVAILABLE";
  return null;
}

/** Catalogo finto dei modelli, con capacità diverse per provare badge e avvisi. */
export const MOCK_MODELS: Record<Provider, Schemas["ModelInfo"][]> = {
  anthropic: [
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", supportsImages: true, supportsPdf: true },
    {
      id: "claude-sonnet-4-5",
      label: "Claude Sonnet 4.5",
      supportsImages: true,
      supportsPdf: true,
    },
    { id: "claude-opus-4-1", label: "Claude Opus 4.1", supportsImages: true, supportsPdf: true },
  ],
  openai: [
    { id: "gpt-5-mini", label: "GPT-5 mini", supportsImages: true, supportsPdf: true },
    { id: "gpt-5", label: "GPT-5", supportsImages: true, supportsPdf: true },
    { id: "gpt-4.1-nano", label: "GPT-4.1 nano", supportsImages: true, supportsPdf: false },
    { id: "o3-mini", label: "o3-mini", supportsImages: false, supportsPdf: false },
  ],
  openrouter: [
    {
      id: "google/gemini-2.5-flash",
      label: "Google: Gemini 2.5 Flash",
      supportsImages: true,
      supportsPdf: true,
    },
    {
      id: "openai/gpt-5-mini",
      label: "OpenAI: GPT-5 mini",
      supportsImages: true,
      supportsPdf: true,
    },
    {
      id: "meta-llama/llama-4-scout",
      label: "Meta: Llama 4 Scout",
      supportsImages: true,
      supportsPdf: null,
    },
  ],
};

/** Prezzi finti in USD per milione di token (model_prices); i modelli assenti non hanno prezzo. */
const PRICES: Record<string, { input: number; output: number }> = {
  "anthropic/claude-haiku-4-5": { input: 1, output: 5 },
  "anthropic/claude-sonnet-4-5": { input: 3, output: 15 },
  "openai/gpt-5-mini": { input: 0.25, output: 2 },
  "openai/gpt-5": { input: 1.25, output: 10 },
};

export function mockCostUsd(
  provider: string,
  model: string,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  const price = PRICES[`${provider}/${model}`];
  if (!price || inputTokens === null || outputTokens === null) return null;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
