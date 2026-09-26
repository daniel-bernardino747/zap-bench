import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { Agenda } from "../domain/agenda.ts";
import { loadEstablishment, type Establishment } from "../domain/establishment.ts";
import { loadScenarios, parseNow, PATIENT_PHONE, type ScenarioSet } from "./schema.ts";

const root = fileURLToPath(new URL("../../scenarios", import.meta.url));

let clinic: Establishment;
let set: ScenarioSet;
beforeAll(async () => {
  clinic = await loadEstablishment(fileURLToPath(new URL("../../establishments/clinica-odontologica.json", import.meta.url)));
  set = await loadScenarios(root);
});

function all() {
  return [...set.singleTurn, ...set.conversations];
}

describe("conjunto de cenários", () => {
  it("tem o tamanho combinado", () => {
    expect(set.singleTurn).toHaveLength(34);
    expect(set.conversations).toHaveLength(8);
  });

  it("não repete id", () => {
    const ids = all().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("divide cada tarefa entre dev e validation, com diferença de no máximo um", () => {
    for (const group of [set.singleTurn, set.conversations]) {
      const byTask = new Map<string, number[]>();
      for (const s of group) {
        const [dev, val] = byTask.get(s.tarefa) ?? [0, 0];
        byTask.set(s.tarefa, s.split === "dev" ? [dev + 1, val] : [dev, val + 1]);
      }
      for (const [task, [dev, val]] of byTask) expect(Math.abs(dev - val), task).toBeLessThanOrEqual(1);
    }
  });

  it("a agenda inicial de cada cenário é uma agenda possível", () => {
    for (const s of all()) {
      const agenda = new Agenda(clinic, parseNow(s.agora), [], { maxActivePerPatient: 100, horizonDays: 90 });
      for (const a of s.agenda) {
        const patient = a.paciente === "eu" ? { telefone: PATIENT_PHONE, nome: s.nome_paciente } : a.paciente;
        const r = agenda.book({
          patientPhone: patient.telefone,
          patientName: patient.nome,
          serviceId: a.servico,
          date: a.data,
          time: a.hora,
          professionalId: a.profissional,
          insurance: a.convenio,
        });
        expect(r, `${s.id}: ${a.servico} ${a.data} ${a.hora}`).toMatchObject({ ok: true });
      }
    }
  });

  it("todo serviço e convênio esperado existe na clínica", () => {
    const services = new Set(clinic.services.map((x) => x.id));
    for (const s of set.conversations) {
      for (const m of s.esperado.agenda_final ?? []) {
        expect(services.has(m.servico), `${s.id}: ${m.servico}`).toBe(true);
        if (m.convenio) expect(clinic.insurances, s.id).toContain(m.convenio);
      }
    }
  });

  it("na versão difícil de uma fala, ninguém escreve como no padrão", () => {
    for (const s of set.singleTurn) expect(s.mensagens.dificil, s.id).not.toEqual(s.mensagens.padrao);
  });

  it("o guia das personas tem as duas personas e o marcador de fim", async () => {
    const personas = JSON.parse(await readFile(`${root}/personas.json`, "utf8"));
    expect(Object.keys(personas)).toEqual(expect.arrayContaining(["padrao", "dificil", "encerramento"]));
    expect(personas.encerramento).toContain("[FIM]");
  });
});
