import { z } from "zod";

// O contrato do arquivo que a página do Labs lê (ADR-0001). É a única saída pública do
// zap-bench: nada de conta de produto (ADR-0005), telefone ou resultado bruto de função.

const mode = z.enum(["bruto", "guardrails"]);
const persona = z.enum(["padrao", "dificil"]);

const cell = z.object({
  brain: z.string(),
  mode,
  persona,
  runs: z.number().int(),
  passed: z.number().int(),
});

export const DataFile = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  runAt: z.string(),
  split: z.literal("validation"),
  // Rodada com o cérebro falso ou com o paciente por regras: nunca vai ao ar.
  synthetic: z.boolean(),
  repeats: z.number().int(),
  brains: z.array(z.object({ id: z.string(), label: z.string(), model: z.string() })),
  patient: z.object({ id: z.string(), model: z.string() }),
  judge: z.object({ id: z.string(), model: z.string() }).nullable(),
  tasks: z.array(z.object({ id: z.string(), label: z.string(), kind: z.enum(["uma-fala", "conversa"]), scenarios: z.number().int() })),
  scenarios: z.array(
    z.object({ id: z.string(), tarefa: z.string(), kind: z.enum(["uma-fala", "conversa"]), title: z.string() }),
  ),
  summary: z.array(
    cell.extend({
      singleTurn: z.object({ runs: z.number().int(), passed: z.number().int() }),
      conversation: z.object({ runs: z.number().int(), passed: z.number().int() }),
      errors: z.number().int(),
      unconfirmedActions: z.number().int(),
      violationsGenerated: z.record(z.string(), z.number().int()),
      violationsSent: z.record(z.string(), z.number().int()),
      botMessagesPerConversation: z.number(),
      toolCallsPerRun: z.number(),
      latencyP50Ms: z.number(),
      latencyP95Ms: z.number(),
      costPerConversationUSD: z.number(),
    }),
  ),
  byTask: z.array(cell.extend({ tarefa: z.string() })),
  transcripts: z.array(
    z.object({
      scenarioId: z.string(),
      brain: z.string(),
      mode,
      persona,
      passed: z.boolean(),
      outcome: z.string(),
      failedChecks: z.array(z.object({ id: z.string(), detail: z.string().optional() })),
      turns: z.array(
        z.object({
          turn: z.number().int(),
          role: z.enum(["paciente", "bot", "recepcao", "funcao"]),
          text: z.string(),
          // Resposta que o cérebro gerou e não saiu: trocada pelo guardrail ou descartada.
          original: z.string().optional(),
          discarded: z.boolean().optional(),
          ok: z.boolean().optional(),
        }),
      ),
    }),
  ),
});

export type DataFile = z.infer<typeof DataFile>;
