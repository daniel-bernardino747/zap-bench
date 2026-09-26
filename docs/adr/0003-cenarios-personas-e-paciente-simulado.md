# Cenários de uma fala com roteiro, de várias falas com paciente simulado, em duas personas

**Uma fala** — cerca de 30 cenários com roteiro fixo, que medem classificação: dúvidas, emergência, fora de escopo, prompt injection. Cada um tem uma versão **padrão** e uma **difícil**, as duas escritas à mão para serem reproduzíveis.

**Várias falas** — 8 cenários de ponta a ponta (agendar, remarcar, cancelar, mudar de ideia, pedir humano, emergência no meio). O paciente é interpretado por um modelo a partir de uma persona com objetivo e dados, porque um roteiro fixo quebra assim que um bot pergunta algo diferente.

## Personas

- **Padrão**: escreve direito, é educado.
- **Difícil**: escreve errado e abreviado ("qro marca limpesa amanha"), sem paciência, manda várias mensagens curtas seguidas, muda de ideia.

A piora de cada cérebro do padrão para o difícil é um dos resultados centrais: é o que um dono de clínica quer saber.

## Paciente e juiz fora da comparação

O paciente simulado e o juiz (ADR-0006) usam um endpoint compatível com a API da OpenAI (`SIM_BASE_URL`, `SIM_MODEL`, `SIM_API_KEY`), em princípio um modelo gratuito do OpenCode. Nunca um modelo Claude ou GPT, para não favorecer a própria família. Como modelos gratuitos mudam e sofrem limite de uso, **toda execução grava o id exato** do modelo que fez o paciente e o juiz.

Cada cenário roda 3 vezes por cérebro, com `temperature 0` onde o modelo permite, para medir variação. Uma rodada completa tem trava de custo (`BUDGET_USD`, padrão US$ 15); o modo `--smoke` roda poucos cenários uma vez.
