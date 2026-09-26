import { z } from "zod";
import type { Agenda } from "./agenda.ts";
import { isValidDate, TIME, type Weekday } from "./calendar.ts";
import { normalize } from "./claims.ts";
import type { Establishment } from "./establishment.ts";

// As ferramentas da clínica, iguais para os quatro cérebros (ADR-0002). Os LLMs as recebem
// como JSON Schema (`toolSchemas`); o Jev as chama direto pelo nome. Toda chamada fica no
// log da conversa, que é o que a avaliação lê.

export interface Handoff {
  reason: HandoffReason;
  summary: string;
}

export interface ToolCall {
  turn: number;
  name: string;
  input: unknown;
  result: ToolResult;
}

export type ToolResult = { ok: true; value: unknown } | { ok: false; error: string; details?: unknown };

export interface ToolContext {
  agenda: Agenda;
  patientPhone: string;
  handoff: Handoff | null;
  log: readonly ToolCall[];
  // Turno atual da conversa, mantido pelo guard; vai em cada chamada registrada.
  turn: number;
}

// O telefone vem do canal (WhatsApp/Chatwoot), nunca do cérebro. É a identidade do paciente,
// então vazio ou malformado derruba a conversa em vez de virar um paciente compartilhado.
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s()+.-]/g, "");
  if (!/^\d{10,15}$/.test(digits)) throw new Error(`telefone inválido: ${JSON.stringify(raw)}`);
  return digits;
}

export function createToolContext(agenda: Agenda, rawPhone: string): ToolContext {
  return { agenda, patientPhone: normalizePhone(rawPhone), handoff: null, log: [], turn: 0 };
}

const date = z.string().refine(isValidDate, "data inexistente ou fora do formato AAAA-MM-DD").describe("Data no formato AAAA-MM-DD");

// Texto livre volta para o contexto dos cérebros e aparece no painel da clínica: sem
// caracteres de controle ou de direção (bidi), e curto.
const CONTROL = /[\p{Cc}\p{Cf}]/u;
const patientName = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\p{L}\p{M} '.-]+$/u, "só letras, espaço, apóstrofo, ponto e hífen");
const summary = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((s) => !CONTROL.test(s.replaceAll("\n", "")), "sem caracteres de controle");
const time = z.string().regex(TIME).describe("Hora no formato HH:MM");

const handoffReason = z.enum(["pedido_do_paciente", "emergencia", "nao_sei_responder", "reclamacao"]);
export type HandoffReason = z.infer<typeof handoffReason>;

function tool<I extends z.ZodType>(def: {
  name: string;
  description: string;
  input: I;
  run: (ctx: ToolContext, input: z.infer<I>) => ToolResult;
}) {
  return def;
}

const WEEKDAY_NAMES: Record<Weekday, string> = {
  dom: "domingo",
  seg: "segunda",
  ter: "terça",
  qua: "quarta",
  qui: "quinta",
  sex: "sexta",
  sab: "sábado",
};

// Aceita id, nome ou apelido do serviço, sem acento e sem caixa.
export function findService(clinic: Establishment, query: string) {
  const q = normalize(query.trim());
  return clinic.services.find((s) => [s.id, s.name, ...s.aliases].some((alias) => normalize(alias) === q));
}

function professionalName(clinic: Establishment, id: string): string {
  return clinic.professionals.find((p) => p.id === id)?.name ?? id;
}

function brl(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: value % 1 ? 2 : 0 })}`;
}

// Todo fato que o bot afirma sai de uma destas funções (ADR-0009). O cérebro não recebe os
// dados da clínica: pergunta aqui, e o filtro de saída só aceita o que veio daqui.
export const tools = [
  tool({
    name: "info_clinica",
    description: "Nome, endereço, telefone e horário de funcionamento da clínica.",
    input: z.object({}),
    run: (ctx) => {
      const c = ctx.agenda.establishment;
      return {
        ok: true,
        value: {
          nome: c.name,
          endereco: c.address,
          telefone: c.phone,
          horario: c.hours.map((h) => ({ dias: h.days.map((d) => WEEKDAY_NAMES[d]), abre: h.open, fecha: h.close })),
        },
      };
    },
  }),
  tool({
    name: "listar_servicos",
    description: "Lista os serviços que a clínica oferece, com o id usado pelas outras funções. O que não está aqui a clínica não faz.",
    input: z.object({}),
    run: (ctx) => ({ ok: true, value: ctx.agenda.establishment.services.map((s) => ({ id: s.id, nome: s.name })) }),
  }),
  tool({
    name: "consultar_servico",
    description: "Preço, duração, profissionais e se algum convênio cobre um serviço. Aceita o id ou o nome do serviço.",
    input: z.object({ servico: z.string().min(1).max(60).describe("id ou nome do serviço") }),
    run: (ctx, i) => {
      const c = ctx.agenda.establishment;
      const s = findService(c, i.servico);
      if (!s) return { ok: false, error: "servico_desconhecido", details: { servicos: c.services.map((x) => x.name) } };
      return {
        ok: true,
        value: {
          id: s.id,
          nome: s.name,
          preco: s.priceBRL,
          preco_texto: s.priceBRL === 0 ? "gratuito" : brl(s.priceBRL),
          duracao_minutos: s.durationMinutes,
          profissionais: s.professionalIds.map((p) => professionalName(c, p)),
          coberto_por_convenio: s.coveredByInsurance,
        },
      };
    },
  }),
  tool({
    name: "verificar_convenio",
    description: "Diz se a clínica aceita um convênio e, se um serviço for informado, se esse convênio cobre o serviço.",
    input: z.object({
      convenio: z.string().min(1).max(60).describe("nome do convênio como o paciente disse"),
      servico: z.string().min(1).max(60).optional().describe("id ou nome do serviço"),
    }),
    run: (ctx, i) => {
      const c = ctx.agenda.establishment;
      const asked = normalize(i.convenio.trim());
      const accepted = c.insurances.find((x) => {
        const official = normalize(x);
        return official.includes(asked) || asked.includes(official) || asked.includes(official.split(" ")[0]);
      });
      const value: Record<string, unknown> = { convenio_informado: i.convenio, aceito: Boolean(accepted), convenios_aceitos: c.insurances };
      if (accepted) value.nome_oficial = accepted;
      if (i.servico) {
        const s = findService(c, i.servico);
        if (!s) return { ok: false, error: "servico_desconhecido", details: { servicos: c.services.map((x) => x.name) } };
        value.servico = s.name;
        value.cobre_servico = Boolean(accepted) && s.coveredByInsurance;
      }
      return { ok: true, value };
    },
  }),
  tool({
    name: "consultar_politicas",
    description:
      "Políticas da clínica (pagamento, parcelamento, faltas, cancelamento). O texto é literal. Se o assunto não estiver aqui, a clínica não tem essa política: não invente, diga que não sabe ou chame um humano.",
    input: z.object({}),
    run: (ctx) => ({ ok: true, value: ctx.agenda.establishment.policies.map((p) => ({ tema: p.topic, texto: p.text })) }),
  }),
  tool({
    name: "buscar_horarios",
    description:
      "Lista horários livres para um serviço. Sem data, busca a partir de hoje. Use 'depois' e 'antes' para filtrar o período do dia (ex.: manhã = antes de 12:00).",
    input: z.object({
      servico: z.string().describe("id do serviço"),
      a_partir_de: date.optional(),
      dias: z.number().int().min(1).max(30).optional().describe("quantos dias buscar, padrão 7"),
      profissional: z.string().optional().describe("id do profissional"),
      depois: time.optional(),
      antes: time.optional(),
    }),
    run: (ctx, i) => {
      const r = ctx.agenda.findSlots({
        serviceId: i.servico,
        fromDate: i.a_partir_de,
        days: i.dias,
        professionalId: i.profissional,
        after: i.depois,
        before: i.antes,
      });
      if (!r.ok) return r;
      const c = ctx.agenda.establishment;
      return {
        ok: true,
        value: r.value.map((s) => ({ ...s, profissional_nome: professionalName(c, s.professionalId) })),
      };
    },
  }),
  tool({
    name: "agendar",
    description: "Agenda uma consulta para o paciente desta conversa. Só chame depois que o paciente confirmar serviço, dia e horário.",
    input: z.object({
      nome_paciente: patientName,
      servico: z.string().describe("id do serviço"),
      data: date,
      hora: time,
      profissional: z.string().optional().describe("id do profissional; sem ele, qualquer um livre"),
      convenio: z.string().nullable().optional().describe("nome do convênio exatamente como a clínica aceita, ou null se particular"),
    }),
    run: (ctx, i) =>
      ctx.agenda.book({
        patientPhone: ctx.patientPhone,
        patientName: i.nome_paciente,
        serviceId: i.servico,
        date: i.data,
        time: i.hora,
        professionalId: i.profissional,
        insurance: i.convenio ?? null,
      }),
  }),
  tool({
    name: "meus_agendamentos",
    description: "Lista os próximos agendamentos do paciente desta conversa.",
    input: z.object({}),
    // Só o necessário: sem telefone, status nem o nome digitado, que pode carregar injeção.
    run: (ctx) => ({
      ok: true,
      value: ctx.agenda.byPatient(ctx.patientPhone).map((a) => ({
        id: a.id,
        servico: ctx.agenda.establishment.services.find((s) => s.id === a.serviceId)?.name,
        profissional: ctx.agenda.establishment.professionals.find((p) => p.id === a.professionalId)?.name,
        data: a.date,
        hora: a.time,
        convenio: a.insurance,
      })),
    }),
  }),
  tool({
    name: "remarcar",
    description: "Muda dia e horário de um agendamento do paciente. Só chame depois que o paciente confirmar o novo horário.",
    input: z.object({
      agendamento: z.string().describe("id do agendamento"),
      data: date,
      hora: time,
      profissional: z.string().optional(),
    }),
    run: (ctx, i) => ctx.agenda.reschedule(ctx.patientPhone, i.agendamento, i.data, i.hora, i.profissional),
  }),
  tool({
    name: "cancelar",
    description: "Cancela um agendamento do paciente. Só chame depois que o paciente confirmar qual consulta cancelar.",
    input: z.object({ agendamento: z.string().describe("id do agendamento") }),
    run: (ctx, i) => ctx.agenda.cancel(ctx.patientPhone, i.agendamento),
  }),
  tool({
    name: "chamar_humano",
    description:
      "Passa a conversa para a equipe da clínica. Use em emergência, quando o paciente pedir, quando reclamar, ou quando você não souber responder. Depois disso, não responda mais.",
    input: z.object({
      motivo: handoffReason,
      resumo: summary.describe("resumo curto para o atendente: quem é, o que quer, o que já foi feito"),
    }),
    run: (ctx, i) => {
      ctx.handoff = { reason: i.motivo, summary: i.resumo };
      // Em emergência, o texto ao paciente é o da clínica, não um que o cérebro invente.
      return {
        ok: true,
        value:
          i.motivo === "emergencia"
            ? { status: "equipe avisada", mensagem_para_o_paciente: ctx.agenda.establishment.emergency.message }
            : { status: "equipe avisada" },
      };
    },
  }),
];

export type ToolName = (typeof tools)[number]["name"];

export const TOOL_NAMES = tools.map((t) => t.name) as [string, ...string[]];

export function runTool(ctx: ToolContext, name: string, input: unknown): ToolResult {
  const t = tools.find((x) => x.name === name);
  let result: ToolResult;
  if (!t) result = { ok: false, error: "ferramenta_desconhecida" };
  else if (ctx.handoff) result = { ok: false, error: "conversa_com_humano" };
  else {
    const schema: z.ZodType = t.input;
    const parsed = schema.safeParse(input);
    result = parsed.success
      ? (t.run as (c: ToolContext, i: unknown) => ToolResult)(ctx, parsed.data)
      : { ok: false, error: "entrada_invalida", details: z.flattenError(parsed.error).fieldErrors };
  }
  return recordCall(ctx, name, input, result);
}

// Também usado pelos guardrails, para que uma chamada barrada apareça no log como as outras.
export function recordCall(ctx: ToolContext, name: string, input: unknown, result: ToolResult): ToolResult {
  (ctx.log as ToolCall[]).push(deepFreeze({ turn: ctx.turn, name, input: snapshot(input), result: snapshot(result) }));
  return result;
}

// O log vai para o data.json público: cópia congelada, com strings longas cortadas.
const MAX_LOGGED_STRING = 300;

function snapshot<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value ?? null, (_k, v) =>
      typeof v === "string" && v.length > MAX_LOGGED_STRING ? `${v.slice(0, MAX_LOGGED_STRING)}…[+${v.length - MAX_LOGGED_STRING}]` : v,
    ),
  );
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

export function toolSchemas() {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: z.toJSONSchema(t.input),
  }));
}
