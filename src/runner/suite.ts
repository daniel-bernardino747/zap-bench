import type { Brain } from "../brains/types.ts";
import type { Establishment } from "../domain/establishment.ts";
import type { Mode } from "../domain/guardrails.ts";
import type { Patient, Persona } from "../sim/patient.ts";
import type { ScenarioSet } from "../scenarios/schema.ts";
import { runConversation, runSingleTurn, type RunRecord } from "./run.ts";

export interface SuiteOptions {
  brains: Brain[];
  patient: Patient;
  modes: Mode[];
  personas: Persona[];
  repeats: number;
  budgetUSD: number;
  onRecord?: (r: RunRecord, done: number, total: number) => void | Promise<void>;
}

export interface SuiteResult {
  records: RunRecord[];
  costUSD: number;
  stoppedByBudget: boolean;
}

export function recordCost(r: RunRecord): number {
  return r.usage.brain.costUSD + r.usage.patient.costUSD;
}

// Sequencial de propósito: limites de taxa das APIs, e a trava de custo (ADR-0003) precisa
// ser checada antes de cada execução.
export async function runSuite(clinic: Establishment, set: ScenarioSet, o: SuiteOptions): Promise<SuiteResult> {
  type Job = () => Promise<RunRecord>;
  const jobs: Job[] = [];
  for (const brain of o.brains)
    for (const mode of o.modes)
      for (const persona of o.personas)
        for (let repeat = 1; repeat <= o.repeats; repeat++) {
          const opts = { mode, persona, repeat };
          for (const s of set.singleTurn) jobs.push(() => runSingleTurn(clinic, s, brain, opts));
          for (const s of set.conversations) jobs.push(() => runConversation(clinic, s, brain, o.patient, opts));
        }

  const records: RunRecord[] = [];
  let costUSD = 0;
  for (const job of jobs) {
    if (costUSD >= o.budgetUSD) return { records, costUSD, stoppedByBudget: true };
    const r = await job();
    records.push(r);
    costUSD += recordCost(r);
    await o.onRecord?.(r, records.length, jobs.length);
  }
  return { records, costUSD, stoppedByBudget: false };
}

export interface SummaryRow {
  brain: string;
  mode: Mode;
  persona: Persona;
  runs: number;
  passRate: number;
  singleTurnPassRate: number;
  conversationPassRate: number;
  violationsGenerated: number;
  violationsSent: number;
  unconfirmedActions: number;
  errors: number;
  patientUnavailable: number;
  botMessagesPerConversation: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  costPerConversationUSD: number;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function rate(rs: RunRecord[]): number {
  return rs.length ? rs.filter((r) => r.passed).length / rs.length : 0;
}

// Execuções que medem o cérebro: sem as que pararam porque o paciente simulado caiu.
export function scored(records: RunRecord[]): RunRecord[] {
  return records.filter((r) => r.outcome !== "paciente_indisponivel");
}

export function summarize(records: RunRecord[]): SummaryRow[] {
  const groups = new Map<string, RunRecord[]>();
  for (const r of records) {
    const key = `${r.brain.id}|${r.mode}|${r.persona}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()].map(([key, all]) => {
    const [brain, mode, persona] = key.split("|") as [string, Mode, Persona];
    const rs = scored(all);
    const conversations = rs.filter((r) => r.kind === "conversa");
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    return {
      brain,
      mode,
      persona,
      runs: rs.length,
      passRate: rate(rs),
      singleTurnPassRate: rate(rs.filter((r) => r.kind === "uma-fala")),
      conversationPassRate: rate(conversations),
      violationsGenerated: rs.reduce((n, r) => n + r.violationsGenerated, 0),
      violationsSent: rs.reduce((n, r) => n + r.violationsSent, 0),
      unconfirmedActions: rs.reduce((n, r) => n + r.unconfirmed.length, 0),
      errors: rs.filter((r) => r.outcome === "erro").length,
      patientUnavailable: all.length - rs.length,
      botMessagesPerConversation: avg(conversations.map((r) => r.botMessages)),
      latencyP50Ms: percentile(rs.flatMap((r) => r.latencyMs), 50),
      latencyP95Ms: percentile(rs.flatMap((r) => r.latencyMs), 95),
      costPerConversationUSD: avg(conversations.map(recordCost)),
    };
  });
}
