"use client";

import { Field, NativeSelect } from "@/components/form";
import { Input } from "@/components/ui/input";
import { it } from "@/lib/i18n/it";
import {
  dashboardPeriods,
  isDashboardPeriod,
  isRangeInvalid,
  type DashboardFilters,
} from "./lib/dashboard-period";

const t = it.dashboard;

type PeriodPickerProps = {
  value: DashboardFilters;
  /** Riceve una funzione: il nuovo periodo si calcola dall'ultimo scritto, non da `value`. */
  onChange(update: (previous: DashboardFilters) => DashboardFilters): void;
};

/** Selettore del periodo: preset oppure intervallo personalizzato. */
export function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const rangeInvalid = isRangeInvalid(value);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <Field id="dashboard-period" label={t.period} className="w-full sm:w-56">
        {(control) => (
          <NativeSelect
            {...control}
            value={value.period}
            onChange={(event) => {
              const period = event.target.value;
              if (isDashboardPeriod(period)) onChange(() => ({ period }));
            }}
          >
            {dashboardPeriods.map((period) => (
              <option key={period} value={period}>
                {t.periods[period]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      {value.period === "custom" && (
        <div className="grid grid-cols-2 gap-3 sm:w-80">
          <Field id="dashboard-from" label={t.from}>
            {(control) => (
              <Input
                {...control}
                type="date"
                className="h-11"
                value={value.from ?? ""}
                onChange={(event) => {
                  const from = event.target.value || undefined;
                  onChange((previous) => ({ ...previous, from }));
                }}
              />
            )}
          </Field>
          <Field id="dashboard-to" label={t.to} error={rangeInvalid ? t.rangeInvalid : undefined}>
            {(control) => (
              <Input
                {...control}
                type="date"
                className="h-11"
                value={value.to ?? ""}
                onChange={(event) => {
                  const to = event.target.value || undefined;
                  onChange((previous) => ({ ...previous, to }));
                }}
              />
            )}
          </Field>
        </div>
      )}
    </div>
  );
}
