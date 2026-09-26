# A comparação é feita por execuções gravadas, publicadas como showcase no Labs

O zap-bench compara bots de atendimento de WhatsApp para uma clínica: três cérebros com LLM contra um com Jev. A pergunta é quanto cada abordagem acerta, erra, inventa e custa diante das mesmas conversas, e isso só é justo se todos respondem às mesmas conversas, gravadas.

Por isso a CLI roda os cérebros sobre o conjunto de teste e exporta um `data.json` com as conversas completas, as decisões, tokens, custo e latência. A página pública é um **showcase** do Labs (`prospect-me`, ADR-0002 de lá) em `labs.teamdbsolutions.com/demo/bot-whatsapp-ia-vs-jev`, registrado em `labs/src/artifacts/index.ts`, que reproduz essas execuções lado a lado.

Uma demo ao vivo no Labs foi recusada: exigiria chaves no Railway, limite de uso e proteção contra abuso, num app que hoje só lê `data.json` estático. E mostraria a conversa que cada visitante inventou, não uma comparação. O modo ao vivo existe só no simulador local (ADR-0004); uma demo ao vivo pública, se vier, é um serviço à parte que o Labs apenas aponta.

## Consequências

- O showcase mostra só a comparação LLM × Jev. A conta de produto (ADR-0005) não aparece nele.
- Os dados da clínica são fictícios e a página diz isso; nada imita uma empresa real.
- Execuções gravadas são versionadas no repositório, que é público.
