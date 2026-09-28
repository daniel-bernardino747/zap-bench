import type { Usage } from "../brains/types.ts";
import { NO_USAGE } from "../brains/types.ts";
import type { ConversationScenario } from "../scenarios/schema.ts";
import { normalize } from "../domain/claims.ts";

// O paciente das conversas (ADR-0003). O de verdade é um LLM fora da comparação, com a
// persona e o guia de `scenarios/personas.json`; aqui ficam a interface e um paciente por
// regras, que serve para rodar o executor sem chave nenhuma.

export type Persona = "padrao" | "dificil";
export type PatientEnd = "fim" | "desistiu" | null;

// O simulador caiu (fila, limite de uso): a execução não mede o cérebro e sai das métricas.
export class PatientUnavailableError extends Error {
  override name = "PatientUnavailableError";
}

export interface PatientTurn {
  messages: string[];
  end: PatientEnd;
  usage: Usage;
}

export interface PatientSession {
  // A abertura vem do cenário; depois, o paciente responde ao que o bot mandou.
  reply(botReplies: string[]): Promise<PatientTurn>;
}

export interface Patient {
  id: string;
  model: string;
  start(scenario: ConversationScenario, persona: Persona): PatientSession;
}

// Extrai marcadores de fim que o paciente simulado escreve no fim da última mensagem.
export function parseEnd(messages: string[]): { messages: string[]; end: PatientEnd } {
  let end: PatientEnd = null;
  const cleaned = messages
    .map((m) => {
      if (m.includes("[FIM]")) end = "fim";
      if (m.includes("[DESISTI]")) end = "desistiu";
      return m.replace(/\[(FIM|DESISTI)\]/g, "").trim();
    })
    .filter(Boolean);
  return { messages: cleaned, end };
}

// Paciente por regras: diz sim a uma pergunta de confirmação, encerra quando o bot confirma
// o que foi feito, e desiste depois de alguns turnos sem progresso. Só para testar o encanamento.
export const rulePatient: Patient = {
  id: "regras",
  model: "regras",
  start(_scenario, persona) {
    let turns = 0;
    const say = (padrao: string, dificil: string) => (persona === "padrao" ? padrao : dificil);
    return {
      async reply(botReplies) {
        turns++;
        const bot = normalize(botReplies.join("\n"));
        let messages: string[];
        if (/(agendad|marcad|cancelad|remarcad|confirmad|equipe|atendente|recepcao)/.test(bot) && !bot.includes("?"))
          messages = [say("Perfeito, obrigado! [FIM]", "blz vlw [FIM]")];
        else if (/(confirma|posso marcar|posso agendar|posso cancelar|pode ser|fechado)\b.*\?/.test(bot))
          messages = [say("Sim, pode confirmar.", "ss pd")];
        else if (turns >= 4) messages = [say("Deixa para lá, obrigado. [DESISTI]", "deixa pra la [DESISTI]")];
        else messages = [say("Pode ser o primeiro horário disponível.", "qualquer um")];
        return { ...parseEnd(messages), usage: NO_USAGE };
      },
    };
  },
};
