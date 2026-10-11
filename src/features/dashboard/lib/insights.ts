import { addDays } from "@/lib/period";
import type { CategoryLine } from "./dataset";
import type { Category, ProductStats, ReceiptFact } from "./products";

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Giorno della settimana di un giorno YYYY-MM-DD: 0 = lunedì … 6 = domenica. */
export function weekdayOf(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return (new Date(Date.UTC(year, month - 1, date)).getUTCDay() + 6) % 7;
}

/** Spesa di ogni giorno con almeno una voce, dalle voci di spesa del periodo. */
export function dailyTotals(lines: CategoryLine[]): Map<string, number> {
  const days = new Map<string, number>();
  for (const line of lines) days.set(line.day, (days.get(line.day) ?? 0) + line.amount);
  for (const [day, amount] of days) days.set(day, round2(amount));
  return days;
}

export type CalendarCell = { day: string; amount: number; inRange: boolean };

/**
 * Calendario della spesa: settimane (colonne) da lunedì a domenica che coprono tutti i giorni
 * da `from` a `to`. I giorni fuori dal periodo completano solo la prima e l'ultima settimana.
 */
export function spendingCalendar(daily: Map<string, number>, from: string, to: string) {
  const start = addDays(from, -weekdayOf(from));
  const end = addDays(to, 6 - weekdayOf(to));
  const weeks: CalendarCell[][] = [];
  let max = 0;
  for (let day = start; day <= end; day = addDays(day, 1)) {
    if (weekdayOf(day) === 0) weeks.push([]);
    const inRange = day >= from && day <= to;
    const amount = inRange ? (daily.get(day) ?? 0) : 0;
    max = Math.max(max, amount);
    weeks[weeks.length - 1].push({ day, amount, inRange });
  }
  return { weeks, max };
}

/** Livello di intensità 0–4 di un giorno rispetto al massimo, su scala a radice (code lunghe). */
export function intensity(amount: number, max: number): number {
  if (amount <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil(Math.sqrt(amount / max) * 4)));
}

/** Spesa media e numero di giorni con spese per giorno della settimana (lun…dom). */
export function weekdayRhythm(daily: Map<string, number>) {
  const rows = Array.from({ length: 7 }, (_, weekday) => ({ weekday, total: 0, days: 0 }));
  for (const [day, amount] of daily) {
    const row = rows[weekdayOf(day)];
    row.total += amount;
    row.days += 1;
  }
  return rows.map((row) => ({ ...row, total: round2(row.total) }));
}

export type FlowData = {
  nodes: { name: string; kind: "store" | "category"; category?: Category; store?: string }[];
  links: { source: number; target: number; value: number }[];
};

/**
 * Flusso della spesa da negozio a categoria: i negozi con la spesa più alta (gli altri in
 * "Altri negozi") e le categorie in cui si dividono. Solo importi positivi.
 */
export function spendingFlow(
  lines: CategoryLine[],
  labels: { otherStores: string; noStore: string },
  maxStores = 6,
): FlowData {
  const byStore = new Map<string, number>();
  for (const line of lines) {
    if (line.amount <= 0) continue;
    const store = line.merchant ?? labels.noStore;
    byStore.set(store, (byStore.get(store) ?? 0) + line.amount);
  }
  const ranked = [...byStore].sort((a, b) => b[1] - a[1]).map(([store]) => store);
  const kept = new Set(ranked.slice(0, ranked.length > maxStores + 1 ? maxStores : maxStores + 1));
  const storeOf = (line: CategoryLine) => {
    const store = line.merchant ?? labels.noStore;
    return kept.has(store) ? store : labels.otherStores;
  };

  const pairs = new Map<string, number>();
  const categories = new Map<Category, number>();
  for (const line of lines) {
    if (line.amount <= 0) continue;
    const key = `${storeOf(line)}\u0000${line.category}`;
    pairs.set(key, (pairs.get(key) ?? 0) + line.amount);
    categories.set(line.category, (categories.get(line.category) ?? 0) + line.amount);
  }
  const stores = [...ranked.filter((store) => kept.has(store))];
  if (ranked.some((store) => !kept.has(store))) stores.push(labels.otherStores);
  const categoryOrder = [...categories].sort((a, b) => b[1] - a[1]).map(([category]) => category);

  const nodes: FlowData["nodes"] = [
    ...stores.map((store) => ({ name: store, kind: "store" as const, store })),
    ...categoryOrder.map((category) => ({ name: category, kind: "category" as const, category })),
  ];
  const links: FlowData["links"] = [];
  for (const [key, value] of pairs) {
    const [store, category] = key.split("\u0000");
    links.push({
      source: stores.indexOf(store),
      target: stores.length + categoryOrder.indexOf(category as Category),
      value: round2(value),
    });
  }
  return { nodes, links: links.filter((link) => link.value > 0) };
}

/**
 * Inflazione personale: variazione media dei prezzi dei prodotti comprati più volte, pesata
 * sulla spesa di ciascuno. Null senza prodotti confrontabili.
 */
export function personalInflation(products: ProductStats[]) {
  const tracked = products.filter(
    (p): p is ProductStats & { priceChange: number } => p.priceChange !== null,
  );
  const weight = tracked.reduce((sum, p) => sum + p.totalSpent, 0);
  if (tracked.length === 0 || weight <= 0) return null;
  const rate = tracked.reduce((sum, p) => sum + p.priceChange * p.totalSpent, 0) / weight;
  const byChange = [...tracked].sort((a, b) => b.priceChange - a.priceChange);
  return {
    rate,
    tracked: tracked.length,
    up: tracked.filter((p) => p.priceChange >= 0.5).length,
    down: tracked.filter((p) => p.priceChange <= -0.5).length,
    /** Quanto costa in più (o in meno) oggi la stessa spesa ai prezzi dell'ultimo acquisto. */
    impact: round2(
      tracked.reduce(
        (sum, p) => sum + (p.firstPrice > 0 ? p.totalSpent * (p.priceChange / 100) : 0),
        0,
      ),
    ),
    risers: byChange.filter((p) => p.priceChange >= 0.5).slice(0, 3),
    fallers: byChange
      .filter((p) => p.priceChange <= -0.5)
      .reverse()
      .slice(0, 3),
  };
}

export type PersonalInflation = NonNullable<ReturnType<typeof personalInflation>>;

/** I momenti del periodo: record e abitudini, per le card in evidenza. */
export function periodHighlights(
  receipts: ReceiptFact[],
  amounts: Map<string, number>,
  lines: CategoryLine[],
  products: ProductStats[],
) {
  const biggest = receipts.reduce<{ receipt: ReceiptFact; amount: number } | null>(
    (best, receipt) => {
      const amount = amounts.get(receipt.id) ?? 0;
      return !best || amount > best.amount ? { receipt, amount } : best;
    },
    null,
  );

  const visits = new Map<string, number>();
  for (const receipt of receipts) {
    const name = receipt.merchantName?.trim();
    if (name) visits.set(name, (visits.get(name) ?? 0) + 1);
  }
  const favorite = [...visits].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  const daily = dailyTotals(lines);
  const topDay = [...daily].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const rhythm = weekdayRhythm(daily);
  const topWeekday = [...rhythm].sort((a, b) => b.total - a.total)[0];
  const weekdayTotal = rhythm.reduce((sum, row) => sum + row.total, 0);

  const mostBought = [...products].sort(
    (a, b) => b.purchases - a.purchases || b.totalSpent - a.totalSpent,
  )[0];

  return {
    biggest:
      biggest && biggest.amount > 0
        ? {
            amount: round2(biggest.amount),
            merchant: biggest.receipt.merchantName?.trim() || null,
            date: biggest.receipt.date,
            receiptId: biggest.receipt.id,
          }
        : null,
    favorite: favorite ? { merchant: favorite[0], visits: favorite[1] } : null,
    topDay: topDay && topDay[1] > 0 ? { day: topDay[0], amount: topDay[1] } : null,
    topWeekday:
      topWeekday && topWeekday.total > 0 && weekdayTotal > 0
        ? { weekday: topWeekday.weekday, share: (topWeekday.total / weekdayTotal) * 100 }
        : null,
    mostBought:
      mostBought && mostBought.purchases > 1
        ? { label: mostBought.label, purchases: mostBought.purchases }
        : null,
    activeDays: daily.size,
  };
}

export type PeriodHighlights = ReturnType<typeof periodHighlights>;
