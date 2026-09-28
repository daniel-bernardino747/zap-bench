# Paciente simulado por um modelo Claude fora da comparação

Substitui a regra do ADR-0003 de que paciente e juiz nunca usam um modelo Claude ou GPT.

Os planos gratuitos não serviram para o paciente. Os modelos gratuitos do OpenCode Zen só atendem de dentro do agente de programação do OpenCode (403 `FreeTierError` pela API e também com um agente próprio), e o plano gratuito do Gemini não aguentou o volume: 503 de alta demanda e, depois, 429 de cota esgotada, antes de terminar uma única conversa.

O paciente passa a ser o **Claude Opus 5** (`claude-opus-5`), com esforço baixo, pela mesma chave da Anthropic. Três cuidados:

- **Nunca um modelo da comparação.** `src/sim/llm.ts` recusa como `SIM_MODEL` qualquer modelo de `BRAIN_MODELS` (Sonnet 5, Haiku 4.5, Jev) e qualquer GPT, e também modelos de origem não revelada.
- **O paciente não sabe com quem fala.** Ele recebe só as mensagens do bot; nome do cérebro, modelo e modo nunca entram no prompt dele.
- **O risco que sobra fica declarado.** Um Claude pode entender melhor o jeito de escrever de outro Claude, o que favoreceria Sonnet e Haiku nas conversas. A página do Labs diz qual modelo fez o paciente, e o id fica gravado em cada execução.

O custo do paciente entra na trava de custo da rodada. O caminho por endpoint compatível com a OpenAI continua no código, para trocar de volta por um modelo de outra família quando houver um viável.
