import { addDays, weekdayOf } from "../domain/calendar.ts";
import type { Slot } from "../domain/agenda.ts";
import { normalize } from "../domain/claims.ts";
import type { Establishment } from "../domain/establishment.ts";
import { isAffirmative } from "../domain/guardrails.ts";
import { NO_USAGE, type Brain, type BrainReply } from "./types.ts";

// Cérebro falso, por regras e sem IA. Existe para rodar o executor sem chave e testar o
// encanamento. Não entra na comparação publicada.

const WEEKDAY: Record<string, string> = { dom: "domingo", seg: "segunda", ter: "terça", qua: "quarta", qui: "quinta", sex: "sexta", sab: "sábado" };

function findService(clinic: Establishment, text: string) {
  return clinic.services.find((s) => [s.id, s.name, ...s.aliases].some((alias) => text.includes(normalize(alias))));
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
    const emergency = ctx.clinic.emergency.keywords.map(normalize);
    const say = (...replies: string[]): BrainReply => ({ replies, usage: NO_USAGE });

    return {
      async respond(patientText) {
        const t = normalize(patientText);

        if (emergency.some((k) => t.includes(k)) || /\b(sangr\w*|inch\w*|inxad\w*|quebr\w*)\b/.test(t)) {
          ctx.callTool("chamar_humano", { motivo: "emergencia", resumo: "Paciente relatou possível urgência odontológica." });
          return say(ctx.clinic.emergency.message);
        }
        if (/\b(atendente|humano|pessoa|reclama\w*)\b/.test(t)) {
          ctx.callTool("chamar_humano", { motivo: "pedido_do_paciente", resumo: "Paciente pediu para falar com um atendente." });
          return say("Certo, vou chamar alguém da equipe para continuar com você.");
        }
        if (t.includes("[o paciente enviou")) {
          return say("Não consigo abrir áudio nem imagem por aqui. Pode me escrever o que precisa?");
        }

        if (offer && isAffirmative(patientText)) {
          const r = ctx.callTool("agendar", {
            nome_paciente: "Paciente",
            servico: offer.serviceId,
            data: offer.slot.date,
            hora: offer.slot.time,
            profissional: offer.slot.professionalId,
          });
          const done = offer;
          offer = null;
          return r.ok
            ? say(`Pronto! ${done.serviceName} agendada para ${describe(done.slot)}.`)
            : say("Esse horário não está mais disponível. Quer que eu procure outro?");
        }

        const service = findService(ctx.clinic, t);
        if (service && /\b(quanto|preco|valor|custa)\b/.test(t)) {
          return say(`${service.name}: R$ ${service.priceBRL}.`);
        }
        if (service && /\b(marc\w*|agend\w*|horario|tem|qro|quero)\b/.test(t)) {
          const from = t.includes("amanha") ? addDays(ctx.now.date, 1) : ctx.now.date;
          const r = ctx.callTool("buscar_horarios", { servico: service.id, a_partir_de: from, dias: 7 });
          const slots = r.ok ? (r.value as Slot[]) : [];
          if (!slots.length) return say(`Não encontrei horário para ${service.name} nos próximos dias.`);
          offer = { serviceId: service.id, serviceName: service.name, slot: slots[0] };
          return say(`Posso marcar ${service.name} na ${describe(slots[0])}?`);
        }

        return say("Posso ajudar a agendar uma consulta ou chamar alguém da equipe. O que você precisa?");
      },
    };
  },
};
