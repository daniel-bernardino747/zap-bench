# Quatro cérebros sobre uma camada comum, com o custo de construção à vista

Os cérebros comparados são **Claude Sonnet 5**, **Claude Haiku 4.5**, **o GPT principal da OpenAI** (id conferido na documentação na implementação) e **Jev + templates**. Um híbrido (Jev decide, um LLM pequeno reescreve o template) fica fora da primeira versão e volta se os resultados pedirem.

Tudo que não é decisão fica na **camada comum**, igual para os quatro: o `establishment.json`, a agenda falsa, as ferramentas da clínica (consultar horários, agendar, remarcar, cancelar, passar para humano) e o **buffer** que junta mensagens seguidas do paciente antes de responder, como fazem bots reais de WhatsApp.

## A assimetria do Jev

Jev é um classificador pago da TypeSafe: recebe estado e perguntas nomeadas e escolhe entre opções dadas. Não produz texto; todo argumento textual vem da mensagem do paciente ou de um resultado anterior. O bot Jev precisa, então, de um gerenciador de diálogo escrito por nós — estado, campos faltantes, templates, regras de confirmação — enquanto um cérebro LLM recebe só prompt de sistema e ferramentas.

Essa diferença é medida, não escondida: o repositório contabiliza o **custo de construção** de cada cérebro (linhas de código e de prompt específicas de cada um, número de templates do Jev) e a demo o exibe. O Jev ganha só o gerenciador mínimo; os LLMs, só um prompt.

## Desenvolvimento e validação

O conjunto de teste é dividido em `scenarios/dev` e `scenarios/validation`. Prompts e regras do Jev são ajustados olhando só o `dev`; o número publicado vem só do `validation`. Sem isso qualquer lado pode ser treinado para a prova.
