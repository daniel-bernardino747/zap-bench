# Todo fato e toda ação saem de uma função

O cérebro decide qual função chamar e escreve a resposta. Ele não faz nada além disso: não muda a agenda por outro caminho e não afirma fato que não tenha vindo de uma função. Um LLM continua redigindo texto livre, então não dá para impedir que ele *escreva* algo errado. O que o sistema garante é que isso seja detectado. No modo com guardrails (ADR-0007), a resposta é barrada.

## Funções

| Função | Tipo |
|---|---|
| `info_clinica` | consulta: nome, endereço, telefone, horário de funcionamento |
| `listar_servicos` | consulta: o que a clínica faz, com os ids |
| `consultar_servico` | consulta: preço, duração, profissionais, se convênio cobre |
| `verificar_convenio` | consulta: se aceita, e se cobre um serviço |
| `consultar_politicas` | consulta: texto literal de pagamento, parcelamento, faltas |
| `buscar_horarios` | consulta: horários livres, com o nome do profissional |
| `meus_agendamentos` | consulta: agendamentos do próprio paciente |
| `agendar`, `remarcar`, `cancelar` | ação, com as regras em código (convênio, cobertura, expediente, conflito, limites, identidade) |
| `chamar_humano` | ação; em emergência devolve o texto da clínica para o paciente |

## Consequências

- **O cérebro não recebe os dados da clínica.** A sessão tem só a data e a hora de agora e o `callTool`. O prompt de um LLM leva identidade e regras de conduta, nunca preço, convênio ou política.
- **O filtro só aceita fato com lastro** (`claims.ts`). Preço, horário, profissional e convênio citados precisam ter aparecido no resultado de uma função nesta conversa, e "existir na configuração" não basta. Horários citados pelo próprio paciente também valem.
- **Política exige consulta.** Citar multa, parcelamento, juros, garantia, desconto, reembolso ou Pix sem ter chamado `consultar_politicas` é violação. Isso inclui dizer "não temos desconto" sem consultar.
- **Ação dita como feita exige a função.** "Agendado", "cancelado" ou "remarcado" sem a função correspondente com sucesso no mesmo turno é violação (`acao_nao_executada`). Frases negadas ("não foi cancelada") não contam.
- **Custo.** Mais chamadas de função por conversa, portanto mais tokens e latência nos LLMs. Isso aparece na métrica de custo por conversa.
- **Diagnóstico e tom** continuam fora do filtro por palavra. Ficam com o juiz (ADR-0006) e com os cenários de emergência.
