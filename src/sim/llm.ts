import personas from "../../scenarios/personas.json" with { type: "json" };
import type { ConversationScenario } from "../scenarios/schema.ts";
import { parseEnd, PatientUnavailableError, type Patient, type Persona } from "./patient.ts";

const ATTEMPTS = 8;

// Paciente simulado por um LLM fora da comparação (ADR-0003), por qualquer endpoint
// compatível com /chat/completions da OpenAI (ex.: modelo gratuito do OpenCode Zen).
// Ele recebe a persona, o objetivo, o que sabe e o próprio nome, e fala só como paciente.

// Famílias comparadas, ou de origem não revelada que pode ser uma delas: nunca como paciente.
const FORBIDDEN_MODEL = /claude|gpt|opus|sonnet|haiku|fable|big-pickle|stealth/i;

export interface SimConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

export function simConfig(env: NodeJS.ProcessEnv): SimConfig | null {
  const baseURL = env.SIM_BASE_URL?.trim();
  const model = env.SIM_MODEL?.trim();
  const apiKey = env.SIM_API_KEY?.trim();
  if (!baseURL || !model || !apiKey) return null;
  if (FORBIDDEN_MODEL.test(model)) throw new Error(`SIM_MODEL=${model}: o paciente não pode ser Claude, GPT nem modelo de origem não revelada (ADR-0003)`);
  return { baseURL: baseURL.replace(/\/$/, ""), model, apiKey };
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chat(c: SimConfig, messages: ChatMessage[]): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  // Plano gratuito tem picos de 503 que passam em minutos: espera crescente, até ~4 min no total.
  let lastError = "";
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, Math.min(60_000, 5_000 * 2 ** (attempt - 1))));
    const res = await fetch(`${c.baseURL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: c.model, messages, max_tokens: 1_000 }),
      signal: AbortSignal.timeout(180_000),
    }).catch((e: Error) => e);
    if (res instanceof Error) {
      lastError = res.message;
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      lastError = `HTTP ${res.status}`;
      continue;
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      error?: unknown;
    };
    if (!res.ok) throw new Error(`paciente simulado: HTTP ${res.status} ${JSON.stringify(body.error ?? body).slice(0, 300)}`);
    return {
      text: body.choices?.[0]?.message?.content ?? "",
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    };
  }
  throw new PatientUnavailableError(`paciente simulado: sem resposta depois de ${ATTEMPTS} tentativas (${lastError})`);
}

function systemPrompt(s: ConversationScenario, persona: Persona): string {
  const p = personas[persona] as { descricao: string; exemplos: string[]; regras?: string[]; desiste: string | null };
  return [
    "Você está interpretando um PACIENTE que conversa pelo WhatsApp com o atendimento automático de uma clínica odontológica. Você nunca é o atendente, nunca explica o que está fazendo e nunca revela que é uma simulação.",
    `Seu nome: ${s.nome_paciente}.`,
    `Seu objetivo: ${s.persona.objetivo}.`,
    `O que você sabe: ${s.persona.sabe.join("; ")}.`,
    `Seu jeito de escrever: ${p.descricao}`,
    `Exemplos do seu jeito: ${p.exemplos.map((e) => `"${e}"`).join(", ")}.`,
    ...(p.regras ?? []).map((r) => `Regra: ${r}`),
    ...(p.desiste ? [`Quando desistir: ${p.desiste}`] : []),
    personas.encerramento,
    "Formato da resposta: só as mensagens do paciente, uma por linha, sem aspas, sem nome, sem explicação.",
  ].join("\n");
}

export function llmPatient(c: SimConfig): Patient {
  return {
    id: "llm",
    model: c.model,
    start(scenario, persona) {
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt(scenario, persona) },
        { role: "assistant", content: scenario.persona.abertura[persona] },
      ];
      return {
        async reply(botReplies) {
          messages.push({ role: "user", content: botReplies.join("\n\n") || "(o atendimento não respondeu)" });
          const r = await chat(c, messages);
          // Modelos com raciocínio às vezes devolvem o raciocínio junto: fica só o que vem depois.
          const text = r.text.replace(/<(think|thought)>[\s\S]*?(<\/(think|thought)>|$)/g, "").trim();
          messages.push({ role: "assistant", content: text });
          const lines = text
            .split("\n")
            .map((l) => l.replace(/^["'\-•\s]+|["'\s]+$/g, "").trim())
            .filter(Boolean)
            .slice(0, 3);
          return { ...parseEnd(lines), usage: { inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUSD: 0 } }; // modelo gratuito; um pago precisa de preço aqui
        },
      };
    },
  };
}
