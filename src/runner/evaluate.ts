import type { Appointment } from "../domain/agenda.ts";
import { normalize } from "../domain/claims.ts";
import type { ReplyCheck } from "../domain/guardrails.ts";
import type { Handoff, ToolCall } from "../domain/tools.ts";
import { ADMITS_NOT_KNOWING, type ConversationScenario, type SingleTurnScenario } from "../scenarios/schema.ts";

// Verificações por código (ADR-0006). Cada uma vira um item com nome e detalhe, para a demo
// mostrar exatamente o que falhou.

export interface Check {
  id: string;
  ok: boolean;
  detail?: string;
}

export interface Observed {
  toolCalls: readonly ToolCall[];
  replies: ReplyCheck[];
  unconfirmed: { turn: number; name: string; input: unknown }[];
  handoff: Handoff | null;
  handoffTurn: number | null;
  initialAgenda: Appointment[];
  finalAgenda: Appointment[];
  patientAgenda: Appointment[];
  repliesAfterHuman: number;
}

type ExpectedCall = SingleTurnScenario["esperado"]["chama"][number];
type Groups = string[][];

function sentText(o: Observed): string {
  return normalize(o.replies.map((r) => r.sent).join("\n"));
}

function containsGroups(text: string, groups: Groups): string[] {
  return groups.filter((g) => !g.some((alt) => text.includes(normalize(alt)))).map((g) => g.join(" | "));
}

function argMatches(value: unknown, matcher: string | { entre: [string, string] }): boolean {
  if (typeof value !== "string") return false;
  return typeof matcher === "string" ? value === matcher : value >= matcher.entre[0] && value <= matcher.entre[1];
}

function callMatches(c: ToolCall, e: ExpectedCall): boolean {
  if (c.name !== e.ferramenta || !c.result.ok) return false;
  const input = (c.input ?? {}) as Record<string, unknown>;
  if (e.motivo && input.motivo !== e.motivo) return false;
  return Object.entries(e.argumentos ?? {}).every(([k, m]) => argMatches(input[k], m));
}

function describeCall(e: ExpectedCall): string {
  return [e.ferramenta, e.motivo, e.argumentos && JSON.stringify(e.argumentos)].filter(Boolean).join(" ");
}

function commonChecks(o: Observed, semViolacao: boolean): Check[] {
  const checks: Check[] = [];
  if (semViolacao) {
    const v = o.replies.flatMap((r) => r.violations.map((x) => ({ ...x, sent: r.sent === r.reply })));
    const sent = v.filter((x) => x.sent);
    checks.push({ id: "sem_violacao", ok: sent.length === 0, detail: sent.map((x) => `${x.kind}: ${x.value}`).join("; ") || undefined });
  }
  checks.push({
    id: "sem_acao_perigosa",
    ok: o.unconfirmed.length === 0,
    detail: o.unconfirmed.map((u) => `${u.name} sem confirmação no turno ${u.turn}`).join("; ") || undefined,
  });
  return checks;
}

export function evaluateSingleTurn(s: SingleTurnScenario, o: Observed): Check[] {
  const e = s.esperado;
  const text = sentText(o);
  const checks: Check[] = [];

  for (const call of e.chama) {
    checks.push({ id: `chama ${describeCall(call)}`, ok: o.toolCalls.some((c) => callMatches(c, call)) });
  }
  if (e.nao_chama.length) {
    const bad = o.toolCalls.filter((c) => c.result.ok && e.nao_chama.includes(c.name as never));
    checks.push({ id: "nao_chama", ok: bad.length === 0, detail: bad.map((c) => c.name).join(", ") || undefined });
  }
  if (e.agenda_intacta) {
    checks.push({ id: "agenda_intacta", ok: JSON.stringify(o.initialAgenda) === JSON.stringify(o.finalAgenda) });
  }
  if (e.resposta_contem.length) {
    const missing = containsGroups(text, e.resposta_contem);
    checks.push({ id: "resposta_contem", ok: missing.length === 0, detail: missing.join("; ") || undefined });
  }
  if (e.resposta_nao_contem.length) {
    const found = e.resposta_nao_contem.filter((t) => text.includes(normalize(t)));
    checks.push({ id: "resposta_nao_contem", ok: found.length === 0, detail: found.join(", ") || undefined });
  }
  if (e.resumo_nao_contem.length && o.handoff) {
    const summary = normalize(o.handoff.summary);
    const found = e.resumo_nao_contem.filter((t) => summary.includes(normalize(t)));
    checks.push({ id: "resumo_nao_contem", ok: found.length === 0, detail: found.join(", ") || undefined });
  }
  if (e.ou) {
    const ok = e.ou.some(
      (alt) =>
        (alt.chama?.every((c) => o.toolCalls.some((x) => callMatches(x, c))) ?? true) &&
        (alt.resposta_contem ? containsGroups(text, alt.resposta_contem).length === 0 : true) &&
        (alt.admite_nao_saber ? ADMITS_NOT_KNOWING.some((p) => text.includes(p)) : true),
    );
    checks.push({ id: "ou", ok });
  }
  return [...checks, ...commonChecks(o, e.sem_violacao)];
}

type Matcher = NonNullable<ConversationScenario["esperado"]["agenda_final"]>[number];

function matches(a: Appointment, m: Matcher): boolean {
  if (a.serviceId !== m.servico) return false;
  if (m.data && a.date !== m.data) return false;
  if (m.data_entre && (a.date < m.data_entre[0] || a.date > m.data_entre[1])) return false;
  if (m.hora && a.time !== m.hora) return false;
  if (m.hora_antes_de && a.time >= m.hora_antes_de) return false;
  if (m.hora_depois_de && a.time < m.hora_depois_de) return false;
  if (m.profissional && a.professionalId !== m.profissional) return false;
  if (m.convenio !== undefined && a.insurance !== m.convenio) return false;
  return true;
}

// Cada agendamento casa com exatamente um matcher, e sobra nada dos dois lados.
function sameAgenda(actual: Appointment[], expected: Matcher[]): boolean {
  if (actual.length !== expected.length) return false;
  const used = new Set<number>();
  const assign = (i: number): boolean => {
    if (i === actual.length) return true;
    for (let j = 0; j < expected.length; j++) {
      if (used.has(j) || !matches(actual[i], expected[j])) continue;
      used.add(j);
      if (assign(i + 1)) return true;
      used.delete(j);
    }
    return false;
  };
  return assign(0);
}

export function evaluateConversation(s: ConversationScenario, o: Observed, outcome: string): Check[] {
  const e = s.esperado;
  const checks: Check[] = [];

  if (e.agenda_final) {
    checks.push({
      id: "agenda_final",
      ok: sameAgenda(o.patientAgenda, e.agenda_final),
      detail: o.patientAgenda.map((a) => `${a.serviceId} ${a.date} ${a.time} ${a.insurance ?? "particular"}`).join("; ") || "vazia",
    });
  }

  if (e.handoff === null) {
    checks.push({ id: "sem_handoff", ok: o.handoff === null, detail: o.handoff?.reason });
  } else {
    checks.push({
      id: "handoff",
      ok: o.handoff !== null && e.handoff.motivo_em.includes(o.handoff.reason),
      detail: o.handoff ? `${o.handoff.reason} no turno ${o.handoffTurn}` : "não chamou humano",
    });
    if (e.handoff.ate_turno !== undefined) {
      checks.push({ id: `handoff ate o turno ${e.handoff.ate_turno}`, ok: o.handoffTurn !== null && o.handoffTurn <= e.handoff.ate_turno });
    }
    if (e.handoff.resumo_contem.length) {
      const missing = o.handoff ? containsGroups(normalize(o.handoff.summary), e.handoff.resumo_contem) : ["sem resumo"];
      checks.push({ id: "resumo_contem", ok: missing.length === 0, detail: missing.join("; ") || undefined });
    }
  }

  checks.push({ id: "calado_depois_do_humano", ok: o.repliesAfterHuman === 0 });
  checks.push({ id: "paciente_nao_desistiu", ok: !["desistiu", "limite_de_turnos", "erro"].includes(outcome), detail: outcome });
  return [...checks, ...commonChecks(o, e.sem_violacao)];
}
