import type { components } from "@/lib/api/schema";
import { MOCK_USER_ID } from "@/lib/auth/mock-session";
import {
  getMockSettings,
  listMockApiKeys,
  PLATFORM_MODEL,
  PLATFORM_MONTHLY_LIMIT,
  PLATFORM_PROVIDER,
} from "./settings";
import { ownerReceipts } from "./db";
import { countMockPlatformCalls } from "./usage";

type Schemas = components["schemas"];

/** Scontrini letti con Pitock AI questo mese, come `platformQuota` del backend. */
export function mockPlatformQuota(email: string): Schemas["PlatformQuota"] {
  // Gli scontrini di esempio (e il loro consumo) nascono alla prima richiesta dell'utente.
  ownerReceipts(email);
  return { used: countMockPlatformCalls(email), limit: PLATFORM_MONTHLY_LIMIT };
}

/** Come `me` del backend: in modalità piattaforma mostra provider e modello della piattaforma. */
export function buildMe(email: string): Schemas["Me"] {
  const settings = getMockSettings(email);
  const byok = settings.mode === "byok";
  return {
    userId: MOCK_USER_ID,
    email,
    ai: {
      mode: byok ? "byok" : "platform",
      provider: byok ? settings.provider : PLATFORM_PROVIDER,
      model: byok ? settings.model : PLATFORM_MODEL,
    },
    platformQuota: mockPlatformQuota(email),
  };
}

export function buildAiSettings(email: string): Schemas["AiSettings"] {
  return {
    ...getMockSettings(email),
    keys: listMockApiKeys(email),
    platformQuota: mockPlatformQuota(email),
  };
}
