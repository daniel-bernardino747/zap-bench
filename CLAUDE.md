# zap-bench

Compara bots de atendimento de WhatsApp para uma clínica: Claude Sonnet 5, Claude Haiku 4.5 e o GPT principal contra Jev + templates, sobre as mesmas conversas gravadas. Repo público; a conta de produto nunca entra no git. Decisões em `docs/adr/`.

## Estrutura

- `establishments/` — estabelecimentos fictícios (`fictional: true` obrigatório), validados por `src/domain/establishment.ts`. Trocar a clínica por outro estabelecimento é trocar o JSON.
- `scenarios/dev` e `scenarios/validation` — prompts e regras do Jev se ajustam só olhando `dev`; o número publicado vem só de `validation` (ADR-0002). Cada um tem `uma-fala/` (roteiro fixo, versões padrão e difícil) e `conversa/` (persona para o paciente simulado, verificação pelo estado final da agenda). Formato em `src/scenarios/schema.ts`; estilo das personas em `scenarios/personas.json`. Mover um cenário entre `dev` e `validation` invalida resultados anteriores: não faça.
- `src/domain/` — camada comum: estabelecimento, agenda falsa, ferramentas, buffer de mensagens e o guard por conversa (`guardrails.ts`). Igual para todos os cérebros. `claims.ts` é ao mesmo tempo a métrica de alucinação e o filtro de saída: nunca duplicar essa lógica.
- `src/brains/` — o contrato `Brain`/`BrainSession` (uma sessão por conversa, ferramentas só via `callTool`) e o registro em `index.ts`. `rules.ts` é um cérebro falso, sem IA, só para testar o encanamento; não entra na comparação. `prompt.ts` é o prompt único dos LLMs (Sonnet, Haiku e GPT usam o mesmo texto); `claude.ts` é o laço de tool use da Anthropic; `jev.ts` é o gerenciador de diálogo mínimo do Jev, com perguntas em inglês e templates em português. O modelo do Jev fica fixo (`jev-1.13.0`).
- `src/sim/patient.ts` — interface do paciente simulado e um paciente por regras. O de verdade é `src/sim/llm.ts`, escolhido por `SIM_MODEL`: um modelo `claude-*` vai pela API da Anthropic; outro nome usa `SIM_BASE_URL`/`SIM_API_KEY` (endpoint compatível com a OpenAI).
- `src/runner/` — `run.ts` roda um cenário (buffer, eventos da recepção, entrega duplicada, guard); `evaluate.ts` são as verificações; `suite.ts` é a rodada com trava de custo e o resumo.
- `src/export/` — o contrato (`schema.ts`) e a montagem do `data.json` que a página do Labs lê. Só rodada da validation; cérebro falso ou paciente por regras saem com `synthetic: true`, e a página não publica isso.
- `runs/` — saída do executor (`records.jsonl` + `summary.json`). Gitignored; o que for publicado vai para `results/`.
- `reports/produto/` — conta de R$ 59,90/mês por clínica, IA + WhatsApp (ADR-0005, ADR-0008). Gitignored.
- `docs/produto/` — pesquisa para o produto final: custos do WhatsApp, tutorial do número para a clínica, segurança e LGPD. Público.
- `docs/seguranca/modelo-de-ameacas.md` — prompt injection, o que a camada comum garante e os cenários adversariais.
- `docs/pesquisa/problemas-reais.md` — o que dá errado com bots de atendimento de verdade, e que cenário cobre cada coisa.

## Regras

- Todo fato e toda ação saem de uma função (ADR-0009). Cérebro nenhum recebe os dados da clínica; o filtro só aceita preço, horário, profissional, convênio e política que vieram de uma função nesta conversa. Nova informação da clínica vira campo no `establishment.json` e função de consulta em `tools.ts`, nunca texto no prompt.
- Paciente simulado e juiz nunca usam um modelo da comparação (`BRAIN_MODELS`) nem GPT; hoje o paciente é o Claude Opus 5, que não sabe com qual cérebro fala. Toda execução grava o id do modelo que fez esses papéis (ADR-0010, que substitui essa regra do ADR-0003).
- Paciente simulado fora do ar vira `paciente_indisponivel`: fica gravado e sai das métricas.
- Um cérebro sem chave no `.env` é pulado com aviso, sem derrubar a rodada.
- O Node roda o TypeScript só removendo tipos (`erasableSyntaxOnly`): sem parameter properties, enums ou namespaces.
- Métricas principais são verificadas por código; o juiz só dá naturalidade, separada (ADR-0006).
- Toda execução roda em dois modos, bruto e com guardrails (ADR-0007). Integridade dos dados (identidade pelo canal, datas válidas, limites por paciente, texto livre curto, log congelado) vale nos dois e não desliga.
- O showcase no Labs (`prospect-me`, `/demo/bot-whatsapp-ia-vs-jev`) lê o `data.json` exportado daqui e não mostra a conta de produto (ADR-0001).

## Comandos

```bash
npm test          # vitest
npm run typecheck
npm run bench -- run --smoke                       # um cenário por tarefa, cérebro falso
npm run bench -- run --brain sonnet,jev --split dev  # dev, 3 execuções, os dois modos e as duas personas
npm run bench -- export latest --out <arquivo>        # última rodada da validation → data.json da página do Labs
```
