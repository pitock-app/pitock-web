import { isMockMode } from "@/lib/env";

let ready: Promise<void> | null = null;

/**
 * Con NEXT_PUBLIC_API_MOCKING=true avvia una sola volta il service worker di MSW
 * e risolve quando può intercettare le chiamate. Altrimenti non fa nulla.
 */
export function ensureMocking(): Promise<void> {
  if (!isMockMode) return Promise.resolve();
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return Promise.resolve();
  ready ??= import("@/mocks/browser").then(async ({ worker }) => {
    await worker.start({ onUnhandledFrame: "bypass", quiet: true });
  });
  return ready;
}
