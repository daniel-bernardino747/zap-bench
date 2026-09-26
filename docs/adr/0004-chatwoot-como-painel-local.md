# Chatwoot local como painel da clínica, só no simulador

Uma clínica precisa acompanhar e assumir conversas, e construir essa interface do zero foi recusado. A pesquisa de 26/09/2026 escolheu o **Chatwoot** self-hosted (github.com/chatwoot/chatwoot, MIT exceto `enterprise/`, UI em pt-BR):

- o bot entra como **Agent Bot**: recebe `message_created` por webhook e responde pela API;
- o handoff é nativo: conversa `pending` enquanto o bot atende, `open` quando ele chama humano, `pending` de novo quando o atendente devolve;
- o simulador entra pelo **canal API** (cria contato, conversa, posta mensagens `incoming`), sem WhatsApp real.

O Chatwoot roda via docker-compose (Postgres, Redis, ~4 GB de RAM) e fica **fora do caminho da avaliação**: as execuções gravadas não dependem dele. Ele serve para inspecionar conversas e ver o handoff funcionando.

## Porta aberta para produto

Como o simulador fala com o Chatwoot pela mesma interface que um inbox de WhatsApp usaria, ir para produção é trocar o canal API por um inbox **WhatsApp Cloud API oficial**, nativo do Chatwoot. Pontes não oficiais (Evolution API, WAHA, Whaticket — Baileys/whatsapp-web.js) violam os termos do WhatsApp e arriscam ban do número; a Evolution ainda tem cláusulas extras de licença. Não usar código de `enterprise/` sem licença.

O bot deve ignorar eventos de conversas `open` ou com atendente atribuído, para não disputar com o humano.
