"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { routes } from "./routes";

/** Navigation API del browser (non ancora nei tipi di TypeScript): solo ciò che serve qui. */
type NavigationLike = {
  canGoBack: boolean;
  currentEntry: { index: number } | null;
  entries(): { url: string | null }[];
};

function browserNavigation(): NavigationLike | undefined {
  return (window as unknown as { navigation?: NavigationLike }).navigation;
}

/**
 * C'è una pagina dell'app prima di questa? La Navigation API conta solo le voci della stessa
 * origine, quindi un link arrivato da fuori (o una scheda nuova) dà false.
 * shortcut: senza Navigation API (browser vecchi) si guarda history.length, che conta anche
 * i siti esterni; da sostituire quando l'API è ovunque.
 */
function canGoBackInApp() {
  const navigation = browserNavigation();
  return navigation ? navigation.canGoBack : window.history.length > 1;
}

/** URL della voce precedente nella cronologia, se la Navigation API la conosce. */
function previousUrl(): string | null {
  const navigation = browserNavigation();
  const index = navigation?.currentEntry?.index ?? 0;
  if (!navigation || index === 0) return null;
  return navigation.entries()[index - 1]?.url ?? null;
}

/** Query string con il parametro impostato (o tolto, se `value` è null), senza "?" iniziale. */
export function withParam(search: string, name: string, value: string | null): string {
  const params = new URLSearchParams(search);
  if (value === null) params.delete(name);
  else params.set(name, value);
  return params.toString();
}

/** Lista separata da virgole (es. le liste espanse), con `id` aggiunto o tolto. */
export function toggleInList(list: string | null, id: string): string | null {
  const items = list ? list.split(",").filter(Boolean) : [];
  const next = items.includes(id) ? items.filter((item) => item !== id) : [...items, id];
  return next.length > 0 ? next.join(",") : null;
}

/**
 * Pulsante "Indietro" coerente con quello del sistema: torna alla pagina precedente dell'app;
 * se non c'è (link diretto, scheda nuova) apre `fallback`.
 */
export function useBack(fallback: string = routes.receipts) {
  const router = useRouter();
  return () => {
    if (canGoBackInApp()) router.back();
    else router.push(fallback);
  };
}

/**
 * Stato di una vista dentro la pagina (livello aperto di un grafico, lista espansa) salvato in
 * un parametro della query string: si ritrova tornando indietro e dopo un ricaricamento.
 * - `open` aggiunge una voce di cronologia: l'indietro del sistema richiude il livello;
 * - `set` cambia l'URL sul posto (scelte che non sono un passo, es. un menu a tendina);
 * - `close` torna indietro se la voce precedente è proprio la pagina senza questo livello,
 *   altrimenti toglie il parametro sul posto.
 */
export function useUrlParam(name: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlWith = (value: string | null) => {
    const search = withParam(searchParams.toString(), name, value);
    return search ? `${pathname}?${search}` : pathname;
  };
  return {
    value: searchParams.get(name),
    open: (value: string) => router.push(urlWith(value), { scroll: false }),
    set: (value: string | null) => router.replace(urlWith(value), { scroll: false }),
    close: () => {
      const target = urlWith(null);
      if (previousUrl() === new URL(target, window.location.origin).href) router.back();
      else router.replace(target, { scroll: false });
    },
  };
}

/** Lista "Mostra tutti" espansa o no, ricordata nel parametro `more` insieme alle altre. */
export function useUrlExpanded(id: string) {
  const more = useUrlParam("more");
  const expanded = more.value?.split(",").includes(id) ?? false;
  const toggle = () => more.set(toggleInList(more.value, id));
  return [expanded, toggle] as const;
}
