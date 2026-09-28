import { claudeBrain } from "./claude.ts";
import { jevBrain } from "./jev.ts";
import { rulesBrain } from "./rules.ts";
import type { Brain } from "./types.ts";

// Registro dos cérebros. Um cérebro sem chave no .env, ou ainda não implementado, é pulado
// com aviso e a rodada continua (ADR-0002).

interface Entry {
  id: string;
  env?: string;
  create?: () => Brain;
}

export const BRAINS: Entry[] = [
  { id: "regras", create: () => rulesBrain },
  { id: "sonnet", env: "ANTHROPIC_API_KEY", create: () => claudeBrain("sonnet", "Claude Sonnet 5", "claude-sonnet-5") },
  { id: "haiku", env: "ANTHROPIC_API_KEY", create: () => claudeBrain("haiku", "Claude Haiku 4.5", "claude-haiku-4-5") },
  { id: "gpt", env: "OPENAI_API_KEY" },
  { id: "jev", env: "TYPESAFE_API_KEY", create: () => jevBrain },
];

// Modelos que estão na comparação: o paciente simulado e o juiz nunca podem ser um deles (ADR-0010).
export const BRAIN_MODELS = ["claude-sonnet-5", "claude-haiku-4-5", "jev-1.13.0"];

export function resolveBrains(ids: string[], env: NodeJS.ProcessEnv): { brains: Brain[]; skipped: string[] } {
  const brains: Brain[] = [];
  const skipped: string[] = [];
  for (const id of ids) {
    const entry = BRAINS.find((b) => b.id === id);
    if (!entry) skipped.push(`${id}: não existe (disponíveis: ${BRAINS.map((b) => b.id).join(", ")})`);
    else if (entry.env && !env[entry.env]) skipped.push(`${id}: falta ${entry.env} no .env`);
    else if (!entry.create) skipped.push(`${id}: ainda não implementado`);
    else brains.push(entry.create());
  }
  return { brains, skipped };
}
