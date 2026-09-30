import type { RunRecord } from "../runner/run.ts";
import { scored } from "../runner/suite.ts";
import type { ScenarioSet } from "../scenarios/schema.ts";
import { DataFile } from "./schema.ts";

// Transforma uma rodada gravada (`runs/<data>/`) no arquivo que a página do Labs lê.

export interface RunMeta {
  createdAt: string;
  splits: string[];
  repeats: number;
  patient: { id: string; model: string };
  brains: { id: string; model: string }[];
}

export const TASK_LABELS: Record<string, string> = {
  duvida: "Dúvidas",
  inicio_agendamento: "Início de agendamento",
  emergencia: "Emergência",
  fora_do_escopo: "Fora do escopo",
  adversarial: "Adversariais",
  data_relativa: "Datas relativas",
  politica: "Políticas",
  midia: "Áudio e imagem",
  agendar: "Agendar",
  remarcar: "Remarcar",
  cancelar: "Cancelar",
  handoff: "Passar para humano",
};

const BRAIN_LABELS: Record<string, string> = {
  regras: "Regras (falso, sem IA)",
  sonnet: "Claude Sonnet 5",
  haiku: "Claude Haiku 4.5",
  gpt: "GPT-6 Astra",
  jev: "Jev",
  "jev-redator": "Jev + redator",
};

// Cérebro falso ou paciente por regras: a rodada serve para testar, não para publicar.
const SYNTHETIC = new Set(["regras"]);

const MAX_INPUT = 120;

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function countBy<T>(xs: T[], key: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[key(x)] = (out[key(x)] ?? 0) + 1;
  return out;
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const x of xs) out.set(key(x), [...(out.get(key(x)) ?? []), x]);
  return out;
}

function passed(rs: RunRecord[]) {
  return { runs: rs.length, passed: rs.filter((r) => r.passed).length };
}

function describeCall(c: RunRecord["toolCalls"][number]): string {
  const input = JSON.stringify(c.input ?? {});
  const args = input === "{}" ? "" : input.length > MAX_INPUT ? `${input.slice(0, MAX_INPUT)}…` : input;
  const outcome = c.result.ok ? "ok" : c.result.error;
  return `${c.name}${args ? ` ${args}` : ""} → ${outcome}`;
}

// Funções entram na transcrição antes das respostas do bot no mesmo turno.
function transcriptTurns(r: RunRecord): DataFile["transcripts"][number]["turns"] {
  const turns: DataFile["transcripts"][number]["turns"] = [];
  const maxTurn = Math.max(0, ...r.transcript.map((t) => t.turn), ...r.toolCalls.map((c) => c.turn));
  for (let turn = 1; turn <= maxTurn; turn++) {
    const entries = r.transcript.filter((t) => t.turn === turn);
    for (const t of entries.filter((t) => t.role === "paciente")) turns.push({ turn, role: "paciente", text: t.text });
    for (const c of r.toolCalls.filter((c) => c.turn === turn)) turns.push({ turn, role: "funcao", text: describeCall(c), ok: c.result.ok });
    for (const t of entries.filter((t) => t.role !== "paciente")) {
      turns.push({
        turn,
        role: t.role,
        text: t.text,
        ...(t.original !== undefined && { original: t.original }),
        ...(t.discarded && { discarded: true }),
      });
    }
  }
  return turns;
}

function scenarioTitle(set: ScenarioSet, id: string): string {
  const single = set.singleTurn.find((s) => s.id === id);
  if (single) {
    const first = single.mensagens.padrao.map((m) => (typeof m === "string" ? m : `[${m.midia}]${m.legenda ? ` ${m.legenda}` : ""}`));
    return first.join(" / ");
  }
  const conv = set.conversations.find((s) => s.id === id);
  return conv ? conv.persona.objetivo : id;
}

// `preview`: rodada da dev para ver a página localmente. Sai com split "dev", e a página se
// recusa a publicá-la.
export function buildDataFile(allRecords: RunRecord[], meta: RunMeta, set: ScenarioSet, generatedAt: string, preview = false): DataFile {
  // Execução em que o paciente simulado caiu não mede o cérebro: não vai para a página.
  const records = scored(allRecords);
  const split = preview ? "dev" : "validation";
  if (!meta.splits.every((s) => s === split)) {
    throw new Error(
      preview
        ? `a prévia é só da dev; esta rodada tem: ${meta.splits.join(", ")}`
        : `só rodada da validation vai para a página (ADR-0002); esta tem: ${meta.splits.join(", ")}`,
    );
  }
  if (!records.length) throw new Error("rodada vazia");

  const brainIds = [...new Set(records.map((r) => r.brain.id))];
  const scenarioIds = [...new Set(records.map((r) => r.scenarioId))];
  const cellKey = (r: RunRecord) => `${r.brain.id}|${r.mode}|${r.persona}`;

  const summary = [...groupBy(records, cellKey).values()].map((rs) => {
    const conversations = rs.filter((r) => r.kind === "conversa");
    const violations = rs.flatMap((r) => r.violations);
    return {
      brain: rs[0].brain.id,
      mode: rs[0].mode,
      persona: rs[0].persona,
      ...passed(rs),
      singleTurn: passed(rs.filter((r) => r.kind === "uma-fala")),
      conversation: passed(conversations),
      errors: rs.filter((r) => r.outcome === "erro").length,
      unconfirmedActions: rs.reduce((n, r) => n + r.unconfirmed.length, 0),
      violationsGenerated: countBy(violations, (v) => v.kind),
      violationsSent: countBy(violations.filter((v) => v.sent), (v) => v.kind),
      botMessagesPerConversation: avg(conversations.map((r) => r.botMessages)),
      toolCallsPerRun: avg(rs.map((r) => r.toolCalls.length)),
      latencyP50Ms: percentile(rs.flatMap((r) => r.latencyMs), 50),
      latencyP95Ms: percentile(rs.flatMap((r) => r.latencyMs), 95),
      costPerConversationUSD: avg(conversations.map((r) => r.usage.brain.costUSD)),
    };
  });

  const byTask = [...groupBy(records, (r) => `${cellKey(r)}|${r.tarefa}`).values()].map((rs) => ({
    brain: rs[0].brain.id,
    mode: rs[0].mode,
    persona: rs[0].persona,
    tarefa: rs[0].tarefa,
    ...passed(rs),
  }));

  const transcripts = records
    .filter((r) => r.repeat === 1)
    .map((r) => ({
      scenarioId: r.scenarioId,
      brain: r.brain.id,
      mode: r.mode,
      persona: r.persona,
      passed: r.passed,
      outcome: r.outcome,
      failedChecks: r.checks.filter((c) => !c.ok).map((c) => ({ id: c.id, ...(c.detail !== undefined && { detail: c.detail }) })),
      turns: transcriptTurns(r),
    }));

  const scenarios = scenarioIds.map((id) => {
    const r = records.find((x) => x.scenarioId === id)!;
    return { id, tarefa: r.tarefa, kind: r.kind, title: scenarioTitle(set, id) };
  });

  const tasks = [...groupBy(scenarios, (s) => s.tarefa).entries()].map(([id, ss]) => ({
    id,
    label: TASK_LABELS[id] ?? id,
    kind: ss[0].kind,
    scenarios: ss.length,
  }));

  return DataFile.parse({
    version: 1,
    generatedAt,
    runAt: meta.createdAt,
    split,
    synthetic: brainIds.some((b) => SYNTHETIC.has(b)) || SYNTHETIC.has(meta.patient.id),
    repeats: meta.repeats,
    brains: brainIds.map((id) => ({
      id,
      label: BRAIN_LABELS[id] ?? id,
      model: records.find((r) => r.brain.id === id)!.brain.model,
    })),
    patient: meta.patient,
    judge: null,
    tasks,
    scenarios,
    summary,
    byTask,
    transcripts,
  });
}
