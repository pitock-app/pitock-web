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

/** La Content Security Policy, con un nonce per richiesta, la imposta `src/proxy.ts`. */
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
