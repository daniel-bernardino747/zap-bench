import { addDays, daysBetween, fromMinutes, isBefore, isValidDate, toMinutes, weekdayOf, type Instant } from "./calendar.ts";
import type { Establishment } from "./establishment.ts";

export interface Appointment {
  id: string;
  patientPhone: string;
  patientName: string;
  serviceId: string;
  professionalId: string;
  date: string;
  time: string;
  insurance: string | null;
  status: "booked" | "cancelled";
}

export interface Slot {
  date: string;
  time: string;
  professionalId: string;
}

// Erros viram resultado, não exceção: o cérebro precisa ler o motivo e se corrigir.
export type AgendaError =
  | "servico_desconhecido"
  | "profissional_desconhecido"
  | "profissional_nao_faz_servico"
  | "convenio_nao_aceito"
  | "servico_nao_coberto_pelo_convenio"
  | "data_invalida"
  | "data_muito_distante"
  | "horario_passado"
  | "fora_do_expediente"
  | "horario_ocupado"
  | "limite_de_agendamentos"
  | "agendamento_nao_encontrado"
  | "agendamento_ja_cancelado";

export type Result<T> = { ok: true; value: T } | { ok: false; error: AgendaError };

export interface FindSlotsQuery {
  serviceId: string;
  fromDate?: string;
  days?: number;
  professionalId?: string;
  after?: string;
  before?: string;
  limit?: number;
}

export interface BookRequest {
  patientPhone: string;
  patientName: string;
  serviceId: string;
  date: string;
  time: string;
  professionalId?: string;
  insurance?: string | null;
}

// Limites contra um paciente (ou um prompt injection) que tenta reservar a agenda inteira.
export interface AgendaLimits {
  maxActivePerPatient: number;
  horizonDays: number;
}

export const DEFAULT_LIMITS: AgendaLimits = { maxActivePerPatient: 3, horizonDays: 90 };

// Ids sequenciais por agenda, não aleatórios: uma execução gravada precisa se repetir igual.
// Não vazam nada entre pacientes, porque id de outro paciente é "não encontrado".
export class Agenda {
  private appointments: Appointment[] = [];
  private nextId = 1;

  constructor(
    readonly establishment: Establishment,
    private readonly now: Instant,
    seed: Omit<Appointment, "id" | "status">[] = [],
    private readonly limits: AgendaLimits = DEFAULT_LIMITS,
  ) {
    for (const a of seed) this.insert(a);
  }

  // Tudo que sai da agenda é cópia: quem recebe (o log da avaliação, um cérebro) não
  // consegue mudar a agenda, e a agenda não reescreve o que já foi registrado.
  get today(): string {
    return this.now.date;
  }

  list(): Appointment[] {
    return this.appointments.map(copy);
  }

  byPatient(patientPhone: string): Appointment[] {
    return this.active(patientPhone).map(copy);
  }

  findSlots(q: FindSlotsQuery): Result<Slot[]> {
    const service = this.service(q.serviceId);
    if (!service) return { ok: false, error: "servico_desconhecido" };
    if (q.professionalId && !this.professional(q.professionalId)) return { ok: false, error: "profissional_desconhecido" };
    if (q.professionalId && !service.professionalIds.includes(q.professionalId))
      return { ok: false, error: "profissional_nao_faz_servico" };
    if (q.fromDate && !isValidDate(q.fromDate)) return { ok: false, error: "data_invalida" };

    const professionals = q.professionalId ? [q.professionalId] : service.professionalIds;
    const from = q.fromDate && q.fromDate > this.now.date ? q.fromDate : this.now.date;
    const limit = q.limit ?? 6;
    const slots: Slot[] = [];

    for (let i = 0; i < (q.days ?? 7) && slots.length < limit; i++) {
      const date = addDays(from, i);
      if (!this.withinHorizon(date)) break;
      for (const time of this.startTimes(date, service.durationMinutes)) {
        if (q.after && time < q.after) continue;
        if (q.before && time >= q.before) continue;
        if (!isBefore(this.now, { date, time })) continue;
        const professionalId = professionals.find((p) => this.isFree(p, date, time, service.durationMinutes));
        if (professionalId) slots.push({ date, time, professionalId });
        if (slots.length >= limit) break;
      }
    }
    return { ok: true, value: slots };
  }

  book(r: BookRequest): Result<Appointment> {
    if (this.active(r.patientPhone).length >= this.limits.maxActivePerPatient)
      return { ok: false, error: "limite_de_agendamentos" };
    const checked = this.check(r.serviceId, r.date, r.time, r.professionalId, r.insurance ?? null);
    if (!checked.ok) return checked;
    return {
      ok: true,
      value: copy(
        this.insert({
          patientPhone: r.patientPhone,
          patientName: r.patientName,
          serviceId: r.serviceId,
          professionalId: checked.value,
          date: r.date,
          time: r.time,
          insurance: r.insurance ?? null,
        }),
      ),
    };
  }

  reschedule(patientPhone: string, id: string, date: string, time: string, professionalId?: string): Result<Appointment> {
    const a = this.own(patientPhone, id);
    if (!a.ok) return a;
    const checked = this.check(a.value.serviceId, date, time, professionalId, a.value.insurance, a.value.id);
    if (!checked.ok) return checked;
    Object.assign(a.value, { date, time, professionalId: checked.value });
    return { ok: true, value: copy(a.value) };
  }

  cancel(patientPhone: string, id: string): Result<Appointment> {
    const a = this.own(patientPhone, id);
    if (!a.ok) return a;
    a.value.status = "cancelled";
    return { ok: true, value: copy(a.value) };
  }

  private active(patientPhone: string): Appointment[] {
    return this.appointments.filter(
      (a) => a.patientPhone === patientPhone && a.status === "booked" && !isBefore(a, this.now),
    );
  }

  private insert(a: Omit<Appointment, "id" | "status">): Appointment {
    const appointment: Appointment = { ...a, id: `ag-${this.nextId++}`, status: "booked" };
    this.appointments.push(appointment);
    return appointment;
  }

  // Um paciente só enxerga os próprios agendamentos: id de outro paciente é "não encontrado".
  private own(patientPhone: string, id: string): Result<Appointment> {
    const a = this.appointments.find((x) => x.id === id && x.patientPhone === patientPhone);
    if (!a) return { ok: false, error: "agendamento_nao_encontrado" };
    if (a.status === "cancelled") return { ok: false, error: "agendamento_ja_cancelado" };
    if (isBefore(a, this.now)) return { ok: false, error: "horario_passado" };
    return { ok: true, value: a };
  }

  // Valida o pedido e devolve o profissional escolhido.
  private check(
    serviceId: string,
    date: string,
    time: string,
    professionalId: string | undefined,
    insurance: string | null,
    ignoreId?: string,
  ): Result<string> {
    const service = this.service(serviceId);
    if (!service) return { ok: false, error: "servico_desconhecido" };
    if (professionalId && !this.professional(professionalId)) return { ok: false, error: "profissional_desconhecido" };
    if (professionalId && !service.professionalIds.includes(professionalId))
      return { ok: false, error: "profissional_nao_faz_servico" };
    if (insurance !== null) {
      if (!this.establishment.insurances.includes(insurance)) return { ok: false, error: "convenio_nao_aceito" };
      if (!service.coveredByInsurance) return { ok: false, error: "servico_nao_coberto_pelo_convenio" };
    }
    if (!isValidDate(date)) return { ok: false, error: "data_invalida" };
    if (!isBefore(this.now, { date, time })) return { ok: false, error: "horario_passado" };
    if (!this.withinHorizon(date)) return { ok: false, error: "data_muito_distante" };
    if (!this.startTimes(date, service.durationMinutes).includes(time)) return { ok: false, error: "fora_do_expediente" };

    const candidates = professionalId ? [professionalId] : service.professionalIds;
    const free = candidates.find((p) => this.isFree(p, date, time, service.durationMinutes, ignoreId));
    return free ? { ok: true, value: free } : { ok: false, error: "horario_ocupado" };
  }

  private withinHorizon(date: string): boolean {
    return daysBetween(this.now.date, date) <= this.limits.horizonDays;
  }

  private startTimes(date: string, durationMinutes: number): string[] {
    const day = weekdayOf(date);
    const step = this.establishment.slotMinutes;
    const times: string[] = [];
    for (const h of this.establishment.hours.filter((h) => h.days.includes(day))) {
      for (let m = toMinutes(h.open); m + durationMinutes <= toMinutes(h.close); m += step) times.push(fromMinutes(m));
    }
    return times;
  }

  private isFree(professionalId: string, date: string, time: string, durationMinutes: number, ignoreId?: string): boolean {
    const start = toMinutes(time);
    const end = start + durationMinutes;
    return !this.appointments.some((a) => {
      if (a.id === ignoreId || a.status !== "booked" || a.professionalId !== professionalId || a.date !== date) return false;
      const aStart = toMinutes(a.time);
      const aEnd = aStart + (this.service(a.serviceId)?.durationMinutes ?? 0);
      return start < aEnd && aStart < end;
    });
  }

  private service(id: string) {
    return this.establishment.services.find((s) => s.id === id);
  }

  private professional(id: string) {
    return this.establishment.professionals.find((p) => p.id === id);
  }
}

function copy(a: Appointment): Appointment {
  return { ...a };
}
