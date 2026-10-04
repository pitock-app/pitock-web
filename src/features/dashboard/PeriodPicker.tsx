"use client";

import { Slider } from "@base-ui/react/slider";
import { useMemo, useState, type KeyboardEvent } from "react";
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
/** Passo del trascinamento: il cursore scorre fluido e si aggancia al mese al rilascio. */
const DRAG_STEP = 0.01;
/** Curva "morbida" per l'aggancio, simile alle animazioni di sistema di iOS. */
const SNAP = "duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none";
/** Scorciatoie: quanti mesi, fino al mese in corso. */
const QUICK_RANGES = [1, 3, 6, 12] as const;

type Thumbs = [number, number];

type PeriodPickerProps = {
  value: DashboardFilters;
  /** Riceve una funzione: il nuovo periodo si calcola dall'ultimo scritto, non da `value`. */
  onChange(update: (previous: DashboardFilters) => DashboardFilters): void;
};

const monthName = (key: string) =>
  new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "UTC" }).format(
    new Date(`${key}-01T00:00:00Z`),
  );

/** "Marzo – luglio 2026", "Novembre 2025 – marzo 2026" o "Ottobre 2026". */
function monthsSummary(months: string[], [start, end]: Thumbs): string {
  const from = months[start];
  const to = months[end];
  if (from === to) return formatPeriodKey(to);
  if (from.slice(0, 4) === to.slice(0, 4)) return `${monthName(from)} – ${formatPeriodKey(to)}`;
  return `${formatPeriodKey(from)} – ${formatPeriodKey(to)}`;
}

const rounded = ([start, end]: readonly number[]): Thumbs => [Math.round(start), Math.round(end)];

/** Selettore del periodo: slider sui mesi dell'ultimo anno e, sempre disponibili, le date. */
export function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const rangeInvalid = isRangeInvalid(value);
  const months = useMemo(() => sliderMonths(), []);
  const range = currentRange(value);
  const committed = sliderValue(value);
  const committedKey = committed?.join("-") ?? "none";

  // Posizione locale: durante il trascinamento, e dopo il rilascio finché l'URL non si aggiorna
  // (altrimenti i cursori tornerebbero per un attimo alla posizione precedente).
  const [draft, setDraft] = useState<{ thumbs: number[]; dragging: boolean; base: string } | null>(
    null,
  );
  const live = draft && (draft.dragging || draft.base === committedKey) ? draft.thumbs : null;
  const thumbs = live ?? committed ?? [0, LAST];
  const selected = rounded(thumbs);
  const outside = !live && committed === null;

  function commit(next: Thumbs) {
    setDraft({ thumbs: next, dragging: false, base: committedKey });
    onChange(() => filtersFromSlider(next));
  }

  // Da tastiera si salta di un mese alla volta (il passo fine serve solo al trascinamento).
  function onThumbKeyDown(index: 0 | 1, event: KeyboardEvent<HTMLInputElement>) {
    const moves: Record<string, (current: number) => number> = {
      ArrowLeft: (current) => current - 1,
      ArrowDown: (current) => current - 1,
      ArrowRight: (current) => current + 1,
      ArrowUp: (current) => current + 1,
      PageDown: (current) => current - 3,
      PageUp: (current) => current + 3,
      Home: () => 0,
      End: () => LAST,
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    (
      event as KeyboardEvent<HTMLInputElement> & { preventBaseUIHandler?(): void }
    ).preventBaseUIHandler?.();
    const [start, end] = outside ? [0, LAST] : selected;
    const target = Math.max(0, Math.min(LAST, move(index === 0 ? start : end)));
    // Un cursore spinge l'altro invece di fermarsi.
    const next: Thumbs =
      index === 0 ? [target, Math.max(target, end)] : [Math.min(start, target), target];
    if (next[0] !== selected[0] || next[1] !== selected[1] || outside) commit(next);
  }

  function setDate(field: "from" | "to", day: string | undefined) {
    onChange((previous) => ({ ...currentRange(previous), period: "custom", [field]: day }));
  }

  const summary = outside
    ? range.from && range.to && !rangeInvalid
      ? formatDayRange(range.from, range.to)
      : t.customDates
    : monthsSummary(months, selected);
  const monthCount = selected[1] - selected[0] + 1;
  const quickIndex = outside
    ? -1
    : QUICK_RANGES.findIndex((count) => selected[1] === LAST && monthCount === count);

  return (
    <div className="bg-card/80 flex w-full flex-col gap-5 rounded-3xl border p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.12)] backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {t.period}
          </p>
          <p
            className="truncate text-2xl font-semibold tracking-tight first-letter:uppercase"
            data-testid="period-summary"
          >
            {summary}
          </p>
          <p className="text-muted-foreground text-sm tabular-nums">
            {outside ? t.outsideSlider : t.monthCount(monthCount)}
          </p>
        </div>

        <div
          role="group"
          aria-label={t.quickRanges}
          className="bg-muted relative grid shrink-0 grid-cols-4 rounded-full p-1 text-sm font-medium"
        >
          <span
            aria-hidden
            className={cn(
              "bg-background absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.04)] transition-[transform,opacity]",
              SNAP,
              quickIndex === -1 ? "opacity-0" : "opacity-100",
            )}
            style={{ transform: `translateX(${Math.max(quickIndex, 0) * 100}%)` }}
          />
          {QUICK_RANGES.map((count, index) => (
            <button
              key={count}
              type="button"
              aria-pressed={quickIndex === index}
              onClick={() => commit([LAST - count + 1, LAST])}
              className={cn(
                "focus-visible:ring-ring relative z-10 h-9 rounded-full px-3 whitespace-nowrap transition-colors outline-none focus-visible:ring-2",
                quickIndex === index
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.quick[count]}
            </button>
          ))}
        </div>
      </div>

      <Slider.Root
        value={thumbs}
        min={0}
        max={LAST}
        step={DRAG_STEP}
        aria-label={t.slider}
        onValueChange={(next) =>
          setDraft({ thumbs: [next[0], next[1]], dragging: true, base: committedKey })
        }
        onValueCommitted={(next) => commit(rounded(next))}
        className="group/slider flex flex-col gap-3"
      >
        <Slider.Control className="flex h-11 touch-none items-center px-3.5 select-none">
          <Slider.Track className="bg-foreground/10 relative h-1.5 w-full rounded-full">
            {months.map((key, index) => (
              <span
                key={key}
                aria-hidden
                className={cn(
                  "absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-300",
                  !outside && index >= selected[0] && index <= selected[1]
                    ? "bg-white/70"
                    : "bg-foreground/20",
                )}
                style={{ left: `${(index / LAST) * 100}%` }}
              />
            ))}
            <Slider.Indicator
              className={cn(
                "rounded-full transition-[inset-inline-start,width,opacity]",
                SNAP,
                "group-data-dragging/slider:transition-none",
                outside
                  ? "bg-foreground/20"
                  : "bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_12px_-2px_rgb(245_158_11/0.6)]",
              )}
            />
            {([0, 1] as const).map((index) => (
              <Slider.Thumb
                key={index}
                index={index}
                getAriaLabel={(thumb) => (thumb === 0 ? t.sliderStart : t.sliderEnd)}
                getAriaValueText={(_formatted, month) => formatPeriodKey(months[Math.round(month)])}
                onKeyDown={(event) => onThumbKeyDown(index, event)}
                className={cn(
                  "size-7 rounded-full bg-white outline-none",
                  "shadow-[0_0.5px_4px_rgb(0_0_0/0.12),0_6px_13px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.06)]",
                  "transition-[inset-inline-start,scale,box-shadow]",
                  SNAP,
                  "group-data-dragging/slider:transition-[scale,box-shadow]",
                  "data-dragging:scale-110 data-dragging:shadow-[0_2px_8px_rgb(0_0_0/0.16),0_12px_24px_rgb(0_0_0/0.16)]",
                  "has-focus-visible:ring-4 has-focus-visible:ring-amber-500/40",
                )}
              />
            ))}
          </Slider.Track>
        </Slider.Control>

        <div aria-hidden className="relative mx-3.5 h-4 text-xs">
          {months.map((key, index) => (
            <span
              key={key}
              className={cn(
                "absolute top-0 -translate-x-1/2 whitespace-nowrap transition-colors duration-300",
                !outside && index >= selected[0] && index <= selected[1]
                  ? "text-foreground font-medium"
                  : "text-muted-foreground",
                index !== 0 && index !== LAST && index !== Math.ceil(LAST / 2) && "hidden sm:block",
              )}
              style={{ left: `${(index / LAST) * 100}%` }}
            >
              {formatPeriodKey(key, "short")}
            </span>
          ))}
        </div>
      </Slider.Root>

      <fieldset className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end sm:justify-between">
        <legend className="sr-only">{t.customDates}</legend>
        <p aria-hidden className="text-muted-foreground text-sm sm:pb-3">
          {t.customDatesHint}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:w-80">
          <Field id="dashboard-from" label={t.from}>
            {(control) => (
              <Input
                {...control}
                type="date"
                className="bg-muted/60 h-11 rounded-xl border-transparent"
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
                className="bg-muted/60 h-11 rounded-xl border-transparent"
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
