import { env, isMockMode } from "@/lib/env";

/** Percorso degli URL firmati di lettura del bucket `receipts` di Supabase Storage. */
const SIGNED_PATH = "/storage/v1/object/sign/receipts/";

export type FileUrlPolicy = {
  /** URL del progetto Supabase (`NEXT_PUBLIC_SUPABASE_URL`). */
  supabaseUrl: string;
  /** In modalità mock valgono anche i file in memoria (blob:) e quelli di esempio dell'app. */
  mock: boolean;
  /** Origine dell'app, per i file di esempio della modalità mock. */
  appOrigin?: string;
};

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Restituisce l'URL solo se punta a un file firmato del bucket `receipts` del nostro
 * progetto Supabase (o, in modalità mock, a un file locale); altrimenti undefined.
 * Così un URL inatteso non finisce mai in un <img>, in un <iframe> o in un link.
 */
export function checkFileUrl(url: string | null | undefined, policy: FileUrlPolicy) {
  if (!url) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  const storageOrigin = policy.supabaseUrl ? originOf(policy.supabaseUrl) : null;
  if (
    storageOrigin &&
    parsed.origin === storageOrigin &&
    parsed.pathname.startsWith(SIGNED_PATH) &&
    !parsed.username &&
    !parsed.password
  ) {
    return parsed.toString();
  }
  if (policy.mock) {
    if (parsed.protocol === "blob:") return parsed.toString();
    if (policy.appOrigin && parsed.origin === policy.appOrigin) return parsed.toString();
  }
  return undefined;
}

/** `checkFileUrl` con la configurazione dell'app. */
export function safeFileUrl(url: string | null | undefined): string | undefined {
  return checkFileUrl(url, {
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    mock: isMockMode,
    appOrigin: typeof window === "undefined" ? undefined : window.location.origin,
  });
}
