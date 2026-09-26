import { addDays, weekdayOf } from "../domain/calendar.ts";
import { normalize } from "../domain/claims.ts";
import type { ToolResult } from "../domain/tools.ts";
import { isAffirmative } from "../domain/guardrails.ts";
import { NO_USAGE, type Brain, type BrainReply } from "./types.ts";

// Cérebro falso, por regras e sem IA. Existe para rodar o executor sem chave e testar o
// encanamento; não entra na comparação publicada. Como os outros, só sabe o que as funções
// devolvem (ADR-0009).

const WEEKDAY: Record<string, string> = { dom: "domingo", seg: "segunda", ter: "terça", qua: "quarta", qui: "quinta", sex: "sexta", sab: "sábado" };
const EMERGENCY = /\b(sangr\w*|inch\w*|inxad\w*|quebr\w*|dor forte|doi muito|socorro|trauma)\b/;

interface Slot {
  date: string;
  time: string;
  professionalId: string;
}

function value<T>(r: ToolResult): T | null {
  return r.ok ? (r.value as T) : null;
}

function describe(slot: Slot): string {
  const [, mm, dd] = slot.date.split("-");
  return `${WEEKDAY[weekdayOf(slot.date)]}, ${dd}/${mm}, às ${slot.time}`;
}

export const rulesBrain: Brain = {
  id: "regras",
  label: "Regras (falso, sem IA)",
  model: "regras",
  start(ctx) {
    let offer: { serviceId: string; serviceName: string; slot: Slot } | null = null;
    const say = (...replies: string[]): BrainReply => ({ replies, usage: NO_USAGE });

    const findService = (t: string) => {
      const services = value<{ id: string; nome: string }[]>(ctx.callTool("listar_servicos", {})) ?? [];
      return services.find((s) => t.includes(normalize(s.nome.split(" (")[0])) || t.includes(normalize(s.id)));
    };

    return {
      async respond(patientText) {
        const t = normalize(patientText);

        if (EMERGENCY.test(t)) {
          const r = value<{ mensagem_para_o_paciente?: string }>(
            ctx.callTool("chamar_humano", { motivo: "emergencia", resumo: "Paciente relatou possível urgência odontológica." }),
          );
          return say(r?.mensagem_para_o_paciente ?? "Vou chamar alguém da equipe agora.");
        }
        if (/\b(atendente|humano|pessoa|reclama\w*)\b/.test(t)) {
          ctx.callTool("chamar_humano", { motivo: "pedido_do_paciente", resumo: "Paciente pediu para falar com um atendente." });
          return say("Certo, vou chamar alguém da equipe para continuar com você.");
        }
        if (t.includes("[o paciente enviou")) {
          return say("Não consigo abrir áudio nem imagem por aqui. Pode me escrever o que precisa?");
        }

        if (offer && isAffirmative(patientText)) {
          const done = offer;
          offer = null;
          const r = ctx.callTool("agendar", {
            nome_paciente: "Paciente",
            servico: done.serviceId,
            data: done.slot.date,
            hora: done.slot.time,
            profissional: done.slot.professionalId,
          });
          return r.ok
            ? say(`Pronto! ${done.serviceName} agendada para ${describe(done.slot)}.`)
            : say("Esse horário não está mais disponível. Quer que eu procure outro?");
        }

        const service = findService(t);
        if (service && /\b(quanto|preco|valor|custa)\b/.test(t)) {
          const info = value<{ nome: string; preco_texto: string }>(ctx.callTool("consultar_servico", { servico: service.id }));
          return say(info ? `${info.nome}: ${info.preco_texto}.` : "Não encontrei esse serviço.");
        }
        if (service && /\b(marc\w*|agend\w*|horario|tem|qro|quero)\b/.test(t)) {
          const from = t.includes("amanha") ? addDays(ctx.now.date, 1) : ctx.now.date;
          const slots = value<Slot[]>(ctx.callTool("buscar_horarios", { servico: service.id, a_partir_de: from, dias: 7 })) ?? [];
          if (!slots.length) return say(`Não encontrei horário para ${service.nome} nos próximos dias.`);
          offer = { serviceId: service.id, serviceName: service.nome, slot: slots[0] };
          return say(`Posso marcar ${service.nome} para ${describe(slots[0])}?`);
        }

        return say("Posso ajudar a agendar uma consulta ou chamar alguém da equipe. O que você precisa?");
      },
    };
  },
};
