import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { isValidDate, TIME } from "../domain/calendar.ts";

// Formato dos cenários (ADR-0003). O paciente do cenário é sempre PATIENT_PHONE; "eu" na agenda
// inicial é ele. Tudo que o cenário espera é verificável por código (ADR-0006).

export const PATIENT_PHONE = "5548999990001";

const date = z.string().refine(isValidDate, "data AAAA-MM-DD inexistente");
const time = z.string().regex(TIME, "hora HH:MM");
const toolName = z.enum(["buscar_horarios", "agendar", "meus_agendamentos", "remarcar", "cancelar", "chamar_humano"]);
const handoffReason = z.enum(["pedido_do_paciente", "emergencia", "nao_sei_responder", "reclamacao"]);

const seedAppointment = z.object({
  paciente: z.union([z.literal("eu"), z.object({ telefone: z.string().regex(/^\d{10,15}$/), nome: z.string().min(1) })]),
  servico: z.string().min(1),
  data: date,
  hora: time,
  profissional: z.string().optional(),
  convenio: z.string().nullable().default(null),
});

const common = {
  id: z.string().regex(/^[a-z0-9-]+$/),
  tarefa: z.enum(["duvida", "inicio_agendamento", "emergencia", "fora_do_escopo", "adversarial", "agendar", "remarcar", "cancelar", "handoff"]),
  agora: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  nome_paciente: z.string().min(1),
  agenda: z.array(seedAppointment).default([]),
};

// Cada grupo interno é um "algum destes"; todos os grupos precisam aparecer. Comparação sem
// acento e sem caixa.
const anyOfGroups = z.array(z.array(z.string().min(1)).min(1));

export const SingleTurnScenario = z.object({
  ...common,
  mensagens: z.object({ padrao: z.array(z.string().min(1)).min(1), dificil: z.array(z.string().min(1)).min(1) }),
  esperado: z.object({
    chama: z.array(z.object({ ferramenta: toolName, motivo: handoffReason.optional() })).default([]),
    nao_chama: z.array(toolName).default([]),
    agenda_intacta: z.boolean().default(false),
    sem_violacao: z.boolean().default(true),
    resposta_contem: anyOfGroups.default([]),
    resposta_nao_contem: z.array(z.string().min(1)).default([]),
    resumo_nao_contem: z.array(z.string().min(1)).default([]),
  }),
});

const appointmentMatcher = z.object({
  servico: z.string().min(1),
  data: date.optional(),
  data_entre: z.tuple([date, date]).optional(),
  hora: time.optional(),
  hora_antes_de: time.optional(),
  hora_depois_de: time.optional(),
  profissional: z.string().optional(),
  convenio: z.string().nullable().optional(),
});

export const ConversationScenario = z.object({
  ...common,
  persona: z.object({
    objetivo: z.string().min(1),
    sabe: z.array(z.string().min(1)).default([]),
    abertura: z.object({ padrao: z.string().min(1), dificil: z.string().min(1) }),
  }),
  max_turnos: z.number().int().min(2).max(20).default(12),
  esperado: z.object({
    // Agendamentos ativos do paciente no fim, exatamente estes (em qualquer ordem).
    agenda_final: z.array(appointmentMatcher).optional(),
    handoff: z.union([z.null(), z.object({ motivo_em: z.array(handoffReason).min(1) })]).default(null),
    sem_violacao: z.boolean().default(true),
  }),
});

export type SingleTurnScenario = z.infer<typeof SingleTurnScenario>;
export type ConversationScenario = z.infer<typeof ConversationScenario>;
export type Split = "dev" | "validation";

export interface ScenarioSet {
  singleTurn: (SingleTurnScenario & { split: Split })[];
  conversations: (ConversationScenario & { split: Split })[];
}

async function readDir<T>(dir: string, schema: z.ZodType<T>): Promise<T[]> {
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(".json")).sort();
  return Promise.all(
    files.map(async (f) => {
      const parsed = schema.safeParse(JSON.parse(await readFile(join(dir, f), "utf8")));
      if (!parsed.success) throw new Error(`${join(dir, f)}: ${z.prettifyError(parsed.error)}`);
      return parsed.data;
    }),
  );
}

export async function loadScenarios(root: string, splits: Split[] = ["dev", "validation"]): Promise<ScenarioSet> {
  const set: ScenarioSet = { singleTurn: [], conversations: [] };
  for (const split of splits) {
    for (const s of await readDir(join(root, split, "uma-fala"), SingleTurnScenario)) set.singleTurn.push({ ...s, split });
    for (const s of await readDir(join(root, split, "conversa"), ConversationScenario)) set.conversations.push({ ...s, split });
  }
  return set;
}

export function parseNow(agora: string): { date: string; time: string } {
  const [d, t] = agora.split("T");
  return { date: d, time: t };
}
