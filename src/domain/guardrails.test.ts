import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { Agenda } from "./agenda.ts";
import { checkReply, extractTimes } from "./claims.ts";
import { loadEstablishment, type Establishment } from "./establishment.ts";
import { ConversationGuard, isAffirmative, SAFE_REPLY, type Mode } from "./guardrails.ts";
import { createToolContext } from "./tools.ts";

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

describe("afirmações da resposta", () => {
  it("lê horários em vários formatos", () => {
    expect(extractTimes("às 10h, 10h30, 9:00 ou 14:30")).toEqual(["10:00", "10:30", "09:00", "14:30"]);
  });

  it("acusa preço, profissional e horário que não existem, e termo proibido", () => {
    const v = checkReply(
      "O clareamento sai R$ 300,00 com a Dra. Fernanda às 19:00. Tome ibuprofeno 600 mg.",
      clinic,
      { times: [] },
    );
    expect(v).toEqual([
      { kind: "preco", value: "R$ 300,00" },
      { kind: "profissional", value: "Dra. Fernanda" },
      { kind: "horario", value: "19:00" },
      { kind: "termo_proibido", value: "ibuprofeno" },
      { kind: "termo_proibido", value: "600 mg" },
    ]);
  });

  it("aceita valor citado numa política da clínica", () => {
    expect(checkReply("Acima de R$ 500 dá para parcelar em 3x.", clinic, { times: [] })).toEqual([]);
  });

  it("aceita o que está na configuração ou já apareceu na conversa", () => {
    expect(
      checkReply("Limpeza é R$ 180 e canal R$ 900,00, com a Dra. Ana ou o Dr. Bruno. Abrimos 08:00 e temos 10h30.", clinic, {
        times: ["10:30"],
      }),
    ).toEqual([]);
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
