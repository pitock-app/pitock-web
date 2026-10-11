import { env } from "@/lib/env";

function originOf(url: string | undefined): string {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}

/**
 * Content Security Policy di una risposta. Gli script sono ammessi solo con il `nonce` della
 * richiesta (Next lo applica da solo ai suoi script, next-themes lo riceve dal layout) e,
 * grazie a 'strict-dynamic', quelli che caricano a loro volta. Gli stili restano
 * 'unsafe-inline': gli attributi `style` (grafici, larghezze delle barre) non accettano nonce.
 * Connessioni solo verso app, API e Supabase; file degli scontrini solo dallo Storage di
 * Supabase, dall'app o da blob: (anteprime locali).
 */
export function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  const supabase = originOf(env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseRealtime = supabase.replace(/^http/, "ws");
  // Con il mock le chiamate verso l'API restano nel browser (MSW), ma partono comunque.
  const api = originOf(env.NEXT_PUBLIC_API_URL);
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabase}`,
    "font-src 'self' data:",
    `connect-src 'self' blob: data: ${api} ${supabase} ${supabaseRealtime}${isDev ? " ws:" : ""}`,
    `frame-src 'self' blob: ${supabase}`,
    // Service worker di MSW (solo in modalità mock) e worker creati da blob: (heic2any).
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]
    .map((directive) => directive.replace(/\s+/g, " ").trim())
    .join("; ");
}

/** Nonce casuale per richiesta (128 bit, base64). */
export function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
