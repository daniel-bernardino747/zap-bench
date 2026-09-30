# Jev decide, um redator escreve

Tira da espera o híbrido que o ADR-0002 deixou fora da primeira versão.

Na primeira rodada das conversas da dev (29/09/2026), o Jev acertou tanto quanto o Sonnet, a um terço do custo, mas as respostas soam como sistema: a mesma estrutura em toda mensagem, nenhum reconhecimento do que o paciente disse, a mesma pergunta repetida palavra por palavra. Num produto, as decisões e as ações ficariam com o Jev, e a conversa com outro agente.

Entra um quinto cérebro, **Jev + redator** (`jev-redator`). O Jev puro continua como base da comparação.

- **O Jev decide e age como antes.** O gerenciador de diálogo (`src/brains/jev.ts`) escolhe o próximo passo, chama as funções e monta a mensagem com o template. Essa mensagem vira a base do redator.
- **O redator só reescreve.** É o Claude Haiku 4.5 (`src/brains/writer.ts`), sem ferramentas. Recebe a mensagem-base e as últimas mensagens da conversa, para acertar o tom e reconhecer o que o paciente disse.
- **O texto do redator passa por uma checagem, nos dois modos.** Ele precisa manter os horários, datas, preços, profissionais e itens de lista da base, sem acrescentar nenhum, nem um dia da semana, "hoje" ou "amanhã" que a base não tinha. Passa também pelo mesmo `checkReply` de `claims.ts`, contra o que as funções devolveram na conversa, e não pode copiar 5 palavras seguidas do paciente. Se falhar em qualquer ponto, sai a mensagem-base. O pior caso é o Jev puro, nunca um fato inventado.
- **Mensagem que uma função manda entregar sai como está.** É o caso da orientação de emergência de `chamar_humano`.
- **O custo e o id ficam gravados.** O custo do redator entra no do cérebro, e o id do modelo é `jev-1.13.0+claude-haiku-4-5`.

O Jev puro também ganhou a regra de nunca mandar a mesma mensagem duas vezes seguidas: na segunda vez ela é reformulada, na terceira alguém da equipe assume.

O que fica em aberto: com o Haiku como redator, o híbrido tem um Claude na conversa, e o paciente simulado também é Claude (ADR-0010). Hoje ninguém mede se o texto ficou mais humano: isso é trabalho do juiz de naturalidade (ADR-0006), que ainda não existe. A proporção de reescritas recusadas também não é gravada.
