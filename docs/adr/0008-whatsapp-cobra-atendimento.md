# O WhatsApp passa a cobrar o atendimento, e isso derruba a conta do ADR-0005

O ADR-0005 supôs que as conversas iniciadas pelo paciente eram gratuitas no WhatsApp Cloud API. Isso deixa de valer: *"Effective October 1, 2026, Meta will charge for service messages, which have not been charged since November 2024."* ([Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages), conferido em 26/09/2026).

- No Brasil, cada mensagem de serviço (resposta do bot dentro da janela de 24h) passa a custar **R$ 0,035**. A Meta fatura em reais.
- A pesquisa em `docs/produto/whatsapp-cloud-api-custos.md` registra uma franquia de 1.000 mensagens de serviço grátis por número por mês. Essa franquia não aparece na página citada acima e **precisa ser reconfirmada** antes de virar premissa.
- Com 300 conversas e 6 respostas do bot por conversa, o WhatsApp custa cerca de **R$ 28 por clínica por mês**, 47% dos R$ 59,90. Isso é mais do que os R$ 15 reservados para IA.

## Consequências

- **Mensagens do bot por conversa** vira métrica central (ADR-0006): cada resposta custa dinheiro. O buffer junta as mensagens do paciente, e os cérebros são avaliados também por quantas mensagens mandam.
- O relatório de produto (ADR-0005) soma IA e WhatsApp, e o custo do WhatsApp sai do número real de mensagens de cada execução, não de uma suposição.
- Três decisões de produto ficam em aberto:
  - quem paga a Meta: a clínica, no cartão dela, ou embutido na mensalidade;
  - se R$ 59,90 se sustenta;
  - se lembretes entram. Um template utility custa R$ 0,035.
