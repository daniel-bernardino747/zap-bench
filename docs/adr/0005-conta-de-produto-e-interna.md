# A conta de produto é interna e nunca vai para o Labs

O produto planejado custa **R$ 59,90 por clínica por mês**. As execuções gravadas já dão o custo médio por conversa de cada cérebro, em cada persona, e a CLI gera a partir delas um relatório de viabilidade em `reports/produto/`, que é gitignored.

Premissas:

- **300 conversas por clínica por mês**, com sensibilidade de 150 a 600;
- **até 25% da mensalidade para IA**, cerca de R$ 15;
- teto resultante de **cerca de R$ 0,05 por conversa**.

A conta desconta impostos (~6% se Simples Nacional), infraestrutura por clínica e margem, e diz para cada cérebro se cabe. Preços de Sonnet, Haiku, GPT e Jev vêm das páginas oficiais na data da execução, gravados junto. O custo do WhatsApp Cloud API para conversas iniciadas pelo paciente ainda precisa ser confirmado.

Isso é planejamento de produto, não comparação: o showcase (ADR-0001) não mostra a conta.

> **Atualização (26/09/2026):** a premissa de que o atendimento no WhatsApp é gratuito caiu. Ver ADR-0008.
