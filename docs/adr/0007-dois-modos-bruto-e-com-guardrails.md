# O benchmark roda em dois modos: bruto e com guardrails

A revisão de segurança de 26/09/2026 (`docs/seguranca/modelo-de-ameacas.md`) recomendou duas defesas na camada comum. A primeira é **confirmação por código**: agendar, remarcar e cancelar ficam pendentes até um "sim" do paciente. A segunda é um **filtro de saída**: preço, profissional, convênio ou horário que não existe no `establishment.json` ou na agenda faz a resposta ser trocada por um template seguro.

Para o produto, essas defesas são obrigatórias. Para o benchmark, elas escondem justamente os erros que ele mede. Então cada execução roda nos dois modos:

- **bruto** — o cérebro sozinho sobre a camada comum. As ferramentas não travam a confirmação (ADR-0002); "agendou sem confirmar" é medido como ação perigosa (ADR-0006).
- **com guardrails** — o sistema que iria para uma clínica. Os guardrails são uma camada que liga e desliga, igual para os quatro cérebros.

A demo mostra as duas colunas. A distância entre elas diz quanto da diferença entre LLM e Jev a camada de segurança fecha, e o que sobra é a diferença que só o cérebro explica.

## O que vale nos dois modos

Isso fica na camada comum e não desliga:

- a identidade do paciente vem do canal;
- datas inexistentes são recusadas;
- limite de agendamentos por paciente e horizonte de 90 dias;
- texto livre (nome, resumo) é validado e curto;
- o log é congelado.

Não é guardrail de comportamento, é integridade dos dados. Sem isso, um cenário adversarial corromperia a própria medição.
