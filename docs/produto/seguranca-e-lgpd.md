# Segurança e LGPD do produto

Revisão de 26/09/2026 para o produto final:

```
WhatsApp Cloud API → Chatwoot self-hosted → bot TypeScript → Anthropic / OpenAI / TypeSafe
```

Isto **não é parecer jurídico**. A última seção lista o que precisa passar por um advogado.

## Riscos

| Risco | Sev. | Mitigação | Resp. |
|---|---|---|---|
| **Vazamento entre clínicas num Chatwoot compartilhado** | Crítica | Houve injeção SQL que cruzava contas antes da 4.11.2 ([GHSA-9pgm-75gg-6948](https://github.com/chatwoot/chatwoot/security/advisories/GHSA-9pgm-75gg-6948)), além de outros advisories críticos ([lista](https://github.com/chatwoot/chatwoot/security)). Ficar sempre na última versão; desligar signup e OAuth; avaliar uma instância por clínica. | nós |
| Webhook falso chegando ao bot | Alta | Validar `X-Chatwoot-Signature` (HMAC-SHA256 de `"{ts}.{body}"`) e recusar timestamp antigo, falhando fechado. Há um bug aberto em que o secret mostrado pela API não bate com o usado para assinar ([#13809](https://github.com/chatwoot/chatwoot/issues/13809)): testar na versão usada. Deixar o bot em rede privada com o Chatwoot. | nós |
| Evento falso da Meta chegando ao Chatwoot | Alta | Configurar o App Secret no inbox, para verificar `X-Hub-Signature-256`. | nós |
| Canal API exposto | Alta | A API pública de contatos não exige autenticação: quem tem o `inbox_identifier` cria contato com qualquer telefone. O canal API é só do simulador e fica desligado em produção. | nós |
| Token do Agent Bot vazado | Alta | Tratar como acesso à conta inteira. Um token por clínica, guardado num cofre de segredos, com rotação. | nós |
| Orientação clínica pelo bot | Alta | A Res. CFO 226/2020 veda consulta, diagnóstico e prescrição a distância ([guia CFO](https://website.cfo.org.br/resolucao-226-2020-cfo-apresenta-guia-de-esclarecimento-sobre-exercicio-da-odontologia-a-distancia/)). O bot só agenda e informa. Sintoma ou urgência vai para humano com texto fixo. | nós e clínica |
| Logs e backups com dado de saúde | Alta | Log sem conteúdo de mensagem (só ids, latência, custo). Backup criptografado, com retenção definida. | nós |
| Termos do WhatsApp | Média | Desde 01/2026 a Meta proíbe chatbot de uso geral; atendimento e agendamento continuam permitidos (fontes secundárias). O bot não pode virar assistente genérico. | nós |
| Telefone ≠ paciente (aparelho compartilhado, número reatribuído) | Média | Não mostrar dado clínico nem histórico pelo WhatsApp. Ações só sobre agendamentos daquele número. | nós e clínica |

## LGPD

- **Dado de saúde é dado pessoal sensível** (art. 5º, II). Só pode ser tratado pelas hipóteses do art. 11; "execução de contrato" não serve. Candidatas: consentimento destacado, ou tutela da saúde por profissionais ou serviços de saúde (art. 11, II, f).
- **Papéis.** A clínica é controladora; nós somos operadores (arts. 37–39) e respondemos solidariamente se descumprirmos a lei ou as instruções dela (art. 42). Isso exige contrato de operador com cada clínica. Anthropic, OpenAI, TypeSafe, Meta e a hospedagem são suboperadores.
- **Incidentes.** O controlador comunica a ANPD e os titulares em 3 dias úteis e guarda o registro por 5 anos (Res. CD/ANPD 15/2024). O contrato nos obriga a avisar a clínica em 24–48h.
- **Transferência internacional.** Desde 23/08/2025, a base contratual exige as cláusulas-padrão da ANPD ([Res. CD/ANPD 19/2024](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024)). Os DPAs da Anthropic e da OpenAI citam as SCCs da UE; não há indício de que incluam as cláusulas da ANPD.
- **Retenção nas APIs:**
  - **Anthropic:** apaga em até 30 dias e não treina com dados comerciais. Retenção zero só sob contrato. Conteúdo sinalizado pode ficar até 2 anos ([fonte](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)).
  - **OpenAI:** logs de abuso por até 30 dias, sem treino. Retenção zero mediante aprovação ([fonte](https://developers.openai.com/api/docs/guides/your-data)).
  - **TypeSafe (Jev):** sem política pública de retenção nem DPA. Pedir ao fornecedor antes de usar em produção.
- **Direitos do titular.** Acesso e exclusão precisam funcionar no Chatwoot, nos nossos logs e nos backups.

## Requisitos do produto

1. Webhook com HMAC e timestamp, falhando fechado; bot em rede privada.
2. App Secret da Meta no inbox; canal API desligado em produção.
3. Chatwoot na última versão, com rotina de atualização; signup, OAuth e superadmin fechados; 2FA para atendentes; decisão entre instância por clínica e compartilhada.
4. Ferramentas presas ao contato e à clínica pelo servidor; confirmação antes de ações destrutivas (ADR-0007).
5. Bot sem conteúdo clínico, com escalonamento de urgência e mensagem inicial dizendo que é um assistente automático, com aviso de privacidade.
6. Logs sem conteúdo; retenção por clínica; exclusão por titular; backups criptografados.
7. Segredos em cofre; um token por clínica; rotação.
8. Plano de incidentes com registro de 5 anos e prazo de aviso à clínica.

## Para o advogado

- Qual hipótese do art. 11 usar, e se o consentimento é coletado no próprio WhatsApp.
- Minuta do contrato de operador (clínica ↔ nós) e dos termos de uso.
- Se a transferência para os EUA via DPA com SCC da UE atende à Res. 19/2024, ou se é preciso cláusulas ANPD ou consentimento específico (art. 33, VIII).
- Se é preciso relatório de impacto (RIPD).
- Se agendamento e triagem por bot estão dentro da Res. CFO 226/2020 e das regras de publicidade do Código de Ética Odontológica.
- Responsabilidade civil e CDC por mensagem errada do bot "em nome da clínica".
