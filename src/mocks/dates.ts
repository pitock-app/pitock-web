import { romeLocalInputToIso } from "@/lib/format";

// Date delle query come nel backend (`shared/dates.ts`): fuso di Roma, fine esclusiva.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?)?$/i;

/** Vero se anno, mese e giorno esistono (rifiuta per esempio il 30 febbraio). */
function isRealDate(value: string): boolean {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Istante di una data ISO; senza scarto vale l'ora di Roma, come nel backend. */
export function parseInstant(value: string): number | null {
  if (value.length > 40 || !ISO.test(value) || !isRealDate(value)) return null;
  if (DATE_ONLY.test(value)) {
    const iso = romeLocalInputToIso(`${value}T00:00`);
    return iso ? Date.parse(iso) : null;
  }
  // Senza fuso: ora di Roma (i decimali dei secondi non cambiano il giorno né l'ora).
  const iso = /(Z|[+-]\d{2}:?\d{2})$/i.test(value)
    ? value
    : romeLocalInputToIso(value.replace(/\.\d+$/, ""));
  const at = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(at) ? null : at;
}

/** Fine esclusiva: con la sola data comprende l'intera giornata, altrimenti l'istante indicato. */
export function parseRangeEnd(value: string): number | null {
  if (!DATE_ONLY.test(value)) {
    const at = parseInstant(value);
    return at === null ? null : at + 1;
  }
  if (parseInstant(value) === null) return null;
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return parseInstant(next);
}
