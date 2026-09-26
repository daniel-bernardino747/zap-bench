import type { Instant } from "../domain/calendar.ts";
import type { Establishment } from "../domain/establishment.ts";
import type { ToolResult } from "../domain/tools.ts";

// O contrato que os quatro cérebros implementam (ADR-0002). Uma sessão por conversa: o cérebro
// guarda o próprio histórico (mensagens e tool calls de um LLM, estado do diálogo do Jev).
// Ferramentas só pelo `callTool`, que passa pelo guard da conversa (ADR-0007).

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
}

export const NO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, costUSD: 0 };

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    costUSD: a.costUSD + b.costUSD,
  };
}

export interface SessionContext {
  clinic: Establishment;
  now: Instant;
  callTool(name: string, input: unknown): ToolResult;
}

export interface BrainReply {
  // Cada item vira uma mensagem de WhatsApp, e cada uma custa (ADR-0008).
  replies: string[];
  usage: Usage;
}

export interface BrainSession {
  respond(patientText: string): Promise<BrainReply>;
}

export interface Brain {
  id: string;
  label: string;
  // O id exato do modelo, gravado em cada execução.
  model: string;
  start(ctx: SessionContext): BrainSession;
}
