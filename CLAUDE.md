# zap-bench

Compara bots de atendimento de WhatsApp para uma clínica: Claude Sonnet 5, Claude Haiku 4.5 e o GPT principal contra Jev + templates, sobre as mesmas conversas gravadas. Repo público; a conta de produto nunca entra no git. Decisões em `docs/adr/`.

## Estrutura

- `establishments/` — estabelecimentos fictícios (`fictional: true` obrigatório), validados por `src/domain/establishment.ts`. Trocar a clínica por outro estabelecimento é trocar o JSON.
- `scenarios/dev` e `scenarios/validation` — prompts e regras do Jev se ajustam só olhando `dev`; o número publicado vem só de `validation` (ADR-0002).
- `src/domain/` — camada comum: estabelecimento, agenda falsa, ferramentas, buffer de mensagens. Igual para todos os cérebros.
- `reports/produto/` — conta de R$ 59,90/mês por clínica (ADR-0005). Gitignored.

## Regras

- Paciente simulado e juiz nunca usam um modelo Claude ou GPT; toda execução grava o id do modelo que fez esses papéis (ADR-0003).
- Um cérebro sem chave no `.env` é pulado com aviso, sem derrubar a rodada.
- Métricas principais são verificadas por código; o juiz só dá naturalidade, separada (ADR-0006).
- O showcase no Labs (`prospect-me`, `/demo/bot-whatsapp-ia-vs-jev`) lê o `data.json` exportado daqui e não mostra a conta de produto (ADR-0001).

## Comandos

```bash
npm test          # vitest
npm run typecheck
```
