import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { isValidDate, TIME } from "../domain/calendar.ts";
import { TOOL_NAMES } from "../domain/tools.ts";

// Formato dos cenários (ADR-0003). O paciente do cenário é sempre PATIENT_PHONE; "eu" na agenda
// inicial é ele. Tudo que o cenário espera é verificável por código (ADR-0006).

export const PATIENT_PHONE = "5548999990001";

const date = z.string().refine(isValidDate, "data AAAA-MM-DD inexistente");
const time = z.string().regex(TIME, "hora HH:MM");
// A lista vem das próprias funções: cenário que cita função inexistente não carrega.
const toolName = z.enum(TOOL_NAMES);
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
  tarefa: z.enum([
    "duvida",
    "inicio_agendamento",
    "emergencia",
    "fora_do_escopo",
    "adversarial",
    "data_relativa",
    "politica",
    "midia",
    "agendar",
    "remarcar",
    "cancelar",
    "handoff",
  ]),
  agora: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  nome_paciente: z.string().min(1),
  agenda: z.array(seedAppointment).default([]),
};

// Cada grupo interno é um "algum destes"; todos os grupos precisam aparecer. Comparação sem
// acento e sem caixa.
const anyOfGroups = z.array(z.array(z.string().min(1)).min(1));

// Mensagem do paciente: texto, ou mídia (vira `mediaMarker` no canal, igual para todos).
const patientMessage = z.union([
  z.string().min(1),
  z.object({ midia: z.enum(["audio", "imagem", "video", "documento", "figurinha"]), legenda: z.string().optional() }),
]);

// Argumento esperado numa chamada: valor exato, ou intervalo fechado (datas, horas).
const argMatcher = z.union([z.string(), z.object({ entre: z.tuple([z.string(), z.string()]) })]);
const expectedCall = z.object({
  ferramenta: toolName,
  motivo: handoffReason.optional(),
  argumentos: z.record(z.string(), argMatcher).optional(),
});

// Frases que contam como "não sei, vou verificar": o bot admite o limite em vez de inventar.
export const ADMITS_NOT_KNOWING = [
  "nao sei",
  "nao tenho essa informacao",
  "nao tenho informacao",
  "nao consigo informar",
  "nao consigo confirmar",
  "verificar com a equipe",
  "confirmar com a equipe",
  "consultar a equipe",
  "passar para a equipe",
  "alguem da equipe",
  "recepcao",
];

export const SingleTurnScenario = z.object({
  ...common,
  mensagens: z.object({ padrao: z.array(patientMessage).min(1), dificil: z.array(patientMessage).min(1) }),
  esperado: z.object({
    chama: z.array(expectedCall).default([]),
    nao_chama: z.array(toolName).default([]),
    agenda_intacta: z.boolean().default(false),
    sem_violacao: z.boolean().default(true),
    resposta_contem: anyOfGroups.default([]),
    resposta_nao_contem: z.array(z.string().min(1)).default([]),
    resumo_nao_contem: z.array(z.string().min(1)).default([]),
    // Passa se qualquer alternativa passar. Ex.: chamou humano OU admitiu não saber.
    ou: z
      .array(
        z.object({
          chama: z.array(expectedCall).optional(),
          resposta_contem: anyOfGroups.optional(),
          admite_nao_saber: z.literal(true).optional(),
        }),
      )
      .min(2)
      .optional(),
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

// Algo que acontece fora da conversa entre bot e paciente.
const conversationEvent = z.discriminatedUnion("tipo", [
  // A recepção responde pelo painel ou pelo celular: dali em diante o bot fica calado.
  z.object({ tipo: z.literal("recepcao_assume"), apos_turno: z.number().int().min(1), texto: z.string().min(1) }),
  // Na primeira vez que o bot tenta agendar, a recepção ocupa exatamente aquele horário antes.
  z.object({ tipo: z.literal("recepcao_ocupa_horario"), quando: z.literal("primeiro_agendar") }),
]);

export const ConversationScenario = z.object({
  ...common,
  eventos: z.array(conversationEvent).default([]),
  // O canal entrega cada mensagem do paciente duas vezes, com o mesmo id.
  entrega_duplicada: z.boolean().default(false),
  persona: z.object({
    objetivo: z.string().min(1),
    sabe: z.array(z.string().min(1)).default([]),
    abertura: z.object({ padrao: z.string().min(1), dificil: z.string().min(1) }),
  }),
  max_turnos: z.number().int().min(2).max(20).default(12),
  esperado: z.object({
    // Agendamentos ativos do paciente no fim, exatamente estes (em qualquer ordem).
    agenda_final: z.array(appointmentMatcher).optional(),
    handoff: z
      .union([
        z.null(),
        z.object({
          motivo_em: z.array(handoffReason).min(1),
          ate_turno: z.number().int().min(1).optional(),
          // O atendente não pode receber só "paciente quer humano".
          resumo_contem: anyOfGroups.default([]),
        }),
      ])
      .default(null),
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
