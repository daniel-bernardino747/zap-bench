import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { Agenda } from "./agenda.ts";
import { clinicNow, weekdayOf } from "./calendar.ts";
import { loadEstablishment, type Establishment } from "./establishment.ts";

let clinic: Establishment;
beforeAll(async () => {
  clinic = await loadEstablishment(
    fileURLToPath(new URL("../../establishments/clinica-odontologica.json", import.meta.url)),
  );
});

// Segunda-feira, 28/09/2026, 09:10.
const now = { date: "2026-09-28", time: "09:10" };
const maria = { patientPhone: "5548999990001", patientName: "Maria" };
const joao = { patientPhone: "5548999990002", patientName: "João" };

function values<T>(r: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe("calendário", () => {
  it("sabe o dia da semana de uma data", () => {
    expect(weekdayOf("2026-09-28")).toBe("seg");
    expect(weekdayOf("2026-10-03")).toBe("sab");
    expect(weekdayOf("2026-10-04")).toBe("dom");
  });

  it("usa o relógio da clínica, não o do servidor", () => {
    // 02:50 UTC de sexta ainda é 23:50 de quinta em São Paulo.
    expect(clinicNow(new Date("2026-10-02T02:50:00Z"), "America/Sao_Paulo")).toEqual({ date: "2026-10-01", time: "23:50" });
  });
});

describe("buscar horários", () => {
  it("não oferece horário que já passou", () => {
    const slots = values(new Agenda(clinic, now).findSlots({ serviceId: "limpeza", days: 1 }));
    expect(slots[0]).toEqual({ date: "2026-09-28", time: "09:30", professionalId: "ana" });
  });

  it("não oferece horário em que o serviço termina depois do fechamento", () => {
    const slots = values(new Agenda(clinic, now).findSlots({ serviceId: "canal", fromDate: "2026-10-03", days: 1, limit: 20 }));
    expect(slots.map((s) => s.time)).toEqual(["08:00", "08:30", "09:00", "09:30", "10:00", "10:30"]);
  });

  it("não oferece nada no domingo", () => {
    const slots = values(new Agenda(clinic, now).findSlots({ serviceId: "avaliacao", fromDate: "2026-10-04", days: 1 }));
    expect(slots).toEqual([]);
  });

  it("filtra pelo período do dia", () => {
    const slots = values(
      new Agenda(clinic, now).findSlots({ serviceId: "limpeza", fromDate: "2026-09-29", days: 1, after: "14:00", limit: 2 }),
    );
    expect(slots.map((s) => s.time)).toEqual(["14:00", "14:30"]);
  });

  it("pula o horário de um profissional ocupado e oferece outro que faz o serviço", () => {
    const agenda = new Agenda(clinic, now, [
      { ...joao, serviceId: "avaliacao", professionalId: "ana", date: "2026-09-29", time: "08:00", insurance: null },
    ]);
    const slots = values(agenda.findSlots({ serviceId: "avaliacao", fromDate: "2026-09-29", days: 1, limit: 1 }));
    expect(slots[0]).toEqual({ date: "2026-09-29", time: "08:00", professionalId: "bruno" });
  });

  it("recusa profissional que não faz o serviço", () => {
    expect(new Agenda(clinic, now).findSlots({ serviceId: "canal", professionalId: "bruno" })).toEqual({
      ok: false,
      error: "profissional_nao_faz_servico",
    });
  });
});

describe("agendar", () => {
  it("agenda num horário livre", () => {
    const agenda = new Agenda(clinic, now);
    const a = values(agenda.book({ ...maria, serviceId: "limpeza", date: "2026-09-29", time: "10:00", insurance: "OdontoPrev" }));
    expect(a).toMatchObject({ id: "ag-1", professionalId: "ana", status: "booked" });
    expect(agenda.byPatient(maria.patientPhone)).toHaveLength(1);
  });

  it("não deixa dois pacientes no mesmo horário do mesmo profissional, contando a duração", () => {
    const agenda = new Agenda(clinic, now);
    values(agenda.book({ ...maria, serviceId: "restauracao", date: "2026-09-29", time: "10:00" }));
    expect(agenda.book({ ...joao, serviceId: "limpeza", date: "2026-09-29", time: "10:30" })).toEqual({
      ok: false,
      error: "horario_ocupado",
    });
  });

  it("recusa convênio que a clínica não aceita e serviço que o convênio não cobre", () => {
    const agenda = new Agenda(clinic, now);
    const base = { ...maria, date: "2026-09-29", time: "10:00" };
    expect(agenda.book({ ...base, serviceId: "limpeza", insurance: "Unimed" })).toMatchObject({ error: "convenio_nao_aceito" });
    expect(agenda.book({ ...base, serviceId: "clareamento", insurance: "OdontoPrev" })).toMatchObject({
      error: "servico_nao_coberto_pelo_convenio",
    });
  });

  it("recusa horário passado, fora do expediente e fora da grade", () => {
    const agenda = new Agenda(clinic, now);
    const base = { ...maria, serviceId: "limpeza" };
    expect(agenda.book({ ...base, date: "2026-09-28", time: "09:00" })).toMatchObject({ error: "horario_passado" });
    expect(agenda.book({ ...base, date: "2026-09-29", time: "18:00" })).toMatchObject({ error: "fora_do_expediente" });
    expect(agenda.book({ ...base, date: "2026-09-29", time: "10:15" })).toMatchObject({ error: "fora_do_expediente" });
  });
});

describe("remarcar e cancelar", () => {
  it("remarca sem colidir com o próprio horário antigo", () => {
    const agenda = new Agenda(clinic, now);
    const a = values(agenda.book({ ...maria, serviceId: "restauracao", date: "2026-09-29", time: "10:00" }));
    const moved = values(agenda.reschedule(maria.patientPhone, a.id, "2026-09-29", "10:30"));
    expect(moved).toMatchObject({ id: a.id, time: "10:30" });
  });

  it("não deixa um paciente mexer no agendamento de outro", () => {
    const agenda = new Agenda(clinic, now);
    const a = values(agenda.book({ ...maria, serviceId: "limpeza", date: "2026-09-29", time: "10:00" }));
    expect(agenda.cancel(joao.patientPhone, a.id)).toEqual({ ok: false, error: "agendamento_nao_encontrado" });
    expect(agenda.reschedule(joao.patientPhone, a.id, "2026-09-30", "10:00")).toMatchObject({ error: "agendamento_nao_encontrado" });
  });

  it("cancela uma vez e libera o horário", () => {
    const agenda = new Agenda(clinic, now);
    const a = values(agenda.book({ ...maria, serviceId: "limpeza", date: "2026-09-29", time: "10:00" }));
    values(agenda.cancel(maria.patientPhone, a.id));
    expect(agenda.cancel(maria.patientPhone, a.id)).toEqual({ ok: false, error: "agendamento_ja_cancelado" });
    expect(agenda.byPatient(maria.patientPhone)).toEqual([]);
    expect(agenda.book({ ...joao, serviceId: "limpeza", date: "2026-09-29", time: "10:00" }).ok).toBe(true);
  });
});

describe("defesas da agenda", () => {
  it("recusa data que não existe no calendário, em vez de empurrá-la para o mês seguinte", () => {
    const agenda = new Agenda(clinic, now);
    expect(agenda.book({ ...maria, serviceId: "limpeza", date: "2026-11-31", time: "10:00" })).toEqual({
      ok: false,
      error: "data_invalida",
    });
    expect(agenda.findSlots({ serviceId: "limpeza", fromDate: "2026-02-30" })).toEqual({ ok: false, error: "data_invalida" });
  });

  it("recusa data além do horizonte e não oferece horário depois dele", () => {
    const agenda = new Agenda(clinic, now, [], { maxActivePerPatient: 3, horizonDays: 2 });
    expect(agenda.book({ ...maria, serviceId: "limpeza", date: "2026-10-01", time: "10:00" })).toMatchObject({
      error: "data_muito_distante",
    });
    const slots = values(agenda.findSlots({ serviceId: "limpeza", days: 30, limit: 500 }));
    expect(new Set(slots.map((s) => s.date))).toEqual(new Set(["2026-09-28", "2026-09-29", "2026-09-30"]));
  });

  it("limita os agendamentos ativos de um paciente; cancelado não conta", () => {
    const agenda = new Agenda(clinic, now, [], { maxActivePerPatient: 2, horizonDays: 90 });
    const base = { ...maria, serviceId: "limpeza", date: "2026-09-29" };
    const first = values(agenda.book({ ...base, time: "10:00" }));
    values(agenda.book({ ...base, time: "10:30" }));
    expect(agenda.book({ ...base, time: "11:00" })).toEqual({ ok: false, error: "limite_de_agendamentos" });
    expect(agenda.book({ ...joao, serviceId: "limpeza", date: "2026-09-29", time: "11:00" }).ok).toBe(true);
    values(agenda.cancel(maria.patientPhone, first.id));
    expect(agenda.book({ ...base, time: "11:30" }).ok).toBe(true);
  });

  it("devolve cópias: mudar o que saiu não muda a agenda", () => {
    const agenda = new Agenda(clinic, now);
    const a = values(agenda.book({ ...maria, serviceId: "limpeza", date: "2026-09-29", time: "10:00" }));
    a.status = "cancelled";
    agenda.byPatient(maria.patientPhone)[0].time = "08:00";
    expect(agenda.list()[0]).toMatchObject({ status: "booked", time: "10:00" });
  });
});

