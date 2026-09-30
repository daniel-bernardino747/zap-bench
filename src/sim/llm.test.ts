import { describe, expect, it } from "vitest";
import { ownPart } from "./llm.ts";

describe("saída do paciente simulado", () => {
  it("corta onde o modelo começa a falar pelo atendente (visto na rodada de 30/09)", () => {
    expect(ownPart("pd ser 9h\nuser Confirmando: Restauração remarcada para segunda, 05/10, às 09:00.")).toBe("pd ser 9h");
    expect(ownPart("ok\nAtendente: pronto, marcado")).toBe("ok");
  });

  it("mantém as mensagens do paciente, mesmo as que citam o atendente no meio", () => {
    expect(ownPart("oi\no atendente disse q tinha horario\nqro 9h")).toBe("oi\no atendente disse q tinha horario\nqro 9h");
    expect(ownPart("usuario novo aqui")).toBe("usuario novo aqui");
  });
});
