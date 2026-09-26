import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { rulesBrain } from "../brains/rules.ts";
import { loadEstablishment, type Establishment } from "../domain/establishment.ts";
import { runSuite } from "../runner/suite.ts";
import type { RunRecord } from "../runner/run.ts";
import { rulePatient } from "../sim/patient.ts";
import { loadScenarios, type ScenarioSet } from "../scenarios/schema.ts";
import { buildDataFile, type RunMeta } from "./build.ts";

let clinic: Establishment;
let set: ScenarioSet;
let records: RunRecord[];

const meta: RunMeta = {
  createdAt: "2026-09-26T12:00:00Z",
  splits: ["validation"],
  repeats: 1,
  patient: { id: "regras", model: "regras" },
  brains: [{ id: "regras", model: "regras" }],
};

beforeAll(async () => {
  clinic = await loadEstablishment(fileURLToPath(new URL("../../establishments/clinica-odontologica.json", import.meta.url)));
  set = await loadScenarios(fileURLToPath(new URL("../../scenarios", import.meta.url)), ["validation"]);
  ({ records } = await runSuite(clinic, set, {
    brains: [rulesBrain],
    patient: rulePatient,
    modes: ["bruto", "guardrails"],
    personas: ["padrao", "dificil"],
    repeats: 1,
    budgetUSD: 1,
  }));
});

describe("exportação para a página", () => {
  it("recusa rodada que não é só da validation", () => {
    expect(() => buildDataFile(records, { ...meta, splits: ["dev"] }, set, "x")).toThrow(/validation/);
  });

  it("marca como dado de teste a rodada com o cérebro falso", () => {
    expect(buildDataFile(records, meta, set, "x").synthetic).toBe(true);
  });

  it("resume cada combinação de cérebro, modo e persona e cada tarefa", () => {
    const data = buildDataFile(records, meta, set, "x");
    expect(data.summary).toHaveLength(4);
    const total = data.summary.reduce((n, s) => n + s.runs, 0);
    expect(total).toBe(records.length);
    expect(data.byTask.reduce((n, s) => n + s.runs, 0)).toBe(records.length);
    expect(data.tasks.map((t) => t.id)).toContain("emergencia");
  });

  it("intercala as funções na transcrição, antes da resposta do mesmo turno", () => {
    const data = buildDataFile(records, meta, set, "x");
    const order = { paciente: 0, funcao: 1, bot: 2, recepcao: 2 };
    for (const t of data.transcripts) {
      for (let i = 1; i < t.turns.length; i++) {
        const [a, b] = [t.turns[i - 1], t.turns[i]];
        if (a.turn === b.turn) expect(order[a.role], `${t.scenarioId} turno ${a.turn}`).toBeLessThanOrEqual(order[b.role]);
      }
    }
    const withCalls = data.transcripts.flatMap((t) => t.turns).filter((x) => x.role === "funcao");
    expect(withCalls.length).toBeGreaterThan(0);
    expect(withCalls.every((x) => / → /.test(x.text))).toBe(true);
  });

  it("não leva telefone nem a conta de produto", () => {
    const text = JSON.stringify(buildDataFile(records, meta, set, "x"));
    expect(text).not.toMatch(/55489999\d{5}/);
    expect(text).not.toMatch(/59,90|mensalidade/);
  });
});
