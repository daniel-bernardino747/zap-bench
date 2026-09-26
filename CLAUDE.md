# zap-bench

Compara bots de atendimento de WhatsApp para uma clínica: Claude Sonnet 5, Claude Haiku 4.5 e o GPT principal contra Jev + templates, sobre as mesmas conversas gravadas. Repo público; a conta de produto nunca entra no git. Decisões em `docs/adr/`.

## Estrutura

- `establishments/` — estabelecimentos fictícios (`fictional: true` obrigatório), validados por `src/domain/establishment.ts`. Trocar a clínica por outro estabelecimento é trocar o JSON.
- `scenarios/dev` e `scenarios/validation` — prompts e regras do Jev se ajustam só olhando `dev`; o número publicado vem só de `validation` (ADR-0002). Cada um tem `uma-fala/` (roteiro fixo, versões padrão e difícil) e `conversa/` (persona para o paciente simulado, verificação pelo estado final da agenda). Formato em `src/scenarios/schema.ts`; estilo das personas em `scenarios/personas.json`. Mover um cenário entre `dev` e `validation` invalida resultados anteriores: não faça.
- `src/domain/` — camada comum: estabelecimento, agenda falsa, ferramentas, buffer de mensagens e o guard por conversa (`guardrails.ts`). Igual para todos os cérebros. `claims.ts` é ao mesmo tempo a métrica de alucinação e o filtro de saída: nunca duplicar essa lógica.
- `reports/produto/` — conta de R$ 59,90/mês por clínica, IA + WhatsApp (ADR-0005, ADR-0008). Gitignored.
- `docs/produto/` — pesquisa para o produto final: custos do WhatsApp, tutorial do número para a clínica, segurança e LGPD. Público.
- `docs/seguranca/modelo-de-ameacas.md` — prompt injection, o que a camada comum garante e os cenários adversariais.

## Regras

- Paciente simulado e juiz nunca usam um modelo Claude ou GPT; toda execução grava o id do modelo que fez esses papéis (ADR-0003).
- Um cérebro sem chave no `.env` é pulado com aviso, sem derrubar a rodada.
- Métricas principais são verificadas por código; o juiz só dá naturalidade, separada (ADR-0006).
- Toda execução roda em dois modos, bruto e com guardrails (ADR-0007). Integridade dos dados (identidade pelo canal, datas válidas, limites por paciente, texto livre curto, log congelado) vale nos dois e não desliga.
- O showcase no Labs (`prospect-me`, `/demo/bot-whatsapp-ia-vs-jev`) lê o `data.json` exportado daqui e não mostra a conta de produto (ADR-0001).

## Comandos

```bash
npm test          # vitest
npm run typecheck
```
