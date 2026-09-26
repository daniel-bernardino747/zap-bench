// Paciente de WhatsApp manda "oi", "qro marca", "pra amanha" em sequência. O bot espera um
// silêncio curto e responde tudo de uma vez: menos respostas picadas, e cada resposta do bot
// custa dinheiro na Meta (ADR-0008). Igual para os quatro cérebros; o tempo é injetado para
// que a simulação seja determinística.

export interface Incoming {
  // Id da mensagem no canal (wamid no WhatsApp). O webhook pode entregar a mesma mensagem mais
  // de uma vez; deduplicar pelo id, nunca pelo texto, porque "sim" repetido é mensagem nova.
  id?: string;
  text: string;
  at: number;
}

export type Media = "audio" | "imagem" | "video" | "documento" | "figurinha";

// Mídia chega aos quatro cérebros como o mesmo marcador: nenhum deles ouve áudio nem vê
// imagem, e nenhum pode fingir que viu.
export function mediaMarker(media: Media, caption?: string): string {
  const what = { audio: "um áudio", imagem: "uma imagem", video: "um vídeo", documento: "um documento", figurinha: "uma figurinha" }[media];
  const marker = `[o paciente enviou ${what}, que o atendimento automático não consegue abrir]`;
  return caption?.trim() ? `${marker}\n${caption.trim()}` : marker;
}

export interface BufferPolicy {
  quietMs: number;
  maxWaitMs: number;
}

export const DEFAULT_BUFFER: BufferPolicy = { quietMs: 8_000, maxWaitMs: 30_000 };

export class MessageBuffer {
  private readonly policy: BufferPolicy;
  private pending: Incoming[] = [];
  private seen = new Set<string>();

  constructor(policy: BufferPolicy = DEFAULT_BUFFER) {
    this.policy = policy;
  }

  // Devolve false quando a mensagem é uma entrega repetida e foi descartada.
  push(message: Incoming): boolean {
    if (message.id !== undefined) {
      if (this.seen.has(message.id)) return false;
      this.seen.add(message.id);
    }
    this.pending.push(message);
    return true;
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
