// Paciente de WhatsApp manda "oi", "qro marca", "pra amanha" em sequência. O bot espera um
// silêncio curto e responde tudo de uma vez: menos respostas picadas, e cada resposta do bot
// custa dinheiro na Meta (ADR-0008). Igual para os quatro cérebros; o tempo é injetado para
// que a simulação seja determinística.

export interface Incoming {
  text: string;
  at: number;
}

export interface BufferPolicy {
  quietMs: number;
  maxWaitMs: number;
}

export const DEFAULT_BUFFER: BufferPolicy = { quietMs: 8_000, maxWaitMs: 30_000 };

export class MessageBuffer {
  private pending: Incoming[] = [];

  constructor(private readonly policy: BufferPolicy = DEFAULT_BUFFER) {}

  push(message: Incoming): void {
    this.pending.push(message);
  }

  // Quando o bot deve responder: depois de `quietMs` sem mensagem nova, ou `maxWaitMs`
  // depois da primeira, para quem digita sem parar não ficar sem resposta.
  deadline(): number | null {
    if (this.pending.length === 0) return null;
    const first = this.pending[0].at;
    const last = this.pending[this.pending.length - 1].at;
    return Math.min(last + this.policy.quietMs, first + this.policy.maxWaitMs);
  }

  isDue(now: number): boolean {
    const d = this.deadline();
    return d !== null && now >= d;
  }

  flush(): { text: string; messages: Incoming[] } {
    const messages = this.pending;
    this.pending = [];
    return { text: messages.map((m) => m.text.trim()).filter(Boolean).join("\n"), messages };
  }
}
