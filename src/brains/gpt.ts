import { toolSchemas } from "../domain/tools.ts";
import { nowLine, SYSTEM_PROMPT } from "./prompt.ts";
import { addUsage, NO_USAGE, type Brain, type Usage } from "./types.ts";

// Cérebro GPT: o mesmo prompt e as mesmas ferramentas dos cérebros Claude, pela Responses API
// (a recomendada pela OpenAI para tool use com modelos de raciocínio). Configuração padrão do
// modelo, sem mexer em reasoning effort (ADR-0002). O histórico fica aqui, não na OpenAI
// (store: false); o raciocínio volta a cada chamada como conteúdo criptografado.

// US$ por milhão de tokens (developers.openai.com/api/docs/pricing, conferido em 29/09/2026).
const PRICES: Record<string, { input: number; cachedInput: number; output: number }> = {
  "gpt-6-astra": { input: 10, cachedInput: 1, output: 50 },
};

// Chamadas ao modelo por mensagem do paciente; passou disso, o turno acaba sem resposta.
const MAX_STEPS = 8;
const ATTEMPTS = 5;

const TOOLS = toolSchemas().map((t) => {
  const { $schema: _, ...parameters } = t.inputSchema as Record<string, unknown>;
  return { type: "function", name: t.name, description: t.description, parameters, strict: false };
});

type Item =
  | { type: "message"; role: string; content: string | { type: string; text?: string }[] }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: "function_call_output"; call_id: string; output: string }
  | { type: string; [k: string]: unknown };

interface ResponseBody {
  output?: Item[];
  usage?: { input_tokens: number; output_tokens: number; input_tokens_details?: { cached_tokens?: number } };
  error?: unknown;
}

function usageOf(model: string, u: NonNullable<ResponseBody["usage"]>): Usage {
  const p = PRICES[model];
  const cached = u.input_tokens_details?.cached_tokens ?? 0;
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    costUSD: ((u.input_tokens - cached) * p.input + cached * p.cachedInput + u.output_tokens * p.output) / 1e6,
  };
}

async function create(apiKey: string, body: unknown): Promise<ResponseBody> {
  let lastError = "";
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, Math.min(30_000, 2_000 * 2 ** (attempt - 1))));
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
    const json = (await res.json()) as ResponseBody;
    if (!res.ok) throw new Error(`gpt: HTTP ${res.status} ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
    return json;
  }
  throw new Error(`gpt: sem resposta depois de ${ATTEMPTS} tentativas (${lastError})`);
}

export function gptBrain(id: string, label: string, model: string): Brain {
  if (!PRICES[model]) throw new Error(`${model}: sem preço cadastrado em src/brains/gpt.ts`);
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  return {
    id,
    label,
    model,
    start(ctx) {
      const instructions = `${SYSTEM_PROMPT}\n\n${nowLine(ctx.now)}`;
      const input: Item[] = [];

      return {
        async respond(patientText) {
          input.push({ type: "message", role: "user", content: patientText });
          const replies: string[] = [];
          let usage = NO_USAGE;

          for (let step = 0; step < MAX_STEPS; step++) {
            const response = await create(apiKey, {
              model,
              instructions,
              input,
              tools: TOOLS,
              store: false,
              include: ["reasoning.encrypted_content"],
            });
            if (response.usage) usage = addUsage(usage, usageOf(model, response.usage));
            const output = response.output ?? [];
            input.push(...output);

            // Texto antes de uma tool call também chega ao paciente, como num WhatsApp de verdade.
            const text = output
              .filter((i) => i.type === "message")
              .flatMap((i) => (i as { content: { type: string; text?: string }[] }).content)
              .filter((c) => c.type === "output_text" && c.text)
              .map((c) => c.text!.trim())
              .filter(Boolean)
              .join("\n\n");
            if (text) replies.push(text);

            const calls = output.filter((i) => i.type === "function_call") as { call_id: string; name: string; arguments: string }[];
            if (!calls.length) break;
            for (const call of calls) {
              let args: unknown;
              try {
                args = JSON.parse(call.arguments);
              } catch {
                args = call.arguments;
              }
              const r = ctx.callTool(call.name, args);
              input.push({
                type: "function_call_output",
                call_id: call.call_id,
                output: JSON.stringify(r.ok ? r.value : { erro: r.error, detalhes: r.details }),
              });
            }
          }
          return { replies, usage };
        },
      };
    },
  };
}
