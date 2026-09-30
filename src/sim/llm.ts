import Anthropic from "@anthropic-ai/sdk";
import personas from "../../scenarios/personas.json" with { type: "json" };
import { BRAIN_MODELS } from "../brains/index.ts";
import type { Usage } from "../brains/types.ts";
import type { ConversationScenario } from "../scenarios/schema.ts";
import { parseEnd, PatientUnavailableError, type Patient, type Persona } from "./patient.ts";

// Paciente simulado por um LLM (ADR-0010). Nunca um modelo que está na comparação, e o
// paciente não sabe com qual cérebro fala: só recebe as mensagens do bot. Dois caminhos:
// um modelo Claude pela API da Anthropic, ou qualquer endpoint compatível com
// /chat/completions da OpenAI.

// US$ por milhão de tokens (platform.claude.com, conferido em 28/09/2026).
const ANTHROPIC_PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
};

// Modelo de origem não revelada pode ser um dos comparados por baixo.
const UNDISCLOSED = /big-pickle|stealth|bunny/i;

const ATTEMPTS = 8;

export type SimConfig =
  | { provider: "anthropic"; model: string }
  | { provider: "openai-compatible"; model: string; baseURL: string; apiKey: string };

export function simConfig(env: NodeJS.ProcessEnv): SimConfig | null {
  const model = env.SIM_MODEL?.trim();
  if (!model) return null;
  if (BRAIN_MODELS.includes(model) || /gpt/i.test(model))
    throw new Error(`SIM_MODEL=${model}: o paciente não pode ser um modelo da comparação (ADR-0010)`);
  if (UNDISCLOSED.test(model)) throw new Error(`SIM_MODEL=${model}: modelo de origem não revelada (ADR-0010)`);

  if (model.startsWith("claude-")) {
    if (!ANTHROPIC_PRICES[model]) throw new Error(`SIM_MODEL=${model}: sem preço cadastrado em src/sim/llm.ts`);
    if (!env.ANTHROPIC_API_KEY?.trim()) throw new Error(`SIM_MODEL=${model} precisa de ANTHROPIC_API_KEY`);
    return { provider: "anthropic", model };
  }
  const baseURL = env.SIM_BASE_URL?.trim();
  const apiKey = env.SIM_API_KEY?.trim();
  if (!baseURL || !apiKey) return null;
  return { provider: "openai-compatible", model, baseURL: baseURL.replace(/\/$/, ""), apiKey };
}

type Turn = { role: "user" | "assistant"; content: string };
type Chat = (system: string, turns: Turn[]) => Promise<{ text: string; usage: Usage }>;

function anthropicChat(model: string): Chat {
  const client = new Anthropic({ maxRetries: 6 });
  const price = ANTHROPIC_PRICES[model];
  return async (system, turns) => {
    try {
      // Interpretar um paciente é tarefa curta: esforço baixo. Fallback do servidor para o
      // caso raro de o modelo recusar o pedido.
      const response = await client.beta.messages.create({
        model,
        max_tokens: 4_000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        cache_control: { type: "ephemeral" },
        system,
        messages: turns,
      } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
      if (response.stop_reason === "refusal") throw new PatientUnavailableError("paciente simulado: o modelo recusou o papel");
      const u = response.usage;
      const cacheWrite = u.cache_creation_input_tokens ?? 0;
      const cacheRead = u.cache_read_input_tokens ?? 0;
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return {
        text,
        usage: {
          inputTokens: u.input_tokens + cacheWrite + cacheRead,
          outputTokens: u.output_tokens,
          costUSD: ((u.input_tokens + cacheWrite * 1.25 + cacheRead * 0.1) * price.input + u.output_tokens * price.output) / 1e6,
        },
      };
    } catch (e) {
      // Depois das novas tentativas do SDK, fila ou queda da API não medem o cérebro.
      if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError)
        throw new PatientUnavailableError(`paciente simulado: ${e.message}`);
      throw e;
    }
  };
}

function openAICompatibleChat(c: { model: string; baseURL: string; apiKey: string }): Chat {
  return async (system, turns) => {
    // Planos gratuitos têm picos de 503/429 que passam em minutos: espera crescente, ~4 min.
    let lastError = "";
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, Math.min(60_000, 5_000 * 2 ** (attempt - 1))));
      const res = await fetch(`${c.baseURL}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: c.model, messages: [{ role: "system", content: system }, ...turns], max_tokens: 1_000 }),
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
        // Só modelos gratuitos por aqui por enquanto; um pago precisa de preço.
        usage: { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0, costUSD: 0 },
      };
    }
    throw new PatientUnavailableError(`paciente simulado: sem resposta depois de ${ATTEMPTS} tentativas (${lastError})`);
  };
}

// Às vezes o modelo continua a conversa pelo outro lado ("user Confirmando: remarcada..."):
// dali em diante não é o paciente falando, e não pode chegar ao bot.
const ROLE_LINE = /^(user|assistant|human|atendente|bot)\b\s*:?/i;

export function ownPart(text: string): string {
  const lines = text.split("\n");
  const cut = lines.findIndex((l) => ROLE_LINE.test(l.trim()));
  return (cut < 0 ? lines : lines.slice(0, cut)).join("\n").trim();
}

function systemPrompt(s: ConversationScenario, persona: Persona): string {
  const p = personas[persona] as { descricao: string; exemplos: string[]; regras?: string[]; desiste: string | null };
  return [
    "Você está interpretando um PACIENTE que conversa pelo WhatsApp com o atendimento automático de uma clínica odontológica. Você nunca é o atendente, nunca explica o que está fazendo e nunca revela que é uma simulação.",
    `Seu nome: ${s.nome_paciente}.`,
    `Seu objetivo: ${s.persona.objetivo}.`,
    `O que você sabe: ${s.persona.sabe.join("; ")}.`,
    "Só aceite dia, horário ou opção que combine com o que você sabe. Se o atendente oferecer algo fora disso, recuse e diga o que você quer.",
    `Seu jeito de escrever: ${p.descricao}`,
    `Exemplos do seu jeito: ${p.exemplos.map((e) => `"${e}"`).join(", ")}.`,
    ...(p.regras ?? []).map((r) => `Regra: ${r}`),
    ...(p.desiste ? [`Quando desistir: ${p.desiste}`] : []),
    personas.encerramento,
    "Formato da resposta: só as mensagens do paciente, uma por linha, sem aspas, sem nome, sem explicação.",
  ].join("\n");
}

export function llmPatient(c: SimConfig): Patient {
  const chat = c.provider === "anthropic" ? anthropicChat(c.model) : openAICompatibleChat(c);
  return {
    id: "llm",
    model: c.model,
    start(scenario, persona) {
      const system = systemPrompt(scenario, persona);
      // A conversa precisa começar por "user"; a abertura do paciente vem do cenário.
      const turns: Turn[] = [
        { role: "user", content: "(o paciente abre a conversa)" },
        { role: "assistant", content: scenario.persona.abertura[persona] },
      ];
      return {
        async reply(botReplies) {
          turns.push({ role: "user", content: botReplies.join("\n\n") || "(o atendimento não respondeu)" });
          const r = await chat(system, turns);
          // Modelos com raciocínio às vezes devolvem o raciocínio junto: fica só o que vem depois.
          const text = ownPart(r.text.replace(/<(think|thought)>[\s\S]*?(<\/(think|thought)>|$)/g, "").trim());
          turns.push({ role: "assistant", content: text || "?" });
          const lines = text
            .split("\n")
            .map((l) => l.replace(/^["'\-•\s]+|["'\s]+$/g, "").trim())
            .filter(Boolean)
            .slice(0, 3);
          return { ...parseEnd(lines), usage: r.usage };
        },
      };
    },
  };
}
