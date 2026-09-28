import Anthropic from "@anthropic-ai/sdk";
import { toolSchemas } from "../domain/tools.ts";
import { nowLine, SYSTEM_PROMPT } from "./prompt.ts";
import { addUsage, NO_USAGE, type Brain, type Usage } from "./types.ts";

// Cérebro Claude: prompt + ferramentas e um laço de tool use, sem ajuste nenhum além disso
// (ADR-0002). Configuração padrão de cada modelo (sem mexer em thinking nem effort), para
// comparar o que alguém ligaria na prática.

// US$ por milhão de tokens (platform.claude.com, conferido em 28/09/2026).
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

// Chamadas ao modelo por mensagem do paciente; passou disso, o turno acaba sem resposta.
const MAX_STEPS = 8;

const TOOLS: Anthropic.Tool[] = toolSchemas().map((t) => {
  const { $schema: _, ...schema } = t.inputSchema as Record<string, unknown>;
  return { name: t.name, description: t.description, input_schema: schema as Anthropic.Tool.InputSchema };
});

function usageOf(model: string, u: Anthropic.Usage): Usage {
  const p = PRICES[model];
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const inputCost = (u.input_tokens + cacheWrite * 1.25 + cacheRead * 0.1) * p.input;
  return {
    inputTokens: u.input_tokens + cacheWrite + cacheRead,
    outputTokens: u.output_tokens,
    costUSD: (inputCost + u.output_tokens * p.output) / 1e6,
  };
}

export function claudeBrain(id: string, label: string, model: string): Brain {
  const client = new Anthropic({ maxRetries: 4 });
  return {
    id,
    label,
    model,
    start(ctx) {
      const system = `${SYSTEM_PROMPT}\n\n${nowLine(ctx.now)}`;
      const messages: Anthropic.MessageParam[] = [];

      return {
        async respond(patientText) {
          messages.push({ role: "user", content: patientText });
          const replies: string[] = [];
          let usage = NO_USAGE;

          for (let step = 0; step < MAX_STEPS; step++) {
            const response = await client.messages.create({
              model,
              max_tokens: 16000,
              cache_control: { type: "ephemeral" },
              system,
              tools: TOOLS,
              messages,
            });
            usage = addUsage(usage, usageOf(model, response.usage));
            messages.push({ role: "assistant", content: response.content });

            // Texto antes de uma tool call também chega ao paciente, como num WhatsApp de verdade.
            const text = response.content
              .filter((b): b is Anthropic.TextBlock => b.type === "text")
              .map((b) => b.text.trim())
              .filter(Boolean)
              .join("\n\n");
            if (text) replies.push(text);

            if (response.stop_reason !== "tool_use") break;
            const results: Anthropic.ToolResultBlockParam[] = response.content
              .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
              .map((b) => {
                const r = ctx.callTool(b.name, b.input);
                return {
                  type: "tool_result",
                  tool_use_id: b.id,
                  content: JSON.stringify(r.ok ? r.value : { erro: r.error, detalhes: r.details }),
                  is_error: !r.ok,
                };
              });
            messages.push({ role: "user", content: results });
          }
          return { replies, usage };
        },
      };
    },
  };
}
