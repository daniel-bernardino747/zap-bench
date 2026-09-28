import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { Agenda } from "./agenda.ts";
import { checkReply, extractTimes, factsFrom, type KnownFacts } from "./claims.ts";
import { loadEstablishment, type Establishment } from "./establishment.ts";
import { ConversationGuard, isAffirmative, SAFE_REPLY, type Mode } from "./guardrails.ts";
import { createToolContext, runTool } from "./tools.ts";

let clinic: Establishment;
beforeAll(async () => {
  clinic = await loadEstablishment(
    fileURLToPath(new URL("../../establishments/clinica-odontologica.json", import.meta.url)),
  );
});

// Segunda, 28/09/2026, 09:10. Terça é 29/09.
function guard(mode: Mode) {
  return new ConversationGuard(createToolContext(new Agenda(clinic, { date: "2026-09-28", time: "09:10" }), "5548999990001"), mode);
}

const booking = { nome_paciente: "Maria", servico: "limpeza", data: "2026-09-29", hora: "10:00" };

const NOTHING: KnownFacts = { times: [], prices: [], names: [], texts: [], policiesConsulted: false, actionsThisTurn: [] };
const vocab = () => ({ insurances: clinic.insurances });

// Fatos como o guard monta: o que as funções devolveram nesta conversa.
function factsAfter(calls: [string, object][], extra: Partial<KnownFacts> = {}): KnownFacts {
  const ctx = createToolContext(new Agenda(clinic, { date: "2026-09-28", time: "09:10" }), "5548999990001");
  const results = calls.map(([name, input]) => runTool(ctx, name, input)).filter((r) => r.ok).map((r) => (r as { value: unknown }).value);
  return { ...NOTHING, ...factsFrom(results), policiesConsulted: calls.some(([n]) => n === "consultar_politicas"), ...extra };
}

describe("afirmações da resposta", () => {
  it("lê horários em vários formatos", () => {
    expect(extractTimes("às 10h, 10h30, 9:00 ou 14:30")).toEqual(["10:00", "10:30", "09:00", "14:30"]);
  });

  it("sem ter consultado nada, nenhum fato pode ser citado, nem os que existem na clínica", () => {
    const v = checkReply("A limpeza é R$ 180 com a Dra. Ana às 10:00. Aceitamos Amil.", NOTHING, vocab());
    expect(v).toEqual([
      { kind: "preco", value: "R$ 180" },
      { kind: "profissional", value: "Dra. Ana" },
      { kind: "horario", value: "10:00" },
      { kind: "convenio", value: "Amil Dental" },
    ]);
  });

  it("aceita o que veio das funções: serviço, convênio, clínica, horários", () => {
    const facts = factsAfter([
      ["consultar_servico", { servico: "limpeza" }],
      ["consultar_servico", { servico: "canal" }],
      ["verificar_convenio", { convenio: "amil", servico: "limpeza" }],
      ["info_clinica", {}],
      ["buscar_horarios", { servico: "limpeza", a_partir_de: "2026-09-29", dias: 1, depois: "10:30", antes: "11:00" }],
    ]);
    expect(
      checkReply(
        "Limpeza é R$ 180 e canal R$ 900,00, com a Dra. Ana ou a Dra. Carla. O Amil cobre. Abrimos 08:00 e temos 10h30.",
        facts,
        vocab(),
      ),
    ).toEqual([]);
  });

  it("acusa preço e profissional que não vieram de função, e termo proibido", () => {
    const v = checkReply("O clareamento sai R$ 300,00 com a Dra. Fernanda. Tome ibuprofeno 600 mg.", factsAfter([["consultar_servico", { servico: "clareamento" }]]), vocab());
    expect(v).toEqual([
      { kind: "preco", value: "R$ 300,00" },
      { kind: "profissional", value: "Dra. Fernanda" },
      { kind: "termo_proibido", value: "ibuprofeno" },
      { kind: "termo_proibido", value: "600 mg" },
    ]);
  });

  it("política só pode ser citada depois de consultada, e aí o valor dela vale", () => {
    const text = "Acima de R$ 500 dá para parcelar em 3x.";
    expect(checkReply(text, NOTHING, vocab()).map((v) => v.kind)).toEqual(["preco", "politica"]);
    expect(checkReply(text, factsAfter([["consultar_politicas", {}]]), vocab())).toEqual([]);
  });

  it("ação dita como feita exige a função com sucesso neste turno; negação não conta", () => {
    expect(checkReply("Pronto, sua consulta foi cancelada.", NOTHING, vocab())).toEqual([{ kind: "acao_nao_executada", value: "cancelada" }]);
    expect(checkReply("Pronto, cancelada.", { ...NOTHING, actionsThisTurn: ["cancelar"] }, vocab())).toEqual([]);
    expect(checkReply("Não encontrei, então nada foi cancelado.", NOTHING, vocab())).toEqual([]);
    expect(checkReply("Sua consulta não foi cancelada.", NOTHING, vocab())).toEqual([]);
  });

  it("admitir que não sabe de uma política não é citar a política", () => {
    const text = "Não tenho informação sobre desconto para estudante. Vou chamar alguém da equipe.";
    expect(checkReply(text, NOTHING, vocab())).toEqual([]);
    expect(checkReply("Temos desconto de 10% para estudante.", NOTHING, vocab())).toEqual([{ kind: "politica", value: "desconto" }]);
  });

  it("descrever consultas já listadas não é afirmar que agendou", () => {
    const listed = { ...NOTHING, appointmentsListed: true };
    expect(checkReply("Você tem 2 consultas marcadas. Qual delas?", listed, vocab())).toEqual([]);
    expect(checkReply("Você tem 2 consultas marcadas. Qual delas?", NOTHING, vocab())).toEqual([{ kind: "acao_nao_executada", value: "marcadas" }]);
    expect(checkReply("Pronto, sua limpeza foi marcada!", listed, vocab())).toEqual([{ kind: "acao_nao_executada", value: "marcada" }]);
  });
});

describe("sim do paciente", () => {
  it.each(["sim", "Simmm", "ss", "pode sim", "confirmo", "blz", "👍", "isso msm pd marcar"])("'%s' é sim", (t) =>
    expect(isAffirmative(t)).toBe(true),
  );
  it.each(["não", "nao quero", "n", "sim não, errado", "qual horário?"])("'%s' não é sim", (t) =>
    expect(isAffirmative(t)).toBe(false),
  );
});

describe("modo bruto", () => {
  it("agenda sem confirmação e só registra a violação da resposta", () => {
    const g = guard("bruto");
    g.beginTurn("marca limpeza amanha 10h");
    expect(g.callTool("agendar", booking).ok).toBe(true);
    expect(g.filterReply("Pronto! Ficou R$ 99.")).toBe("Pronto! Ficou R$ 99.");
    expect(g.replies[0].violations).toEqual([{ kind: "preco", value: "R$ 99" }]);
  });
});

describe("modo com guardrails", () => {
  it("só agenda depois que o bot citou dia e hora e o paciente disse sim", () => {
    const g = guard("guardrails");
    g.beginTurn("marca limpeza amanha 10h");
    expect(g.callTool("agendar", booking)).toMatchObject({ ok: false, error: "confirmacao_necessaria" });
    g.filterReply("Posso marcar limpeza na terça, 29/09, às 10:00?");
    g.beginTurn("sim pode");
    expect(g.callTool("agendar", booking).ok).toBe(true);
    expect(g.ctx.log.map((c) => c.result.ok)).toEqual([false, true]);
  });

  it("não aceita confirmação de outro horário nem um não", () => {
    const g = guard("guardrails");
    g.beginTurn("marca limpeza");
    g.filterReply("Posso marcar amanhã às 11:00?");
    g.beginTurn("sim");
    expect(g.callTool("agendar", booking)).toMatchObject({ error: "confirmacao_necessaria" });

    g.filterReply("Então amanhã às 10:00?");
    g.beginTurn("não, errado");
    expect(g.callTool("agendar", booking)).toMatchObject({ error: "confirmacao_necessaria" });
  });

  it("permite uma ação destrutiva por turno", () => {
    const g = guard("guardrails");
    g.beginTurn("marca 2 limpezas amanha 10h e 10h30");
    g.filterReply("Confirma amanhã às 10:00 e às 10:30?");
    g.beginTurn("sim");
    expect(g.callTool("agendar", booking).ok).toBe(true);
    expect(g.callTool("agendar", { ...booking, hora: "10:30" })).toMatchObject({ error: "uma_acao_por_vez" });
  });

  it("cancelar confirma pelo dia e hora do agendamento, não pelo id", () => {
    const g = guard("bruto");
    g.beginTurn("marca");
    g.callTool("agendar", booking);
    const guarded = new ConversationGuard(g.ctx, "guardrails");
    guarded.beginTurn("cancela minha consulta");
    expect(guarded.callTool("cancelar", { agendamento: "ag-1" })).toMatchObject({ error: "confirmacao_necessaria" });
    guarded.filterReply("Cancelo a limpeza de terça às 10:00?");
    guarded.beginTurn("isso");
    expect(guarded.callTool("cancelar", { agendamento: "ag-1" }).ok).toBe(true);
  });

  it("horário oferecido sem vir de ferramenta nem do paciente derruba a resposta, e ela não vale como confirmação", () => {
    const g = guard("guardrails");
    g.beginTurn("marca limpeza amanha");
    expect(g.filterReply("Confirma amanhã às 10:00?")).toBe(SAFE_REPLY);
    g.beginTurn("sim");
    expect(g.callTool("agendar", booking)).toMatchObject({ error: "confirmacao_necessaria" });
  });

  it("troca a resposta com afirmação inventada pelo template seguro", () => {
    const g = guard("guardrails");
    g.beginTurn("quanto é o clareamento?");
    expect(g.filterReply("O clareamento é R$ 300.")).toBe(SAFE_REPLY);
    expect(g.replies[0]).toMatchObject({ reply: "O clareamento é R$ 300.", sent: SAFE_REPLY });
  });

  it("aceita horário que veio de uma ferramenta", () => {
    const g = guard("guardrails");
    g.beginTurn("tem horario amanha a tarde?");
    g.callTool("buscar_horarios", { servico: "limpeza", a_partir_de: "2026-09-29", dias: 1, depois: "14:00" });
    expect(g.filterReply("Tenho amanhã às 14:00 ou 14:30.")).toBe("Tenho amanhã às 14:00 ou 14:30.");
  });
});
