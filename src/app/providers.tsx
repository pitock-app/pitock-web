"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { isApiError } from "@/lib/api/errors";
import { it } from "@/lib/i18n/it";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Gli errori 4xx non migliorano riprovando: solo rete e 5xx, al massimo 2 volte.
        retry: (failureCount, error) =>
          failureCount < 2 && (!isApiError(error) || error.status === 0 || error.status >= 500),
      },
    },
  });
}

/** Toast nel tema corrente e con le etichette in italiano. */
function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      richColors
      closeButton
      position="top-center"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      containerAriaLabel={it.states.notifications}
      toastOptions={{ closeButtonAriaLabel: it.states.close }}
    />
  );
}

/** `nonce`: quello della CSP della richiesta, per lo script inline di next-themes. */
export function Providers({
  children,
  nonce,
}: {
  children: ReactNode;
  nonce?: string | undefined;
}) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        nonce={nonce}
      >
        {children}
        <ThemedToaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
