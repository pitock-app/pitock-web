"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import {
  parseDashboardFilters,
  serializeDashboardFilters,
  type DashboardFilters,
} from "../lib/dashboard-period";
import type { DatasetFilters } from "../lib/dataset";

/**
 * Periodo, negozio e categoria della dashboard, letti dalla query string e riscritti con
 * `router.replace`: i filtri restano nell'URL e quindi condivisibili.
 */
export function useDashboardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseDashboardFilters(searchParams), [searchParams]);

  // `router.replace` aggiorna l'URL dopo: due modifiche ravvicinate (data iniziale e finale)
  // partono dall'ultimo periodo scritto, altrimenti la seconda cancellerebbe la prima.
  const latestFilters = useRef(filters);
  useEffect(() => {
    latestFilters.current = filters;
  }, [filters]);

  const writeFilters = (next: DashboardFilters) => {
    latestFilters.current = next;
    const search = serializeDashboardFilters(next).toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };
  // Il selettore del periodo non conosce negozio e categoria: si conservano.
  const setPeriod = (update: (previous: DashboardFilters) => DashboardFilters) => {
    const { store, category } = latestFilters.current;
    writeFilters({
      ...update(latestFilters.current),
      ...(store ? { store } : {}),
      ...(category ? { category } : {}),
    });
  };
  const setDimensions = (next: DatasetFilters) => {
    const { store: _store, category: _category, ...period } = latestFilters.current;
    writeFilters({
      ...period,
      ...(next.store ? { store: next.store } : {}),
      ...(next.category ? { category: next.category } : {}),
    });
  };

  return { filters, setPeriod, setDimensions };
}
