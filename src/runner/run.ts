import { performance } from "node:perf_hooks";
import type { Brain, Usage } from "../brains/types.ts";
import { addUsage, NO_USAGE } from "../brains/types.ts";
import { Agenda, type Appointment } from "../domain/agenda.ts";
import { mediaMarker, MessageBuffer } from "../domain/buffer.ts";
import type { Establishment } from "../domain/establishment.ts";
import { ConversationGuard, type Mode } from "../domain/guardrails.ts";
import { createToolContext, type ToolResult } from "../domain/tools.ts";
import type { Patient, Persona } from "../sim/patient.ts";
import { parseNow, PATIENT_PHONE, type ConversationScenario, type SingleTurnScenario, type Split } from "../scenarios/schema.ts";
import { evaluateConversation, evaluateSingleTurn, type Check, type Observed } from "./evaluate.ts";

// Roda um cenário com um cérebro e grava tudo que aconteceu. Buffer, eventos da recepção,
// entrega duplicada e guard ficam aqui, iguais para todos os cérebros.

export const RECEPTION_PHONE = "5500000000000";

export type Outcome = "respondido" | "fim" | "desistiu" | "handoff" | "humano_assumiu" | "limite_de_turnos" | "erro";

export interface TranscriptEntry {
  turn: number;
  role: "paciente" | "bot" | "recepcao";
  text: string;
  // Resposta que o cérebro gerou mas não saiu: trocada pelo guardrail ou descartada porque um humano assumiu.
  original?: string;
  discarded?: boolean;
}

export interface RunOptions {
  mode: Mode;
  persona: Persona;
  repeat: number;
}

export interface RunRecord {
  kind: "uma-fala" | "conversa";
  scenarioId: string;
  split: Split;
  tarefa: string;
  brain: { id: string; model: string };
  patient: { id: string; model: string } | null;
  mode: Mode;
  persona: Persona;
  repeat: number;
  outcome: Outcome;
  error?: string;
  turns: number;
  transcript: TranscriptEntry[];
  toolCalls: Observed["toolCalls"];
  violationsGenerated: number;
  violationsSent: number;
  unconfirmed: Observed["unconfirmed"];
  handoff: Observed["handoff"];
  handoffTurn: number | null;
  patientAgenda: { servico: string; data: string; hora: string; profissional: string; convenio: string | null }[];
  botMessages: number;
  duplicatesDropped: number;
  latencyMs: number[];
  usage: { brain: Usage; patient: Usage };
  checks: Check[];
  passed: boolean;
}

type AnyScenario = SingleTurnScenario | ConversationScenario;

function setup(clinic: Establishment, s: AnyScenario, mode: Mode) {
  const now = parseNow(s.agora);
  const agenda = new Agenda(
    clinic,
    now,
    s.agenda.map((a) => {
      const p = a.paciente === "eu" ? { telefone: PATIENT_PHONE, nome: s.nome_paciente } : a.paciente;
      return {
        patientPhone: p.telefone,
        patientName: p.nome,
        serviceId: a.servico,
        professionalId: a.profissional ?? clinic.services.find((x) => x.id === a.servico)!.professionalIds[0],
        date: a.data,
        time: a.hora,
        insurance: a.convenio,
      };
    }),
  );
  const ctx = createToolContext(agenda, PATIENT_PHONE);
  return { now, agenda, ctx, guard: new ConversationGuard(ctx, mode), initialAgenda: agenda.list() };
}

function observe(env: ReturnType<typeof setup>, repliesAfterHuman = 0): Observed {
  return {
    toolCalls: env.ctx.log,
    replies: env.guard.replies,
    unconfirmed: env.guard.unconfirmed,
    handoff: env.ctx.handoff,
    handoffTurn: env.guard.handoffTurn,
    initialAgenda: env.initialAgenda,
    finalAgenda: env.agenda.list(),
    patientAgenda: env.agenda.byPatient(PATIENT_PHONE),
    repliesAfterHuman,
  };
}

function toRecordAgenda(list: Appointment[]): RunRecord["patientAgenda"] {
  return list.map((a) => ({ servico: a.serviceId, data: a.date, hora: a.time, profissional: a.professionalId, convenio: a.insurance }));
}

function base(s: AnyScenario & { split: Split }, kind: RunRecord["kind"], brain: Brain, o: RunOptions) {
  return { kind, scenarioId: s.id, split: s.split, tarefa: s.tarefa, brain: { id: brain.id, model: brain.model }, ...o };
}

function finish(
  env: ReturnType<typeof setup>,
  partial: Omit<RunRecord, "toolCalls" | "violationsGenerated" | "violationsSent" | "unconfirmed" | "handoff" | "handoffTurn" | "patientAgenda" | "passed">,
): RunRecord {
  const replies = env.guard.replies;
  return {
    ...partial,
    toolCalls: env.ctx.log,
    violationsGenerated: replies.reduce((n, r) => n + r.violations.length, 0),
    violationsSent: replies.filter((r) => r.sent === r.reply).reduce((n, r) => n + r.violations.length, 0),
    unconfirmed: env.guard.unconfirmed,
    handoff: env.ctx.handoff,
    handoffTurn: env.guard.handoffTurn,
    patientAgenda: toRecordAgenda(env.agenda.byPatient(PATIENT_PHONE)),
    passed: partial.outcome !== "erro" && partial.checks.every((c) => c.ok),
  };
}

function render(m: SingleTurnScenario["mensagens"]["padrao"][number]): string {
  return typeof m === "string" ? m : mediaMarker(m.midia, m.legenda);
}

export async function runSingleTurn(
  clinic: Establishment,
  s: SingleTurnScenario & { split: Split },
  brain: Brain,
  o: RunOptions,
): Promise<RunRecord> {
  const env = setup(clinic, s, o.mode);
  const transcript: TranscriptEntry[] = [];
  const buffer = new MessageBuffer();
  s.mensagens[o.persona].forEach((m, i) => {
    const text = render(m);
    buffer.push({ id: `m${i}`, text, at: i * 2_000 });
    transcript.push({ turn: 1, role: "paciente", text });
  });
  const { text } = buffer.flush();
  env.guard.beginTurn(text);

  const latencyMs: number[] = [];
  let usage = NO_USAGE;
  let outcome: Outcome = "respondido";
  let error: string | undefined;
  let botMessages = 0;
  try {
    const session = brain.start({ clinic, now: env.now, callTool: (n, i) => env.guard.callTool(n, i) });
    const t0 = performance.now();
    const reply = await session.respond(text);
    latencyMs.push(performance.now() - t0);
    usage = reply.usage;
    for (const r of reply.replies) {
      const sent = env.guard.filterReply(r);
      transcript.push({ turn: 1, role: "bot", text: sent, ...(sent !== r && { original: r }) });
      botMessages++;
    }
    if (env.ctx.handoff) outcome = "handoff";
  } catch (e) {
    outcome = "erro";
    error = String((e as Error)?.message ?? e);
  }

  return finish(env, {
    ...base(s, "uma-fala", brain, o),
    patient: null,
    outcome,
    error,
    turns: 1,
    transcript,
    botMessages,
    duplicatesDropped: 0,
    latencyMs,
    usage: { brain: usage, patient: NO_USAGE },
    checks: evaluateSingleTurn(s, observe(env)),
  });
}

export async function runConversation(
  clinic: Establishment,
  s: ConversationScenario & { split: Split },
  brain: Brain,
  patient: Patient,
  o: RunOptions,
): Promise<RunRecord> {
  const env = setup(clinic, s, o.mode);
  const transcript: TranscriptEntry[] = [];
  const buffer = new MessageBuffer();
  const takeover = s.eventos.find((e) => e.tipo === "recepcao_assume");
  let occupyPending = s.eventos.some((e) => e.tipo === "recepcao_ocupa_horario");

  // A recepção ocupa, antes do cérebro, exatamente o horário da primeira tentativa de agendar.
  const callTool = (name: string, input: unknown): ToolResult => {
    if (occupyPending && name === "agendar") {
      occupyPending = false;
      const i = (input ?? {}) as Record<string, string>;
      env.agenda.book({
        patientPhone: RECEPTION_PHONE,
        patientName: "Paciente da recepção",
        serviceId: i.servico,
        date: i.data,
        time: i.hora,
        professionalId: i.profissional,
      });
    }
    return env.guard.callTool(name, input);
  };

  let brainUsage = NO_USAGE;
  let patientUsage = NO_USAGE;
  const latencyMs: number[] = [];
  let outcome: Outcome = "limite_de_turnos";
  let error: string | undefined;
  let botMessages = 0;
  let duplicatesDropped = 0;
  let turn = 0;
  let clock = 0;
  let nextId = 0;

  try {
    const session = brain.start({ clinic, now: env.now, callTool });
    const pSession = patient.start(s, o.persona);
    let incoming = [s.persona.abertura[o.persona]];

    for (turn = 1; turn <= s.max_turnos; turn++) {
      for (const text of incoming) {
        const message = { id: `m${nextId++}`, text, at: clock };
        buffer.push(message);
        if (s.entrega_duplicada && !buffer.push({ ...message, at: clock + 150 })) duplicatesDropped++;
        transcript.push({ turn, role: "paciente", text });
        clock += 2_000;
      }
      clock = buffer.deadline() ?? clock;
      const { text } = buffer.flush();
      env.guard.beginTurn(text);

      const t0 = performance.now();
      const reply = await session.respond(text);
      latencyMs.push(performance.now() - t0);
      brainUsage = addUsage(brainUsage, reply.usage);

      // A recepção respondeu enquanto o cérebro pensava: a resposta pronta não sai (Chatwoot #15681).
      if (takeover && turn === takeover.apos_turno + 1) {
        transcript.push({ turn, role: "recepcao", text: takeover.texto });
        for (const r of reply.replies) transcript.push({ turn, role: "bot", text: r, discarded: true });
        outcome = "humano_assumiu";
        break;
      }

      const sent = reply.replies.map((r) => {
        const out = env.guard.filterReply(r);
        transcript.push({ turn, role: "bot", text: out, ...(out !== r && { original: r }) });
        return out;
      });
      botMessages += sent.length;

      if (env.ctx.handoff) {
        outcome = "handoff";
        break;
      }

      const p = await pSession.reply(sent);
      patientUsage = addUsage(patientUsage, p.usage);
      clock += 30_000;
      if (p.end) {
        for (const m of p.messages) transcript.push({ turn: turn + 1, role: "paciente", text: m });
        outcome = p.end === "fim" ? "fim" : "desistiu";
        break;
      }
      incoming = p.messages.length ? p.messages : ["?"];
    }
  } catch (e) {
    outcome = "erro";
    error = String((e as Error)?.message ?? e);
  }

  const turns = Math.min(turn, s.max_turnos);
  const humanAt = transcript.findIndex((t) => t.role === "recepcao");
  const repliesAfterHuman = humanAt < 0 ? 0 : transcript.slice(humanAt).filter((t) => t.role === "bot" && !t.discarded).length;

  return finish(env, {
    ...base(s, "conversa", brain, o),
    patient: { id: patient.id, model: patient.model },
    outcome,
    error,
    turns,
    transcript,
    botMessages,
    duplicatesDropped,
    latencyMs,
    usage: { brain: brainUsage, patient: patientUsage },
    checks: evaluateConversation(s, observe(env, repliesAfterHuman), outcome),
  });
}
