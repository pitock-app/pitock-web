"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Field, NativeSelect } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categories, receiptSources, receiptStatuses } from "@/lib/api/enums";
import { it } from "@/lib/i18n/it";
import { isPeriodPreset, periodPresets } from "@/lib/period";
import {
  defaultReceiptFilters,
  hasActiveFilters,
  isRangeInvalid,
  type ReceiptFilters as Filters,
} from "./lib/receipt-filters";

const t = it.receipts.filters;
const SEARCH_DELAY_MS = 300;

type ReceiptFiltersProps = {
  filters: Filters;
  onChange(filters: Filters): void;
};

const pick = <T extends string>(list: readonly T[], value: string): T | undefined =>
  (list as readonly string[]).includes(value) ? (value as T) : undefined;

/** Filtri della lista: periodo, categoria, stato, sorgente e ricerca per esercente. */
export function ReceiptFilters({ filters, onChange }: ReceiptFiltersProps) {
  const [search, setSearch] = useState(filters.q ?? "");
  const [syncedQ, setSyncedQ] = useState(filters.q ?? "");
  // La ricerca cambiata da fuori (indietro nel browser, "Azzera filtri") aggiorna il campo.
  if ((filters.q ?? "") !== syncedQ) {
    setSyncedQ(filters.q ?? "");
    setSearch(filters.q ?? "");
  }

  const latest = useRef({ filters, onChange });
  useEffect(() => {
    latest.current = { filters, onChange };
  });

  useEffect(() => {
    if (search.trim() === (latest.current.filters.q ?? "")) return;
    const timer = setTimeout(() => {
      const { filters: current, onChange: change } = latest.current;
      change({ ...current, q: search.trim() || undefined });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const rangeInvalid = isRangeInvalid(filters);

  return (
    <section aria-label={t.label} className="mb-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[2fr_repeat(4,1fr)]">
        <Field id="filter-q" label={t.search} className="col-span-2 lg:col-span-1">
          {(control) => (
            <div className="relative">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                {...control}
                type="search"
                value={search}
                maxLength={100}
                placeholder={t.searchPlaceholder}
                autoComplete="off"
                className="h-11 pl-9"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          )}
        </Field>
        <Field id="filter-period" label={t.period}>
          {(control) => (
            <NativeSelect
              {...control}
              value={filters.period}
              onChange={(event) => {
                const period = event.target.value;
                if (isPeriodPreset(period)) set({ period, from: undefined, to: undefined });
              }}
            >
              {periodPresets.map((value) => (
                <option key={value} value={value}>
                  {it.periods[value]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id="filter-category" label={t.category}>
          {(control) => (
            <NativeSelect
              {...control}
              value={filters.category ?? ""}
              onChange={(event) => set({ category: pick(categories, event.target.value) })}
            >
              <option value="">{t.allCategories}</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {it.categories[value]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id="filter-status" label={t.status}>
          {(control) => (
            <NativeSelect
              {...control}
              value={filters.status ?? ""}
              onChange={(event) => set({ status: pick(receiptStatuses, event.target.value) })}
            >
              <option value="">{t.allStatuses}</option>
              {receiptStatuses.map((value) => (
                <option key={value} value={value}>
                  {it.receiptStatuses[value]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id="filter-source" label={t.source}>
          {(control) => (
            <NativeSelect
              {...control}
              value={filters.source ?? ""}
              onChange={(event) => set({ source: pick(receiptSources, event.target.value) })}
            >
              <option value="">{t.allSources}</option>
              {receiptSources.map((value) => (
                <option key={value} value={value}>
                  {it.receiptSources[value]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>

      {filters.period === "custom" && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <Field id="filter-from" label={t.from}>
            {(control) => (
              <Input
                {...control}
                type="date"
                className="h-11"
                value={filters.from ?? ""}
                onChange={(event) => set({ from: event.target.value || undefined })}
              />
            )}
          </Field>
          <Field id="filter-to" label={t.to} error={rangeInvalid ? t.rangeInvalid : undefined}>
            {(control) => (
              <Input
                {...control}
                type="date"
                className="h-11"
                value={filters.to ?? ""}
                onChange={(event) => set({ to: event.target.value || undefined })}
              />
            )}
          </Field>
        </div>
      )}

      {hasActiveFilters(filters) && (
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-fit"
          onClick={() => {
            onChange(defaultReceiptFilters);
            // Il pulsante sparisce: il focus torna alla ricerca.
            document.getElementById("filter-q")?.focus();
          }}
        >
          <X aria-hidden />
          {t.reset}
        </Button>
      )}
    </section>
  );
}
