import { useCallback, useSyncExternalStore } from "react";

/**
 * Disposizione della dashboard scelta dall'utente: ordine delle card in ogni sezione e card
 * chiuse. Vive nel browser (localStorage), quindi vale per il singolo dispositivo; se lo storage
 * non è disponibile la dashboard resta con l'ordine di default.
 */
export type DashboardLayout = {
  /** Ordine degli id delle card per sezione. */
  order: Record<string, string[]>;
  collapsed: string[];
};

const STORAGE_KEY = "pitock.dashboard.layout.v1";
const EMPTY: DashboardLayout = { order: {}, collapsed: [] };

const listeners = new Set<() => void>();
/** Ultimo valore letto, con il testo da cui viene: stessa stringa, stesso oggetto. */
let cache: { raw: string | null; layout: DashboardLayout } = { raw: null, layout: EMPTY };
/** Usata solo se lo storage non è accessibile: la scelta vale fino al ricaricamento. */
let fallback: DashboardLayout | null = null;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parse(raw: string): DashboardLayout {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY;
    const { order, collapsed } = parsed as Record<string, unknown>;
    return {
      order:
        typeof order === "object" && order !== null
          ? Object.fromEntries(
              Object.entries(order).filter((entry): entry is [string, string[]] =>
                isStringArray(entry[1]),
              ),
            )
          : {},
      collapsed: isStringArray(collapsed) ? collapsed : [],
    };
  } catch {
    return EMPTY;
  }
}

function snapshot(): DashboardLayout {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return fallback ?? EMPTY;
  }
  if (raw !== cache.raw) cache = { raw, layout: raw ? parse(raw) : EMPTY };
  return cache.layout;
}

function write(next: DashboardLayout) {
  try {
    if (next.collapsed.length === 0 && Object.keys(next.order).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    fallback = next;
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Un'altra scheda ha cambiato la disposizione.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Ordine effettivo: quello salvato, senza le card che non esistono più, seguito dalle card
 * nuove nell'ordine di default.
 */
export function applyOrder(defaults: string[], saved: string[] | undefined): string[] {
  if (!saved) return defaults;
  const known = saved.filter((id) => defaults.includes(id));
  return [...known, ...defaults.filter((id) => !known.includes(id))];
}

export function useDashboardLayout() {
  const layout = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const setOrder = useCallback((section: string, ids: string[]) => {
    const current = snapshot();
    write({ ...current, order: { ...current.order, [section]: ids } });
  }, []);
  const toggleCollapsed = useCallback((id: string) => {
    const current = snapshot();
    write({
      ...current,
      collapsed: current.collapsed.includes(id)
        ? current.collapsed.filter((item) => item !== id)
        : [...current.collapsed, id],
    });
  }, []);
  const reset = useCallback(() => write(EMPTY), []);
  const customized = layout.collapsed.length > 0 || Object.keys(layout.order).length > 0;
  return { layout, setOrder, toggleCollapsed, reset, customized };
}
