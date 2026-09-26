import { addDays, weekdayOf } from "./calendar.ts";
import { checkReply, extractTimes, normalize, type Violation } from "./claims.ts";
import { recordCall, runTool, type ToolContext, type ToolResult } from "./tools.ts";

// Um guard por conversa, entre o cérebro e a camada comum (ADR-0007). No modo "bruto" ele só
// observa: as ferramentas rodam direto e as violações da resposta ficam registradas para a
// métrica. No modo "guardrails" ele também barra.

export type Mode = "bruto" | "guardrails";

export const SAFE_REPLY =
  "Desculpe, não consegui responder isso com segurança. Posso ajudar a agendar, remarcar ou cancelar uma consulta, ou chamar alguém da equipe.";

const DESTRUCTIVE = new Set(["agendar", "remarcar", "cancelar"]);

const WEEKDAY_NAMES: Record<string, string[]> = {
  dom: ["domingo"],
  seg: ["segunda"],
  ter: ["terca"],
  qua: ["quarta"],
  qui: ["quinta"],
  sex: ["sexta"],
  sab: ["sabado"],
};

export interface ReplyCheck {
  turn: number;
  reply: string;
  sent: string;
  violations: Violation[];
}

export class ConversationGuard {
  private turn = 0;
  private patientText = "";
  private patientTexts: string[] = [];
  private lastBotReply = "";
  private destructiveThisTurn = 0;
  readonly replies: ReplyCheck[] = [];

  constructor(
    readonly ctx: ToolContext,
    readonly mode: Mode,
  ) {}

  // Chamado com o texto que saiu do buffer, antes de o cérebro responder.
  beginTurn(patientText: string): void {
    this.turn++;
    this.patientText = patientText;
    this.patientTexts.push(patientText);
    this.destructiveThisTurn = 0;
  }

  callTool(name: string, input: unknown): ToolResult {
    if (this.mode === "bruto" || !DESTRUCTIVE.has(name) || this.ctx.handoff) return runTool(this.ctx, name, input);

    if (this.destructiveThisTurn >= 1) return recordCall(this.ctx, name, input, { ok: false, error: "uma_acao_por_vez" });

    const target = this.target(name, input);
    if (target && !this.confirmed(target)) {
      return recordCall(this.ctx, name, input, {
        ok: false,
        error: "confirmacao_necessaria",
        details:
          "Pergunte ao paciente se confirma, citando o dia (dd/mm ou dia da semana) e a hora. Chame a ferramenta de novo depois que ele disser sim.",
      });
    }
    this.destructiveThisTurn++;
    return runTool(this.ctx, name, input);
  }

  // Toda resposta passa por aqui antes de ir ao paciente. Devolve o texto que de fato sai.
  filterReply(reply: string): string {
    const violations = checkReply(reply, this.ctx.agenda.establishment, { times: this.knownTimes() });
    const sent = this.mode === "guardrails" && violations.length > 0 ? SAFE_REPLY : reply;
    this.replies.push({ turn: this.turn, reply, sent, violations });
    this.lastBotReply = sent;
    return sent;
  }

  // Dia e hora que a ação vai afetar. Sem alvo (agendamento que não existe, entrada
  // malformada), a ferramenta roda e devolve o próprio erro.
  private target(name: string, input: unknown): { date: string; time: string } | null {
    const i = (input ?? {}) as Record<string, unknown>;
    if (name === "cancelar") {
      const a = this.ctx.agenda.byPatient(this.ctx.patientPhone).find((x) => x.id === i.agendamento);
      return a ? { date: a.date, time: a.time } : null;
    }
    return typeof i.data === "string" && typeof i.hora === "string" ? { date: i.data, time: i.hora } : null;
  }

  // Confirmado = a resposta anterior do bot citou esse dia e essa hora, e o paciente disse sim.
  private confirmed(t: { date: string; time: string }): boolean {
    if (!isAffirmative(this.patientText)) return false;
    const said = normalize(this.lastBotReply);
    if (!extractTimes(this.lastBotReply).includes(t.time)) return false;
    const [, mm, dd] = t.date.split("-");
    const dayForms = [
      `${dd}/${mm}`,
      `${Number(dd)}/${Number(mm)}`,
      `${Number(dd)}/${mm}`,
      ...WEEKDAY_NAMES[weekdayOf(t.date)],
      ...(t.date === this.ctx.agenda.today ? ["hoje"] : []),
      ...(t.date === addDays(this.ctx.agenda.today, 1) ? ["amanha"] : []),
    ];
    return dayForms.some((f) => new RegExp(`(^|[^\\d/])${f}([^\\d/]|$)`).test(said));
  }

  private knownTimes(): string[] {
    const fromTools = this.ctx.log.flatMap((c) => extractTimes(JSON.stringify(c.result)));
    return [...fromTools, ...this.patientTexts.flatMap(extractTimes)];
  }
}

export function isAffirmative(text: string): boolean {
  const t = normalize(text);
  if (/\b(nao|n|nem|errado|cancela nao)\b/.test(t)) return false;
  return /\b(sim+|s+|isso|confirm\w*|pode|pd|podi|ok|okay|blz|beleza|claro|certo|uhum|fechado|bora|perfeito)\b|👍/u.test(t);
}
