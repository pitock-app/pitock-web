import { describe, expect, it } from "vitest";
import {
  findRecurring,
  forecastMonth,
  forecastRange,
  type DailySpend,
} from "@/features/dashboard/lib/forecast";

const spend = (day: string, amount: number, merchant: string | null = "Supermercato") => ({
  day,
  amount,
  merchant,
});

/** Un mese "pieno": 30 € al giorno per tutti i giorni del mese. */
function steadyMonth(prefix: string, days: number, perDay: number): DailySpend[] {
  return Array.from({ length: days }, (_, index) =>
    spend(`${prefix}-${String(index + 1).padStart(2, "0")}`, perDay),
  );
}

describe("previsione del mese", () => {
  it("senza storico proietta il ritmo del mese in corso ed è una stima indicativa", () => {
    const f = forecastMonth([spend("2026-10-01", 20), spend("2026-10-04", 40)], "2026-10-05");
    // 60 € in 5 giorni = 12 €/giorno; mancano 26 giorni: 60 + 12 × 26 = 372.
    expect(f.spent).toBe(60);
    expect(f.currentDailyRate).toBe(12);
    expect(f.historyDailyRate).toBeNull();
    expect(f.currentWeight).toBe(1);
    expect(f.projected).toBe(372);
    expect(f.reliability).toBe("low");
    expect(f.averageMonthTotal).toBeNull();
    expect(f.previousMonthTotal).toBeNull();
  });

  it("a inizio mese pesa soprattutto lo storico, poi sempre più il mese in corso", () => {
    // Storico: luglio, agosto, settembre a 10 €/giorno (ago 31 gg, set 30 gg, lug 31 gg).
    const history = [
      ...steadyMonth("2026-07", 31, 10),
      ...steadyMonth("2026-08", 31, 10),
      ...steadyMonth("2026-09", 30, 10),
    ];
    // Ottobre: 100 € il primo giorno, poi niente.
    const early = forecastMonth([...history, spend("2026-10-01", 100)], "2026-10-02");
    expect(early.historyDailyRate).toBe(10);
    expect(early.currentDailyRate).toBe(50);
    // Peso 2/31: ritmo = 2/31 × 50 + 29/31 × 10 = 12,58; 100 + 12,58 × 29 = 464,84.
    expect(early.dailyRate).toBeCloseTo(12.58, 2);
    expect(early.projected).toBeCloseTo(100 + ((2 / 31) * 50 + (29 / 31) * 10) * 29, 2);
    expect(early.reliability).toBe("medium");
    expect(early.averageMonthTotal).toBeCloseTo((310 + 310 + 300) / 3, 2);
    expect(early.previousMonthTotal).toBe(300);

    const late = forecastMonth([...history, spend("2026-10-01", 100)], "2026-10-30");
    // A fine mese il ritmo è quasi tutto quello di ottobre (100 / 30 €/giorno).
    expect(late.currentWeight).toBeCloseTo(30 / 31, 5);
    expect(late.reliability).toBe("good");
    expect(late.projected).toBeCloseTo(100 + ((30 / 31) * (100 / 30) + (1 / 31) * 10), 2);
  });

  it("i mesi prima del primo scontrino non contano come zero", () => {
    const f = forecastMonth(
      [...steadyMonth("2026-09", 30, 10), spend("2026-10-10", 50)],
      "2026-10-10",
    );
    expect(f.historyMonths).toBe(1);
    expect(f.historyDailyRate).toBe(10);
    expect(f.averageMonthTotal).toBe(300);
  });

  it("un primo mese iniziato a metà conta solo dal primo scontrino e resta fuori dalla media", () => {
    // Primo scontrino il 24 settembre: 7 giorni di storico (24–30), 70 € = 10 €/giorno.
    const f = forecastMonth(
      [spend("2026-09-24", 35), spend("2026-09-28", 35), spend("2026-10-01", 50)],
      "2026-10-05",
    );
    expect(f.historyDailyRate).toBe(10);
    expect(f.averageMonthTotal).toBeNull();
    expect(f.averageMonths).toBe(0);
    expect(f.previousMonthTotal).toBe(70);
    const rate = (5 / 31) * (50 / 5) + (26 / 31) * 10;
    expect(f.projected).toBeCloseTo(50 + rate * 26, 2);
  });

  it("aggiunge per intero le spese ricorrenti non ancora arrivate, fuori dal ritmo giornaliero", () => {
    const gym = (month: string, amount = 40) => spend(`${month}-08`, amount, "Palestra");
    const history = [
      ...steadyMonth("2026-07", 31, 10),
      ...steadyMonth("2026-08", 31, 10),
      ...steadyMonth("2026-09", 30, 10),
      gym("2026-07"),
      gym("2026-08", 42),
      gym("2026-09"),
    ];
    const before = forecastMonth([...history, spend("2026-10-01", 10)], "2026-10-05");
    expect(before.pendingRecurring).toEqual([{ merchant: "Palestra", amount: 40 }]);
    // La palestra non entra nel ritmo dello storico: resta 10 €/giorno.
    expect(before.historyDailyRate).toBe(10);
    const rate = (5 / 31) * (10 / 5) + (26 / 31) * 10;
    expect(before.projected).toBeCloseTo(10 + rate * 26 + 40, 2);
    // La proiezione arriva al totale previsto l'ultimo giorno e parte dallo speso di oggi.
    expect(before.series[4]).toEqual({ day: 5, actual: 10, projected: 10 });
    expect(before.series.at(-1)?.projected).toBeCloseTo(before.projected, 1);
    expect(before.series.at(-1)?.actual).toBeNull();

    const after = forecastMonth([...history, gym("2026-10")], "2026-10-09");
    expect(after.pendingRecurring).toEqual([]);
    expect(after.spent).toBe(40);
  });

  it("riconosce come ricorrenti solo pagamenti mensili unici con importo stabile", () => {
    const months = ["2026-07", "2026-08", "2026-09"];
    const recurring = findRecurring(
      [
        spend("2026-07-01", 50, "Enel"),
        spend("2026-08-01", 52, "Enel"),
        spend("2026-09-01", 49, "Enel"),
        // Importo troppo variabile.
        spend("2026-07-02", 10, "Benzina"),
        spend("2026-08-02", 80, "Benzina"),
        spend("2026-09-02", 30, "Benzina"),
        // Più volte al mese: è spesa variabile.
        spend("2026-07-03", 20, "Bar"),
        spend("2026-07-04", 20, "Bar"),
        spend("2026-08-03", 20, "Bar"),
        spend("2026-09-03", 20, "Bar"),
        // Manca in un mese.
        spend("2026-07-05", 15, "Netflix"),
        spend("2026-09-05", 15, "Netflix"),
      ],
      months,
    );
    expect([...recurring.values()]).toEqual([{ merchant: "Enel", amount: 50 }]);
  });

  it("ignora le spese dopo oggi e fuori dallo storico", () => {
    const f = forecastMonth(
      [spend("2026-10-01", 10), spend("2026-10-20", 999), spend("2025-01-01", 999)],
      "2026-10-01",
    );
    expect(f.spent).toBe(10);
    expect(f.historyMonths).toBe(0);
  });
});

describe("previsione del periodo", () => {
  const gym = (month: string, amount = 40) => spend(`${month}-08`, amount, "Palestra");
  // Storico: luglio–settembre a 10 €/giorno, più la palestra (ricorrente) ogni mese.
  const history = [
    ...steadyMonth("2026-07", 31, 10),
    ...steadyMonth("2026-08", 31, 10),
    ...steadyMonth("2026-09", 30, 10),
    gym("2026-07"),
    gym("2026-08", 42),
    gym("2026-09"),
    spend("2026-10-01", 10),
  ];
  const today = "2026-10-05";
  const inRange = (from: string, to: string) => history.filter((s) => s.day >= from && s.day <= to);

  it("sul mese in corso coincide con la previsione del mese", () => {
    const range = { from: "2026-10-01", to: "2026-10-31" };
    const f = forecastRange(inRange(range.from, range.to), history, range, today);
    const month = forecastMonth(history, today);
    expect(f.hasProjection).toBe(true);
    expect(f.spent).toBe(10);
    expect(f.projected).toBeCloseTo(month.projected, 1);
    expect(f.series).toHaveLength(31);
    expect(f.series[4]).toEqual({ day: "2026-10-05", actual: 10, projected: 10 });
    expect(f.series[5].actual).toBeNull();
    expect(f.series.at(-1)?.projected).toBeCloseTo(f.projected, 1);
    expect(f.month).not.toBeNull();
    expect(f.futureMonths).toBe(0);
    expect(f.previousMonthTotal).toBe(340);
  });

  it("sull'anno aggiunge i mesi futuri al ritmo dello storico, con le ricorrenti", () => {
    const range = { from: "2026-01-01", to: "2026-12-31" };
    const f = forecastRange(inRange(range.from, range.to), history, range, today);
    const month = forecastMonth(history, today);
    // Speso: luglio–settembre con la palestra, più il 1° ottobre.
    expect(f.spent).toBe(310 + 40 + 310 + 42 + 300 + 40 + 10);
    expect(f.futureMonths).toBe(2);
    expect(f.futureDailyRate).toBe(10);
    expect(f.recurring).toEqual([{ merchant: "Palestra", amount: 40 }]);
    // Novembre (30 gg) e dicembre (31 gg) a 10 €/giorno, più 40 € di palestra ciascuno.
    const future = 30 * 10 + 40 + 31 * 10 + 40;
    expect(f.projected).toBeCloseTo(f.spent + (month.projected - month.spent) + future, 1);
    expect(f.series).toHaveLength(365);
    expect(f.averageTotal).toBeCloseTo(12 * (month.averageMonthTotal ?? 0), 1);
    expect(f.previousMonthTotal).toBeNull();
  });

  it("su un periodo finito mostra solo la spesa reale", () => {
    const range = { from: "2026-09-01", to: "2026-09-30" };
    const f = forecastRange(inRange(range.from, range.to), history, range, today);
    expect(f.hasProjection).toBe(false);
    expect(f.spent).toBe(340);
    expect(f.projected).toBe(340);
    expect(f.reliability).toBeNull();
    expect(f.month).toBeNull();
    expect(f.series.every((row) => row.projected === null)).toBe(true);
    expect(f.series.at(-1)?.actual).toBe(340);
    expect(f.previousMonthTotal).toBe(352);
  });

  it("su un periodo futuro è tutta previsione, da zero", () => {
    const range = { from: "2026-11-01", to: "2026-11-30" };
    const f = forecastRange([], history, range, today);
    expect(f.elapsedDays).toBe(0);
    expect(f.spent).toBe(0);
    expect(f.projected).toBeCloseTo(30 * 10 + 40, 1);
    expect(f.series[0]).toEqual({ day: "2026-11-01", actual: null, projected: 11.33 });
    expect(f.month).toBeNull();
    expect(f.previousMonthTotal).toBeNull();
  });
});
