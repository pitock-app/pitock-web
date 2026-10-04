"use client";

import { useEffect } from "react";

/** Chiede conferma prima di chiudere o ricaricare la pagina quando `active` è true. */
export function useBeforeUnloadWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Necessario per alcuni browser; il testo mostrato è quello di sistema.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);
}
