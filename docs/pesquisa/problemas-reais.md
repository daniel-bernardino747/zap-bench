# Problemas reais de bots de atendimento

Pesquisa de 26/09/2026. O Reddit não pôde ser aberto pela ferramenta de busca, e o Reclame Aqui respondeu 403: dele há só título e trecho do resultado de busca, marcados (S). O resto foi lido na fonte.

## Paciente

| Problema | Evidência |
|---|---|
| Não consegue falar com humano | 4 reclamações de clínicas no Reclame Aqui (S): [Clínica Salute](https://www.reclameaqui.com.br/clinica-salute/dificuldade-em-agendar-consulta-via-whatsapp-atendimento-exclusivo-por-robo_Is1nuMlJz5RGrbCC/), [Clínica Sim](https://www.reclameaqui.com.br/clinica-sim/nao-consigo-falar-com-um-atendente__ROYq6sCds5_JxkV/). A Klarna voltou atrás: "customers like talking to people" ([Forbes](https://www.forbes.com/sites/quickerbettertech/2025/05/18/business-tech-news-klarna-reverses-on-ai-says-customers-like-talking-to-people/)) |
| Política inventada | A Air Canada foi condenada a honrar o reembolso inventado pelo bot ([CBC](https://www.cbc.ca/news/canada/british-columbia/air-canada-chatbot-lawsuit-1.7116416)). O bot do Cursor inventou a regra de "um dispositivo" ([AIID](https://incidentdatabase.ai/cite/1039/)). O MyCity de NYC orientava a violar a lei ([The Markup](https://themarkup.org/artificial-intelligence/2024/03/29/nycs-ai-chatbot-tells-businesses-to-break-the-law)) |
| Contexto perdido no handoff | [HN 47239943](https://news.ycombinator.com/item?id=47239943) |
| Bot manipulado a xingar a empresa | DPD ([Time](https://time.com/6564726/ai-chatbot-dpd-curses-criticizes-company/)) |
| Não entende áudio nem o que foge do roteiro | [n8n](https://community.n8n.io/t/i-cant-send-images-to-the-n8n-flow-regarding-ai-agent-responses-via-whatsapp/90235) |

## Dono

| Problema | Evidência |
|---|---|
| Número banido (API não oficial) | Evolution [#1870](https://github.com/evolution-foundation/evolution-api/issues/1870), [#2497](https://github.com/evolution-foundation/evolution-api/issues/2497) |
| Bot fala por cima da recepção | Chatwoot [#15681](https://github.com/chatwoot/chatwoot/issues/15681) |
| Responsabilidade pelo que o bot promete | Air Canada; Chevrolet por US$ 1 ([AIID](https://incidentdatabase.ai/cite/622/)) |

## Desenvolvedor

| Problema | Evidência |
|---|---|
| Webhook duplicado; dedup por conteúdo descartando mensagem nova | Evolution [#2110](https://github.com/EvolutionAPI/evolution-api/issues/2110), [n8n](https://community.n8n.io/t/duplicate-whatsapp-messages/309667) |
| Mensagens picadas | [n8n](https://community.n8n.io/t/whatsapp-webhook-recieving-consecutive-messages/50828) |
| Data e fuso ("amanhã", ano errado, servidor em UTC) | [n8n](https://community.n8n.io/t/wrong-agent-date/138562), [Val7h/whatsapp-ai#2](https://github.com/Val7h/whatsapp-ai/pull/2) |
| Janela de 24h (erro 131047) | [dualhook](https://dualhook.com/docs/whatsapp-error-131047) |
| Política da Meta contra chatbot de uso geral | [TechCrunch](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform) |

## O que virou cenário ou defesa

| Lacuna | Onde |
|---|---|
| Recepção assume e o bot continua | `conversa-recepcao-assume` |
| Webhook duplicado | `conversa-webhook-duplicado`; dedup por id em `buffer.ts` |
| Virada do dia e datas relativas | `data-amanha-23h50`, `data-sexta-que-vem`, `data-semana-que-vem`; `clinicNow` com o fuso do `establishment.json` |
| Política inventada | `politica-*`; `policies` no `establishment.json` |
| Áudio e imagem | `midia-audio`, `midia-foto-inflamado`; `mediaMarker` igual para todos |
| Pedir humano com raiva | `conversa-humano-com-raiva`, handoff em até 2 turnos |
| Resumo do handoff útil | `resumo_contem` nas conversas de handoff |
| Recepção ocupa o horário antes do "sim" | `conversa-horario-tomado` |

Ficam para o produto, fora do benchmark: lembrete de véspera por template aprovado, a janela de 24h e o risco de ban, que já está coberto pelo ADR-0004.
