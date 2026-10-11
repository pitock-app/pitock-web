"use client";

import { formatCompactCurrency, formatCurrency, formatShortDay } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";
import { ChartCard, DataTable, NoData } from "./ChartCard";
import { intensity, spendingCalendar, weekdayRhythm, type CalendarCell } from "./lib/insights";

const t = it.dashboard;

/** Colore di un livello 0–4: ambra del brand sempre più piena sul fondo tenue. */
// Il fondo vuoto è una velatura del testo: `--muted` nel tema scuro coincide con la card.
const EMPTY = "color-mix(in oklab, var(--foreground) 8%, transparent)";
const LEVEL_BG = [
  EMPTY,
  `color-mix(in oklab, var(--chart-1) 30%, ${EMPTY})`,
  `color-mix(in oklab, var(--chart-1) 55%, ${EMPTY})`,
  `color-mix(in oklab, var(--chart-1) 80%, ${EMPTY})`,
  "var(--chart-1)",
];

function cellLabel(cell: CalendarCell) {
  return t.calendar.cell(
    formatShortDay(cell.day),
    cell.amount > 0 ? formatCurrency(cell.amount) : t.calendar.noSpend,
  );
}

type SpendingCalendarProps = {
  daily: Map<string, number>;
  /** Primo e ultimo giorno del calendario; null se il periodo non ha date. */
  from: string | null;
  to: string | null;
};

/**
 * Mappa di calore dei giorni: un mese si legge come un calendario (settimane in righe), i
 * periodi più lunghi come una striscia di settimane in colonne. Sotto, la media di ogni giorno
 * della settimana.
 */
export function SpendingCalendar({ daily, from, to }: SpendingCalendarProps) {
  const spendDays = [...daily].filter(([, amount]) => amount > 0);
  if (!from || !to || spendDays.length === 0) {
    return (
      <ChartCard id="calendar" title={t.calendar.title} description={t.calendar.description}>
        <NoData>{t.noData}</NoData>
      </ChartCard>
    );
  }
  const { weeks, max } = spendingCalendar(daily, from, to);
  const monthView = weeks.length <= 6;
  const rhythm = weekdayRhythm(daily);
  const rhythmMax = Math.max(...rhythm.map((row) => (row.days > 0 ? row.total / row.days : 0)));

  return (
    <ChartCard
      id="calendar"
      title={t.calendar.title}
      description={t.calendar.description}
      table={
        <DataTable
          caption={t.calendar.title}
          headers={[t.calendar.day, t.amount]}
          rows={spendDays
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([day, amount]) => ({
              key: day,
              cells: [formatShortDay(day), formatCurrency(amount)],
            }))}
        />
      }
    >
      {/* Grafico nascosto ai lettori di schermo (c'è la tabella): fuori anche dal Tab. */}
      <div aria-hidden tabIndex={-1} className={cn(!monthView && "overflow-x-auto pb-1")}>
        {monthView ? (
          <div className="grid grid-cols-7 gap-1.5">
            {t.weekdaysShort.map((label, index) => (
              <span key={index} className="text-muted-foreground text-center text-xs">
                {label}
              </span>
            ))}
            {weeks.flat().map((cell) => {
              const level = intensity(cell.amount, max);
              return (
                <div
                  key={cell.day}
                  title={cell.inRange ? cellLabel(cell) : undefined}
                  className={cn(
                    "dash-cell relative flex aspect-square min-h-8 flex-col justify-between rounded-md p-1 text-[10px] leading-none sm:p-1.5 sm:text-xs",
                    !cell.inRange && "opacity-0",
                    level >= 3 ? "text-brand-foreground" : "text-muted-foreground",
                  )}
                  style={{ background: LEVEL_BG[level] }}
                >
                  <span>{Number(cell.day.slice(8))}</span>
                  {cell.amount > 0 && (
                    <span className="hidden truncate font-medium tabular-nums sm:block">
                      {formatCompactCurrency(cell.amount)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex min-w-max gap-[3px] sm:min-w-0">
            {weeks.map((week) => (
              <div key={week[0].day} className="flex min-w-2.5 flex-1 flex-col gap-[3px]">
                {week.map((cell) => (
                  <div
                    key={cell.day}
                    title={cell.inRange ? cellLabel(cell) : undefined}
                    className={cn(
                      "dash-cell aspect-square w-full max-w-5 rounded-[3px]",
                      !cell.inRange && "opacity-0",
                    )}
                    style={{ background: LEVEL_BG[intensity(cell.amount, max)] }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="text-muted-foreground flex items-center justify-end gap-1.5 text-xs"
        aria-hidden
      >
        {t.calendar.less}
        {LEVEL_BG.map((background, index) => (
          <span key={index} className="size-3 rounded-[3px]" style={{ background }} />
        ))}
        {t.calendar.more}
      </div>

      <figure className="flex flex-col gap-2">
        <figcaption className="text-muted-foreground text-xs font-medium">
          {t.calendar.rhythm}
        </figcaption>
        <ul className="grid grid-cols-7 items-end gap-1.5">
          {rhythm.map((row) => {
            const mean = row.days > 0 ? row.total / row.days : 0;
            const height = rhythmMax > 0 ? Math.max(4, (mean / rhythmMax) * 64) : 4;
            return (
              <li key={row.weekday} className="flex flex-col items-center gap-1">
                <span className="sr-only">
                  {t.weekdays[row.weekday]}: {formatCurrency(mean)}
                </span>
                <span
                  aria-hidden
                  className="text-muted-foreground text-[10px] tabular-nums sm:text-xs"
                >
                  {mean > 0 ? formatCompactCurrency(mean) : "–"}
                </span>
                <span
                  aria-hidden
                  className="dash-bar w-full rounded-md"
                  style={{
                    height,
                    background:
                      mean === rhythmMax && mean > 0 ? "var(--chart-1)" : "var(--chart-2)",
                    opacity: mean === rhythmMax ? 1 : 0.7,
                  }}
                />
                <span aria-hidden className="text-muted-foreground text-xs">
                  {t.weekdaysShort[row.weekday]}
                </span>
              </li>
            );
          })}
        </ul>
      </figure>
    </ChartCard>
  );
}
