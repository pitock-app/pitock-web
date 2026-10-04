/** Formattazione di importi, date e numeri: locale it-IT, fuso Europe/Rome. */
export const LOCALE = "it-IT";
export const TIME_ZONE = "Europe/Rome";

export function formatCurrency(amount: number, currency = "EUR"): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(amount);
  } catch {
    // Codice valuta non riconosciuto da Intl.
    return `${formatNumber(amount, 2)} ${currency}`;
  }
}

export function formatNumber(value: number, fractionDigits?: number): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits ?? 3,
  }).format(value);
}

/**
 * Giorno breve ("4 ott") da una data YYYY-MM-DD che è già un giorno del calendario di Roma:
 * si formatta in UTC per non spostarla di nuovo con il fuso.
 */
export function formatShortDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

/** Numero compatto per gli assi dei grafici ("12,3 Mln"). */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

/** Importo compatto per gli assi dei grafici ("12 €", "1,2 Mila €"). */
export function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    // Sotto i 10 € servono i centesimi: altrimenti 1,35 e 1,40 diventano entrambi "1,4 €".
    maximumFractionDigits: Math.abs(value) < 10 ? 2 : 0,
  }).format(value);
}

/** Numero di token con il separatore delle migliaia ("12.345"). */
export function formatTokens(value: number): string {
  return formatNumber(Math.round(value), 0);
}

/** Costo in dollari: più decimali per le cifre sotto il centesimo (es. "0,0021 USD"). */
export function formatUsd(amount: number): string {
  const digits = amount > 0 && amount < 0.01 ? 4 : 2;
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

/** Importo per un campo di input: virgola decimale, senza separatore delle migliaia. */
export function formatAmountInput(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeZone: TIME_ZONE }).format(
    new Date(iso),
  );
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${formatNumber(Math.max(1, Math.round(bytes / 1024)), 0)} KB`;
  return `${formatNumber(bytes / (1024 * 1024), 1)} MB`;
}

const AMOUNT_PATTERN = /^-?(\d+|\d{1,3}(\.\d{3})+)(,\d+)?$/;
const DOT_DECIMAL_PATTERN = /^-?\d+\.\d+$/;

/**
 * Converte un numero scritto in formato italiano ("1.234,56", "12,5") in number.
 * Senza virgola, un punto seguito da gruppi di 3 cifre è il separatore delle migliaia
 * ("1.234" = 1234); altrimenti è il separatore decimale ("12.5" = 12,5).
 * Restituisce null se il testo non è un numero.
 */
export function parseItalianNumber(input: string): number | null {
  const text = input.trim().replace(/\s|€/g, "");
  if (!text) return null;
  if (AMOUNT_PATTERN.test(text)) {
    return Number(text.replace(/\./g, "").replace(",", "."));
  }
  if (DOT_DECIMAL_PATTERN.test(text)) return Number(text);
  return null;
}

/** Numero di cifre decimali di un numero scritto in formato italiano. */
export function decimalPlaces(input: string): number {
  const text = input.trim().replace(/\s|€/g, "");
  if (text.includes(",")) return text.length - text.lastIndexOf(",") - 1;
  // "1.234" è un migliaio, non un decimale.
  if (AMOUNT_PATTERN.test(text) || !DOT_DECIMAL_PATTERN.test(text)) return 0;
  return text.length - text.lastIndexOf(".") - 1;
}

function partsInRome(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Scarto in minuti di Europe/Rome rispetto a UTC in un dato istante (60 o 120). */
function romeOffsetMinutes(date: Date): number {
  const p = partsInRome(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Data di Roma nel formato di `<input type="date">` ("2026-10-04"). */
export function toRomeDateInput(date: Date = new Date()): string {
  const p = partsInRome(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Data e ora di Roma nel formato di `<input type="datetime-local">` ("2026-10-04T12:30"). */
export function toRomeLocalInput(date: Date = new Date()): string {
  const p = partsInRome(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Interpreta un valore di `datetime-local` come ora di Roma e lo converte in ISO 8601
 * con lo scarto esplicito ("2026-10-04T12:30:00+02:00"). Null se il valore non è valido.
 */
export function romeLocalInputToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0));
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  // Giorni che non esistono (es. 31 febbraio): Date.UTC li sposterebbe al mese dopo.
  if (Number.isNaN(asUtc) || new Date(asUtc).getUTCDate() !== day) return null;
  // Lo scarto dipende dall'istante: si stima e poi si corregge (cambio dell'ora legale).
  let offset = romeOffsetMinutes(new Date(asUtc));
  offset = romeOffsetMinutes(new Date(asUtc - offset * 60000));
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

const utcDay = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date));
};

/**
 * Periodo delle statistiche ("2026-10" o "2026", già nel calendario di Roma):
 * breve per gli assi ("ott 26"), lungo per tabelle e tooltip ("ottobre 2026").
 */
export function formatPeriodKey(key: string, style: "short" | "long" = "long"): string {
  if (!/^\d{4}-\d{2}$/.test(key)) return key;
  return new Intl.DateTimeFormat(LOCALE, {
    month: style,
    year: style === "short" ? "2-digit" : "numeric",
    timeZone: "UTC",
  }).format(utcDay(`${key}-01`));
}

/**
 * Intervallo di giorni YYYY-MM-DD del calendario di Roma ("1–4 set 2026"). Composto a mano:
 * `formatRange` di ICU in it-IT mette lo zero davanti ai giorni ("01–04 set 2026").
 */
export function formatDayRange(from: string, to: string): string {
  const format = (day: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" }).format(utcDay(day));
  const full = { day: "numeric", month: "short", year: "numeric" } as const;
  if (from === to) return format(from, full);
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8))}–${format(to, full)}`;
  if (from.slice(0, 4) === to.slice(0, 4)) {
    return `${format(from, { day: "numeric", month: "short" })} – ${format(to, full)}`;
  }
  return `${format(from, full)} – ${format(to, full)}`;
}

/** Quota percentuale senza segno ("42%", "12,5%"). */
export function formatShare(value: number, digits = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "percent",
    maximumFractionDigits: digits,
  }).format(value / 100);
}

/** Variazione percentuale con il segno ("+12,5%", "-3%", "0%"). */
export function formatPercentChange(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value / 100);
}
