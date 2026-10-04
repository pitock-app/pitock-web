import type { NextConfig } from "next";
import { env } from "./src/lib/env";

/**
 * Il mock (auth finta, MSW) non deve mai arrivare in produzione. Eccezione voluta alla
 * regola "solo NEXT_PUBLIC_*": VERCEL_ENV (variabile di sistema di Vercel, sempre presente
 * in build anche se l'esposizione automatica è spenta) è letta solo qui e non entra nel bundle.
 */
const isProductionBuild =
  env.NEXT_PUBLIC_VERCEL_ENV === "production" || process.env.VERCEL_ENV === "production";
if (isProductionBuild && env.NEXT_PUBLIC_API_MOCKING) {
  throw new Error("NEXT_PUBLIC_API_MOCKING=true non è ammesso nella build di produzione.");
}

function originOf(url: string | undefined): string {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}

/** Progetto Supabase: auth, upload e URL firmati dei file (img e PDF). */
const supabase = originOf(env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseRealtime = supabase.replace(/^http/, "ws");
// Con il mock le chiamate verso l'API restano nel browser (MSW), ma partono comunque.
const api = originOf(env.NEXT_PUBLIC_API_URL);
const isDev = process.env.NODE_ENV === "development";

/**
 * CSP: script solo dall'app (gli script inline di Next richiedono 'unsafe-inline', i nonce
 * renderebbero dinamiche tutte le pagine), connessioni solo verso app, API e Supabase,
 * file degli scontrini solo dallo Storage di Supabase, dall'app o da blob: (anteprime locali).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
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

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
