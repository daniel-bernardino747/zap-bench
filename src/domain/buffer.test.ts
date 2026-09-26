import { describe, expect, it } from "vitest";
import { MessageBuffer } from "./buffer.ts";

describe("buffer de mensagens", () => {
  it("junta mensagens seguidas e responde depois do silêncio", () => {
    const b = new MessageBuffer({ quietMs: 8_000, maxWaitMs: 30_000 });
    b.push({ text: "oi", at: 0 });
    b.push({ text: "qro marca", at: 3_000 });
    b.push({ text: " pra amanha ", at: 5_000 });
    expect(b.isDue(12_999)).toBe(false);
    expect(b.isDue(13_000)).toBe(true);
    expect(b.flush().text).toBe("oi\nqro marca\npra amanha");
    expect(b.deadline()).toBeNull();
  });

  it("não deixa sem resposta quem digita sem parar", () => {
    const b = new MessageBuffer({ quietMs: 8_000, maxWaitMs: 30_000 });
    for (let at = 0; at <= 40_000; at += 5_000) b.push({ text: "a", at });
    expect(b.deadline()).toBe(30_000);
  });

  it("vazio nunca está pronto", () => {
    expect(new MessageBuffer().isDue(1e12)).toBe(false);
  });
});
