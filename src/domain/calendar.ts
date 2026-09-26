// Datas e horas como texto local ("2026-09-28", "08:30"): a clínica tem um só fuso,
// e texto evita que o fuso da máquina mude o resultado de um cenário.

export type Weekday = "dom" | "seg" | "ter" | "qua" | "qui" | "sex" | "sab";

const WEEKDAYS: Weekday[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

export const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface Instant {
  date: string;
  time: string;
}

function toUTC(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function weekdayOf(date: string): Weekday {
  return WEEKDAYS[toUTC(date).getUTCDay()];
}

export function addDays(date: string, days: number): string {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// A regex aceita "2027-02-31"; o Date a empurraria para março, e o bloqueio de horário
// compararia datas diferentes para o mesmo instante.
export function isValidDate(date: string): boolean {
  return DATE.test(date) && addDays(date, 0) === date;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUTC(to).getTime() - toUTC(from).getTime()) / 86_400_000);
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function isBefore(a: Instant, b: Instant): boolean {
  return a.date < b.date || (a.date === b.date && a.time < b.time);
}
