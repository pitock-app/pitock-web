import { CalendarHeart, Crown, Flame, Repeat, Store, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { formatCurrency, formatDate, formatShare, formatShortDay } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { PeriodHighlights } from "./lib/insights";

const t = it.dashboard.highlights;

type Pill = {
  id: string;
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  /** Colore della serie che tinge la card. */
  tone: string;
  href?: string;
};

function pills(highlights: PeriodHighlights): Pill[] {
  const list: Pill[] = [];
  const { biggest, favorite, topDay, topWeekday, mostBought } = highlights;
  if (biggest) {
    list.push({
      id: "biggest",
      icon: Crown,
      label: t.biggest,
      value: formatCurrency(biggest.amount),
      detail: [biggest.merchant, formatDate(biggest.date)].filter(Boolean).join(" · "),
      tone: "var(--series-4)",
      href: routes.receipt(biggest.receiptId),
    });
  }
  if (favorite) {
    list.push({
      id: "favorite",
      icon: Store,
      label: t.favorite,
      value: favorite.merchant,
      detail: t.visits(favorite.visits),
      tone: "var(--series-1)",
    });
  }
  if (topDay) {
    list.push({
      id: "top-day",
      icon: Flame,
      label: t.topDay,
      value: formatShortDay(topDay.day),
      detail: formatCurrency(topDay.amount),
      tone: "var(--series-2)",
    });
  }
  if (topWeekday) {
    list.push({
      id: "top-weekday",
      icon: CalendarHeart,
      label: t.topWeekday,
      value: it.dashboard.weekdays[topWeekday.weekday],
      detail: t.weekdayShare(formatShare(topWeekday.share)),
      tone: "var(--series-5)",
    });
  }
  if (mostBought) {
    list.push({
      id: "most-bought",
      icon: Repeat,
      label: t.mostBought,
      value: mostBought.label,
      detail: t.times(mostBought.purchases),
      tone: "var(--series-6)",
    });
  }
  return list;
}

/**
 * I momenti del periodo in card colorate da scorrere: record, abitudini e preferenze, come un
 * riassunto da condividere.
 */
export function Highlights({ highlights }: { highlights: PeriodHighlights }) {
  const list = pills(highlights);
  if (list.length === 0) return null;
  return (
    <section aria-label={t.label} className="-mx-4 md:mx-0">
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:grid md:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] md:overflow-visible md:px-0 md:pb-0">
        {list.map((pill, index) => {
          const body = (
            <>
              <span
                className="flex size-9 items-center justify-center rounded-full"
                style={{ background: `color-mix(in oklab, ${pill.tone} 22%, transparent)` }}
              >
                <pill.icon className="size-4.5" style={{ color: pill.tone }} aria-hidden />
              </span>
              <span className="text-muted-foreground mt-3 text-xs font-medium">{pill.label}</span>
              <span className="mt-0.5 line-clamp-2 text-lg leading-tight font-semibold first-letter:uppercase">
                {pill.value}
              </span>
              <span className="text-muted-foreground mt-1 truncate text-xs">{pill.detail}</span>
            </>
          );
          const className = cn(
            "dash-pill animate-in fade-in slide-in-from-bottom-3 fill-mode-both relative flex h-full min-w-44 snap-start flex-col overflow-hidden rounded-2xl border p-4 duration-500 motion-reduce:animate-none md:min-w-0",
            pill.href &&
              "focus-visible:ring-ring/50 outline-none hover:-translate-y-0.5 focus-visible:ring-[3px]",
          );
          const style = {
            "--pill-tone": pill.tone,
            animationDelay: `${index * 70}ms`,
          } as CSSProperties;
          return (
            <li key={pill.id} className="shrink-0 md:shrink">
              {pill.href ? (
                <Link href={pill.href} className={className} style={style}>
                  {body}
                </Link>
              ) : (
                <div className={className} style={style}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
