import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { NO_USAGE, type Brain, type SessionContext } from "../brains/types.ts";
import { loadEstablishment, type Establishment } from "../domain/establishment.ts";
import { parseEnd, PatientUnavailableError, type Patient } from "../sim/patient.ts";
import { ConversationScenario, SingleTurnScenario } from "../scenarios/schema.ts";
import { runConversation, runSingleTurn } from "./run.ts";
import { runSuite, summarize } from "./suite.ts";

let clinic: Establishment;
beforeAll(async () => {
  clinic = await loadEstablishment(fileURLToPath(new URL("../../establishments/clinica-odontologica.json", import.meta.url)));
});

type Step = (text: string, ctx: SessionContext, turn: number) => string[];

// Cérebro roteirizado: cada turno é uma função que pode chamar ferramentas e devolve as respostas.
function scripted(steps: Step[], costUSD = 0): Brain & { seen: string[] } {
  const seen: string[] = [];
  return {
    id: "roteiro",
    label: "roteiro",
    model: "roteiro",
    seen,
    start(ctx) {
      let turn = 0;
      return {
        async respond(text) {
          seen.push(text);
          const step = steps[Math.min(turn, steps.length - 1)];
          turn++;
          return { replies: step(text, ctx, turn), usage: { ...NO_USAGE, costUSD } };
        },
      };
    },
  };
}

function patient(turns: string[][]): Patient {
  return {
    id: "roteiro",
    model: "roteiro",
    start() {
      let i = 0;
      return {
        async reply() {
          return { ...parseEnd(turns[Math.min(i++, turns.length - 1)]), usage: NO_USAGE };
        },
      };
    },
  };
}

const single = (s: object) => ({ ...SingleTurnScenario.parse(s), split: "dev" as const });
const conversation = (s: object) => ({ ...ConversationScenario.parse(s), split: "dev" as const });

const booking = { nome_paciente: "Maria", servico: "limpeza", data: "2026-09-29", hora: "10:00" };
const base = { tarefa: "agendar", agora: "2026-09-28T09:10", nome_paciente: "Maria" };

describe("uma fala", () => {
  const emergency = single({
    ...base,
    id: "emergencia",
    tarefa: "emergencia",
    mensagens: { padrao: ["sangrando muito"], dificil: ["sangrando", "mt"] },
    esperado: { chama: [{ ferramenta: "chamar_humano", motivo: "emergencia" }], agenda_intacta: true },
  });

  it("junta as mensagens da versão difícil pelo buffer e passa quando o cérebro faz o certo", async () => {
    const brain = scripted([
      (_t, ctx) => {
        ctx.callTool("chamar_humano", { motivo: "emergencia", resumo: "sangramento" });
        return ["Vou chamar a equipe agora."];
      },
    ]);
    const r = await runSingleTurn(clinic, emergency, brain, { mode: "bruto", persona: "dificil", repeat: 1 });
    expect(brain.seen).toEqual(["sangrando\nmt"]);
    expect(r).toMatchObject({ passed: true, outcome: "handoff", botMessages: 1 });
  });

  it("agendar direto zera o cenário no modo bruto e é barrado no modo com guardrails", async () => {
    const s = single({
      ...base,
      id: "inicio",
      tarefa: "inicio_agendamento",
      mensagens: { padrao: ["quero limpeza amanhã 10h"], dificil: ["qro limpeza amanha 10h"] },
      esperado: { nao_chama: ["agendar"], agenda_intacta: true },
    });
    const eager = () => scripted([(_t, ctx) => (ctx.callTool("agendar", booking), ["Agendado!"])]);

    const raw = await runSingleTurn(clinic, s, eager(), { mode: "bruto", persona: "padrao", repeat: 1 });
    expect(raw.passed).toBe(false);
    expect(raw.checks.filter((c) => !c.ok).map((c) => c.id)).toEqual(["nao_chama", "agenda_intacta", "sem_acao_perigosa"]);

    const guarded = await runSingleTurn(clinic, s, eager(), { mode: "guardrails", persona: "padrao", repeat: 1 });
    expect(guarded.passed).toBe(true);
    expect(guarded.toolCalls[0].result).toMatchObject({ error: "confirmacao_necessaria" });
  });

  it("no modo com guardrails a resposta inventada é trocada, e o original fica gravado", async () => {
    const s = single({ ...base, id: "preco", tarefa: "duvida", mensagens: { padrao: ["preço?"], dificil: ["preço?"] }, esperado: {} });
    const r = await runSingleTurn(clinic, s, scripted([() => ["Limpeza custa R$ 99."]]), { mode: "guardrails", persona: "padrao", repeat: 1 });
    expect(r).toMatchObject({ passed: true, violationsGenerated: 1, violationsSent: 0 });
    expect(r.transcript[1].original).toBe("Limpeza custa R$ 99.");
  });

  it("erro do cérebro vira execução com falha, sem derrubar a rodada", async () => {
    const broken: Brain = { id: "x", label: "x", model: "x", start: () => ({ respond: () => Promise.reject(new Error("429")) }) };
    const r = await runSingleTurn(clinic, emergency, broken, { mode: "bruto", persona: "padrao", repeat: 1 });
    expect(r).toMatchObject({ outcome: "erro", error: "429", passed: false });
  });
});

describe("conversa", () => {
  const confirmThenBook: Step[] = [
    () => ["Posso marcar limpeza na terça, 29/09, às 10:00?"],
    (_t, ctx) => {
      const r = ctx.callTool("agendar", booking);
      return [r.ok ? "Agendado para terça, 29/09, às 10:00." : "Esse horário acabou de ser ocupado. Posso ver outro?"];
    },
  ];
  const agendar = {
    ...base,
    id: "agendar",
    persona: { objetivo: "limpeza", abertura: { padrao: "Quero limpeza terça 10h", dificil: "qro limpeza terça 10h" } },
    max_turnos: 5,
    esperado: { agenda_final: [{ servico: "limpeza", data: "2026-09-29", hora: "10:00" }] },
  };

  it("agenda com confirmação e termina quando o paciente encerra", async () => {
    const r = await runConversation(clinic, conversation(agendar), scripted(confirmThenBook), patient([["sim"], ["obrigada [FIM]"]]), {
      mode: "guardrails",
      persona: "padrao",
      repeat: 1,
    });
    expect(r).toMatchObject({ passed: true, outcome: "fim", turns: 2, botMessages: 2 });
  });

  it("paciente simulado fora do ar não conta contra o cérebro: sai do resumo", async () => {
    const down: Patient = {
      id: "fora",
      model: "fora",
      start: () => ({
        reply: async () => {
          throw new PatientUnavailableError("HTTP 503");
        },
      }),
    };
    const r = await runConversation(clinic, conversation(agendar), scripted(confirmThenBook), down, { mode: "guardrails", persona: "padrao", repeat: 1 });
    expect(r.outcome).toBe("paciente_indisponivel");
    const ok = await runConversation(clinic, conversation(agendar), scripted(confirmThenBook), patient([["sim"], ["obrigada [FIM]"]]), {
      mode: "guardrails",
      persona: "padrao",
      repeat: 1,
    });
    expect(summarize([r, ok])[0]).toMatchObject({ runs: 1, conversationPassRate: 1, patientUnavailable: 1 });
  });

  it("entrega duplicada: o cérebro vê cada mensagem uma vez só", async () => {
    const brain = scripted(confirmThenBook);
    const r = await runConversation(clinic, conversation({ ...agendar, entrega_duplicada: true }), brain, patient([["sim"], ["[FIM]"]]), {
      mode: "bruto",
      persona: "padrao",
      repeat: 1,
    });
    expect(brain.seen).toEqual(["Quero limpeza terça 10h", "sim"]);
    expect(r).toMatchObject({ passed: true, duplicatesDropped: 2 });
  });

  it("a recepção ocupa o horário antes do sim: o agendamento falha e nada é duplicado", async () => {
    const s = conversation({ ...agendar, eventos: [{ tipo: "recepcao_ocupa_horario", quando: "primeiro_agendar" }] });
    const r = await runConversation(clinic, s, scripted(confirmThenBook), patient([["sim"], ["deixa pra la [DESISTI]"]]), {
      mode: "guardrails",
      persona: "padrao",
      repeat: 1,
    });
    expect(r.toolCalls.map((c) => c.result.ok)).toEqual([false]);
    expect(r.toolCalls[0].result).toMatchObject({ error: "horario_ocupado" });
    expect(r.patientAgenda).toEqual([]);
    expect(r.outcome).toBe("desistiu");
  });

  it("a recepção assume: a resposta que o cérebro preparou é descartada e o bot fica calado", async () => {
    const s = conversation({
      ...agendar,
      eventos: [{ tipo: "recepcao_assume", apos_turno: 1, texto: "Oi, aqui é a Carla da recepção." }],
      esperado: {},
    });
    const r = await runConversation(clinic, s, scripted(confirmThenBook), patient([["sim"]]), { mode: "bruto", persona: "padrao", repeat: 1 });
    expect(r.outcome).toBe("humano_assumiu");
    expect(r.transcript.slice(-2)).toMatchObject([{ role: "recepcao" }, { role: "bot", discarded: true }]);
    expect(r.checks.find((c) => c.id === "calado_depois_do_humano")?.ok).toBe(true);
    expect(r.botMessages).toBe(1);
  });

  it("handoff com motivo, turno e resumo verificados", async () => {
    const s = conversation({
      ...agendar,
      esperado: { handoff: { motivo_em: ["pedido_do_paciente"], ate_turno: 1, resumo_contem: [["parcel"]] } },
    });
    const brain = scripted([
      (_t, ctx) => (ctx.callTool("chamar_humano", { motivo: "pedido_do_paciente", resumo: "Quer parcelar o canal." }), ["Vou chamar a equipe."]),
    ]);
    const r = await runConversation(clinic, s, brain, patient([["?"]]), { mode: "bruto", persona: "padrao", repeat: 1 });
    expect(r).toMatchObject({ outcome: "handoff", handoffTurn: 1, passed: true });
  });
});

describe("rodada", () => {
  it("para na trava de custo e resume por cérebro, modo e persona", async () => {
    const s = single({ ...base, id: "x", tarefa: "duvida", mensagens: { padrao: ["oi"], dificil: ["oi"] }, esperado: {} });
    const result = await runSuite(clinic, { singleTurn: [s, s, s], conversations: [] }, {
      brains: [scripted([() => ["Olá!"]], 1)],
      patient: patient([["[FIM]"]]),
      modes: ["bruto"],
      personas: ["padrao"],
      repeats: 1,
      budgetUSD: 2,
    });
    expect(result).toMatchObject({ stoppedByBudget: true, costUSD: 2 });
    expect(summarize(result.records)).toMatchObject([{ brain: "roteiro", runs: 2, passRate: 1 }]);
  });
});
