"use client";

import { Slider } from "@base-ui/react/slider";
import { useMemo, useState } from "react";
import { Field } from "@/components/form";
import { Input } from "@/components/ui/input";
import { formatDayRange, formatPeriodKey } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";
import {
  currentRange,
  filtersFromSlider,
  isRangeInvalid,
  SLIDER_MONTHS,
  sliderMonths,
  sliderValue,
  type DashboardFilters,
} from "./lib/dashboard-period";

const t = it.dashboard;
const LAST = SLIDER_MONTHS - 1;

type PeriodPickerProps = {
  value: DashboardFilters;
  /** Riceve una funzione: il nuovo periodo si calcola dall'ultimo scritto, non da `value`. */
  onChange(update: (previous: DashboardFilters) => DashboardFilters): void;
};

/** Mesi sotto lo slider: su mobile solo il primo, quello centrale e l'ultimo. */
function MonthTicks({ months }: { months: string[] }) {
  return (
    <div aria-hidden className="text-muted-foreground relative h-4 text-xs">
      {months.map((key, index) => (
        <span
          key={key}
          className={cn(
            "absolute top-0 whitespace-nowrap",
            index === 0
              ? "translate-x-0"
              : index === LAST
                ? "-translate-x-full"
                : "-translate-x-1/2",
            index !== 0 && index !== LAST && index !== Math.ceil(LAST / 2) && "hidden sm:block",
          )}
          style={{ left: `${(index / LAST) * 100}%` }}
        >
          {formatPeriodKey(key, "short")}
        </span>
      ))}
    </div>
  );
}

/** Selettore del periodo: slider sui mesi dell'ultimo anno e, sempre disponibili, le date. */
export function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const rangeInvalid = isRangeInvalid(value);
  const months = useMemo(() => sliderMonths(), []);
  const range = currentRange(value);
  const committed = sliderValue(value);
  // Durante il trascinamento i cursori si muovono in locale; l'URL cambia solo al rilascio.
  const [draft, setDraft] = useState<[number, number] | null>(null);
  const thumbs = draft ?? committed ?? [0, LAST];
  const outside = committed === null && !draft;

  function setDate(field: "from" | "to", day: string | undefined) {
    onChange((previous) => ({
      ...currentRange(previous),
      period: "custom",
      [field]: day,
    }));
  }

  const summary =
    range.from && range.to && !rangeInvalid ? formatDayRange(range.from, range.to) : null;

  return (
    <div className="bg-card flex w-full flex-col gap-4 rounded-xl border p-4">
      <Slider.Root
        value={thumbs}
        min={0}
        max={LAST}
        step={1}
        thumbAlignment="edge"
        onValueChange={(next) => setDraft([next[0], next[1]])}
        onValueCommitted={(next) => {
          setDraft(null);
          onChange(() => filtersFromSlider([next[0], next[1]]));
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <Slider.Label className="text-sm font-medium">{t.slider}</Slider.Label>
          {summary && (
            <span className="text-sm font-semibold tabular-nums" data-testid="period-summary">
              {summary}
            </span>
          )}
        </div>
        <Slider.Control className="flex h-11 touch-none items-center select-none">
          <Slider.Track className="bg-muted relative h-1.5 w-full rounded-full">
            <Slider.Indicator
              className={cn("rounded-full", outside ? "bg-muted-foreground/30" : "bg-brand")}
            />
            {[0, 1].map((index) => (
              <Slider.Thumb
                key={index}
                index={index}
                getAriaLabel={(thumb) => (thumb === 0 ? t.sliderStart : t.sliderEnd)}
                getAriaValueText={(_formatted, month) => formatPeriodKey(months[month])}
                className={cn(
                  "bg-background size-6 rounded-full border-2 shadow-sm outline-none",
                  "has-focus-visible:ring-ring has-focus-visible:ring-2 has-focus-visible:ring-offset-2",
                  outside ? "border-muted-foreground/50" : "border-brand",
                )}
              />
            ))}
          </Slider.Track>
        </Slider.Control>
        <MonthTicks months={months} />
      </Slider.Root>

      <fieldset className="flex flex-col gap-2 border-t pt-4">
        <legend className="sr-only">{t.customDates}</legend>
        <p aria-hidden className="text-sm font-medium">
          {t.customDates}
        </p>
        {outside && !rangeInvalid && (
          <p className="text-muted-foreground text-xs">{t.outsideSlider}</p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:max-w-80">
          <Field id="dashboard-from" label={t.from}>
            {(control) => (
              <Input
                {...control}
                type="date"
                className="h-11"
                value={range.from ?? ""}
                onChange={(event) => setDate("from", event.target.value || undefined)}
              />
            )}
          </Field>
          <Field id="dashboard-to" label={t.to} error={rangeInvalid ? t.rangeInvalid : undefined}>
            {(control) => (
              <Input
                {...control}
                type="date"
                className="h-11"
                value={range.to ?? ""}
                onChange={(event) => setDate("to", event.target.value || undefined)}
              />
            )}
          </Field>
        </div>
      </fieldset>
    </div>
  );
}
