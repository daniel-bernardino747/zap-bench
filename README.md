# zap-bench

Bot de atendimento de WhatsApp para uma clínica odontológica fictícia, construído de cinco jeitos e medido sobre as mesmas conversas:

| Cérebro | Como decide | Como escreve |
|---|---|---|
| Claude Sonnet 5 | LLM com ferramentas | LLM |
| Claude Haiku 4.5 | LLM com ferramentas | LLM |
| GPT principal | LLM com ferramentas | LLM |
| Jev | classificador (escolhe entre opções) | templates |
| Jev + redator | classificador (escolhe entre opções) | template reescrito pelo Claude Haiku 4.5, com checagem (ADR-0011) |

O bot tira dúvidas, agenda, remarca e cancela, passa para humano, trata emergência e recusa o que está fora do escopo. Cada cenário é testado com um paciente educado e com um que escreve errado e não tem paciência.

Resultados: [labs.teamdbsolutions.com/demo/bot-whatsapp-ia-vs-jev](https://labs.teamdbsolutions.com/demo/bot-whatsapp-ia-vs-jev) (em construção).

## Rodar

```bash
cp .env.example .env   # preencha as chaves que tiver
npm install
npm test
```

As decisões de projeto estão em [`docs/adr/`](docs/adr/).
