"use client";

import { X } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { categories } from "@/lib/api/enums";
import { it } from "@/lib/i18n/it";
import type { Category } from "./lib/products";

const t = it.dashboard.filters;

const selectClass =
  "border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full min-w-0 rounded-xl border px-3 text-sm outline-none focus-visible:ring-[3px]";

type DimensionFiltersProps = {
  stores: string[];
  store?: string;
  category?: Category;
  onChange(next: { store?: string; category?: Category }): void;
};

/** Filtri globali per negozio e categoria, sotto il periodo e validi per tutti i grafici. */
export function DimensionFilters({ stores, store, category, onChange }: DimensionFiltersProps) {
  const storeId = useId();
  const categoryId = useId();
  // Il negozio scelto resta nell'elenco anche se nel nuovo periodo non compare.
  const storeList = store && !stores.includes(store) ? [store, ...stores] : stores;
  const active = (store ? 1 : 0) + (category ? 1 : 0);
  return (
    <div
      role="group"
      aria-label={t.label}
      className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={storeId} className="text-sm font-medium">
          {t.store}
        </label>
        <select
          id={storeId}
          className={selectClass}
          value={store ?? ""}
          onChange={(event) => onChange({ store: event.target.value || undefined, category })}
        >
          <option value="">{t.allStores}</option>
          {storeList.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={categoryId} className="text-sm font-medium">
          {t.category}
        </label>
        <select
          id={categoryId}
          className={selectClass}
          value={category ?? ""}
          onChange={(event) =>
            onChange({ store, category: (event.target.value || undefined) as Category | undefined })
          }
        >
          <option value="">{t.allCategories}</option>
          {categories.map((value) => (
            <option key={value} value={value}>
              {it.categories[value]}
            </option>
          ))}
        </select>
      </div>
      <Button
        variant="ghost"
        className="h-11"
        disabled={active === 0}
        onClick={() => onChange({})}
        aria-label={active > 0 ? `${t.clear} (${t.active(active)})` : t.clear}
      >
        <X aria-hidden />
        {t.clear}
      </Button>
    </div>
  );
}
