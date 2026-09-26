# Custo do WhatsApp Cloud API por clínica

Pesquisa de 26/09/2026. Objetivo: saber quanto o canal WhatsApp oficial (Cloud API da Meta, ligado ao inbox WhatsApp nativo do Chatwoot, ADR-0004) custa por clínica e quanto isso come da mensalidade de R$ 59,90 (ADR-0005).

Legenda: **CONFIRMADO** = lido na fonte primária na data indicada. **INFERIDO** = conta ou conclusão nossa, ou fonte não primária.

---

## TL;DR

- **Com a mudança de 1º/10/2026, o atendimento deixa de ser grátis.** Desde 01/11/2024 as mensagens de serviço (respostas livres dentro da janela de 24h) eram gratuitas. **A partir de 01/10/2026 a Meta passa a cobrar cada mensagem de serviço entregue**, pelo mesmo preço de utility/authentication do país. Cada número de telefone tem uma **franquia grátis de 1.000 mensagens de serviço por mês**. CONFIRMADO (developers.facebook.com, página de preços atualizada em 10/09/2026).
- **Preço no Brasil a partir de 01/10/2026:** serviço = utility = authentication = **US$ 0,0068** ou **R$ 0,0350** por mensagem. Marketing custa **US$ 0,0625** ou **R$ 0,3217**. CONFIRMADO (rate cards oficiais "effective October 1, 2026", em USD e em BRL).
- **O que é cobrado agora é a mensagem, não a conversa.** O custo passa a depender de **quantas mensagens o bot envia por conversa**. Até ~3,3 mensagens do bot por conversa, 300 conversas cabem na franquia grátis. Com 6 mensagens por conversa, o custo é de **R$ 28/mês (47% da mensalidade)**. INFERIDO (conta nossa sobre preços confirmados).
- **Utility dentro da janela de 24h também passa a ser cobrado** a partir de 01/10/2026. Até 30/09/2026 era grátis. CONFIRMADO.
- **Lembrete de consulta** (template utility fora da janela) custa **R$ 0,035 cada**. Portanto 300 lembretes custam **R$ 10,50 por mês**. INFERIDO (conta sobre preço confirmado).
- **Faturamento em BRL:** clientes com país de faturamento Brasil podem criar contas em BRL desde 16/07/2026, e **todas precisam estar em BRL até 30/06/2027**. A cobrança em BRL é emitida pela **Facebook Brasil**. CONFIRMADO.
- **Quem paga:** num modelo Tech Provider (o nosso caso, sem linha de crédito), **cada clínica cadastra o próprio cartão e a Meta cobra a clínica direto**. Não sai do nosso caixa, a menos que a gente decida absorver. CONFIRMADO (docs de parceiros).

---

## 1. Modelo de cobrança vigente

### 1.1 Até 30/09/2026 (hoje)

CONFIRMADO (página "Pricing on the WhatsApp Business Platform", atualizada em 10/09/2026, acessada em 26/09/2026):

- Desde **01/07/2025** a cobrança é **por mensagem entregue** e substituiu o modelo por conversa de 24h. Só é cobrado o **template** entregue (`"type":"template"`). O preço depende da **categoria** do template e do **DDI do destinatário**.
- Desde **01/11/2024**, mensagens não-template (texto, imagem etc., que só podem ser enviadas dentro da janela) são **grátis**.
- Desde **01/07/2025**, **templates utility enviados dentro de uma janela de atendimento aberta** são **grátis**.
- **Janela de entrada gratuita (FEP) de 72h:** quando o usuário chega por um anúncio Click-to-WhatsApp ou pelo botão de CTA de uma Página do Facebook (só apps móveis), **todas as mensagens são grátis por 72h, inclusive templates**. A janela FEP é independente da janela de 24h.
- **Janela de atendimento (CSW):** abre quando o usuário manda mensagem e dura 24h a partir da **última** mensagem dele. Fechada a janela, só é possível enviar template.
- Categorias de template: **marketing**, **utility**, **authentication**. A empresa é responsável pela categoria que a Meta atribuir ao template aprovado e paga o preço da categoria vigente no momento do uso.

### 1.2 A partir de 01/10/2026 (daqui a 5 dias)

CONFIRMADO (página de preços, seções "Service rates, effective October 1, 2026" e "Utility rates, effective October 1, 2026", e a página "Upcoming pricing updates for Meta Business Agent, service and utility messages", atualizada em 25/08/2026):

- **Mensagens de serviço passam a ser cobradas por mensagem**, com preço **igual ao de utility/authentication** do país. Não há volume tier para serviço.
- **Franquia grátis:** "Each business phone number has one shared free tier of 1,000 delivered service messages per month". A franquia **não acumula** e zera todo mês. Mensagens 1:1 e de grupo usam a mesma franquia.
- **Utility em resposta ao usuário** (dentro da janela de 24h) **passa a ser cobrado**. Era grátis desde 01/07/2025.
- A janela FEP de 72h **continua gratuita** para marketing, utility, authentication e serviço. Não vale para mensagens do Meta Business Agent.
- **Sem forma de pagamento cadastrada até 30/09/2026**, a Meta **para de entregar mensagens de serviço** assim que a franquia grátis acaba.
- Nos webhooks de status, `pricing.type` passa de `free_customer_service` para `regular` com `billable: true` depois da franquia. Dá para medir o custo real no nosso lado.
- Nova categoria **Meta Business Agent** (desde 01/08/2026): é o agente de IA da própria Meta e custa US$ 2,00 por 1M tokens, "approximately 4–5 cents (USD) per message". É um concorrente direto e fica fora do nosso caso. Nós somos "Service messages – Can be powered by a person [...] or by a 3rd-party AI solution".

### 1.3 Política "AI Providers": o bot da clínica provavelmente não é afetado

CONFIRMADO (página "New pricing policy for AI Providers", atualizada em 01/09/2026):

- Desde **11/03/2026**, no **Brasil (+55)**, a Meta cobra de "AI Providers" **cada mensagem não-template**. Na Europa essa cobrança acabou em 12/05/2026, **no Brasil continua**.
- A definição de "AI Provider" vem dos Termos de 15/01/2026: provedores de LLM, IA generativa e "general-purpose artificial intelligence assistants". A página diz que a política "does NOT change how Meta charges all other businesses".
- **INFERIDO:** um bot restrito ao atendimento de uma clínica (agenda, remarcação, dúvidas da própria clínica) é "service message powered by a 3rd-party AI solution" e não "general-purpose AI assistant". O risco existe se o bot responder qualquer coisa fora do escopo da clínica. **Manter o bot restrito ao domínio da clínica**, o que já é o desenho do zap-bench.

---

## 2. Preços para o Brasil (DDI +55)

Fonte: rate cards CSV oficiais linkados na página de preços. CONFIRMADO em 26/09/2026.

| Categoria | USD até 30/09/2026 | USD a partir de 01/10/2026 | BRL até 30/09/2026 | BRL a partir de 01/10/2026 |
|---|---|---|---|---|
| Marketing | 0,0625 | 0,0625 | 0,3217 | 0,3217 |
| Utility (fora da janela) | 0,0068 | 0,0068 | 0,0350 | 0,0350 |
| Utility (dentro da janela) | grátis | **0,0068** | grátis | **0,0350** |
| Authentication | 0,0068 | 0,0068 | 0,0350 | 0,0350 |
| Serviço (não-template, na janela) | grátis | **0,0068** (após 1.000/mês/número) | grátis | **0,0350** (após 1.000/mês/número) |
| Qualquer mensagem na janela FEP 72h | grátis | grátis | grátis | grátis |

**Volume tiers (só utility e authentication, Brasil, BRL):** preço cheio até 250.000 utility por mês. A partir daí o desconto começa em -5% e chega a -25% acima de 70 milhões. Os tiers são contados **por business portfolio**. Como cada clínica tem o próprio portfolio (seção 5), **nenhuma clínica chega perto do primeiro tier**. CONFIRMADO (CSV de volume tiers BRL, 01/07/2026 e 01/10/2026).

### 2.1 Moeda de faturamento

CONFIRMADO (página de preços, seção "Billing localization for Brazil and India"):

- Desde 01/07/2026 (rollout completo em **16/07/2026**), provedores e empresas integradas diretamente cujo **Sold-To country é Brasil** no Billing Hub podem criar contas em **BRL**.
- A cobrança de contas em BRL é faturada em BRL pela **Facebook Brasil**, entidade local da Meta.
- **Até 30/06/2027** todas as contas desses clientes precisam ser migradas para BRL. A partir de 01/07/2027 a Meta **deixa de entregar** mensagens de contas não-BRL desses clientes.
- **INFERIDO:** para clínica brasileira, criar a conta já em BRL. Isso evita IOF de cartão internacional e variação cambial. Não verificamos se a fatura da Facebook Brasil destaca impostos locais além do preço de tabela.

### 2.2 Câmbio usado

- **PTAX venda de 25/09/2026: R$ 5,1991 por US$** (Banco Central, API Olinda, consultada em 26/09/2026). CONFIRMADO.
- US$ 0,0068 × 5,1991 = **R$ 0,0354**, praticamente igual ao preço em BRL da tabela (R$ 0,0350). As contas abaixo usam o **preço BRL oficial, R$ 0,035**.

---

## 3. Custo de um lembrete de consulta

O produto hoje não envia lembretes. Se passar a enviar, o lembrete é um **template utility** mandado pela clínica **fora da janela**, porque o paciente não falou nas últimas 24h.

- Preço: **R$ 0,035 por lembrete entregue** (US$ 0,0068). CONFIRMADO.
- 300 lembretes por mês = **R$ 10,50**. 600 lembretes = **R$ 21,00**. INFERIDO (conta).
- Se o paciente responder ao lembrete ("confirmo", "preciso remarcar"), a janela de 24h abre e **as respostas do bot são mensagens de serviço**. Elas entram na franquia de 1.000 e, depois dela, custam R$ 0,035 cada. INFERIDO.
- O template precisa ser aprovado como **utility**. Se a Meta classificar como marketing (por exemplo, com texto promocional), cada lembrete passa a custar **R$ 0,3217**, 9 vezes mais. CONFIRMADO (a empresa aceita a categoria vigente no uso).
- Limite: portfolio novo pode iniciar conversa com **250 usuários únicos em 24h**. 300 lembretes por mês dão cerca de 10–15 por dia, bem abaixo disso. CONFIRMADO (doc "Messaging Limits", 21/05/2026).

---

## 4. Custos indiretos

| Item | Custo | Status |
|---|---|---|
| Uso da Cloud API (hospedagem da Meta) | Nenhuma taxa além das mensagens. A página de preços só lista cobrança por mensagem. | CONFIRMADO que a página não lista outra taxa. INFERIDO que não existe outra. |
| Número de telefone | A Meta não cobra pelo registro. Um número novo (chip) custa o que a operadora cobrar, com recarga para manter ativo. | INFERIDO |
| Verificação do negócio (Meta Business) | Sem taxa conhecida. Exige documentos. | INFERIDO |
| BSP (Twilio, 360dialog, Gupshup etc.) | **Não usamos.** A Cloud API direta não tem margem de BSP. Com BSP, a margem típica é informada por fontes secundárias como 10–30%. | INFERIDO |
| Nos tornarmos **Tech Provider** (para conectar números de várias clínicas pelo Chatwoot) | Sem taxa, mas exige **verificação do nosso negócio + App Review** (vídeos, política de privacidade) para acesso avançado a `whatsapp_business_messaging` e `whatsapp_business_management`. | CONFIRMADO (doc "Become a Tech Provider", 20/08/2026) |
| Limite de onboarding como Tech Provider | 10 clínicas novas por 7 dias. Sobe para 200 por 7 dias após Business Verification + App Review + Access Verification. | CONFIRMADO (doc "Embedded Signup", 24/07/2026) |
| Chatwoot + bot (hospedagem) | Por nossa conta (docker-compose, cerca de 4 GB RAM, ADR-0004). Fora desta conta. | — |
| Throughput em coexistência | Fixo em 20 mensagens/s por número. Irrelevante para clínica. | CONFIRMADO |

**Quem paga as mensagens:** "clients onboarded by Tech Providers must provide their own payment method after onboarding is complete. Meta will then bill these clients for API usage". Só Solution Partners têm linha de crédito e faturam o cliente. CONFIRMADO (doc "Partners", 21/05/2026). Assim, **o custo de WhatsApp é da clínica, pago direto à Meta**. Ele só "come" o R$ 59,90 se decidirmos absorvê-lo ou se o preço for comunicado como "tudo incluso".

---

## 5. Tabela final: custo mensal de WhatsApp por clínica

Premissas:

- Preço Brasil em BRL: **R$ 0,035** por mensagem de serviço/utility (a partir de 01/10/2026). CONFIRMADO.
- Franquia grátis: **1.000 mensagens de serviço por número por mês**. CONFIRMADO.
- **Mensagens enviadas pelo bot por conversa: 6** (caso base). **INFERIDO**: o zap-bench ainda não tem execuções gravadas para medir. Uma conversa de agendamento típica tem saudação, pergunta de horário, oferta de horários, confirmação, instruções e despedida. As mensagens do paciente não são cobradas. Mensagens de humanos respondendo pelo Chatwoot também são mensagens de serviço e também contam.
- Lembrete = template utility fora da janela. Respostas do bot aos lembretes não estão incluídas (ver sensibilidade).
- Mensalidade: R$ 59,90.

### 5.1 A partir de 01/10/2026 (o que vale para o produto)

| Cenário | Mensagens de serviço | Pagas (após 1.000) | Serviço | Lembretes | **Total/mês** | % de R$ 59,90 |
|---|---|---|---|---|---|---|
| A. Só atendimento, 300 conversas | 1.800 | 800 | R$ 28,00 | — | **R$ 28,00** | **47%** |
| B. 300 conversas + 300 lembretes | 1.800 | 800 | R$ 28,00 | R$ 10,50 | **R$ 38,50** | **64%** |
| C. 600 conversas + 600 lembretes | 3.600 | 2.600 | R$ 91,00 | R$ 21,00 | **R$ 112,00** | **187%** |

Todos os totais são INFERIDOS: preços CONFIRMADOS com premissa de 6 mensagens do bot por conversa.

### 5.2 Sensibilidade a mensagens do bot por conversa (só atendimento, sem lembretes)

| Conversas/mês | 3 msgs/conversa | 6 msgs/conversa | 10 msgs/conversa |
|---|---|---|---|
| 150 | R$ 0,00 (450 msgs) | R$ 0,00 (900) | R$ 17,50 (1.500) |
| 300 | R$ 0,00 (900) | R$ 28,00 (1.800) | R$ 70,00 (3.000) |
| 600 | R$ 28,00 (1.800) | R$ 91,00 (3.600) | R$ 175,00 (6.000) |

Fórmula: `custo = max(0, conversas × msgs_bot − 1000) × 0,035`. **Ponto de equilíbrio da franquia com 300 conversas: 3,33 mensagens do bot por conversa.** INFERIDO.

Se o paciente responde a um lembrete e o bot manda mais 2 mensagens, o cenário B ganha +600 mensagens de serviço, ou seja, **+R$ 21,00**. INFERIDO.

### 5.3 Até 30/09/2026, só para comparação

Serviço e utility dentro da janela são grátis. A: **R$ 0,00**. B: **R$ 10,50** (18%). C: **R$ 21,00** (35%). Esse regime **acaba em 5 dias** e não serve para planejar. CONFIRMADO (regras) / INFERIDO (conta).

### 5.4 Leituras para o produto (INFERIDO)

1. **A métrica que importa é "mensagens enviadas por conversa", não "custo por conversa".** O buffer de mensagens (`src/domain/`) e o estilo de resposta do bot passam a ter custo direto. Juntar tudo numa mensagem só em vez de três balões economiza R$ 0,07 por conversa. O zap-bench deveria registrar esse número por cérebro e persona.
2. Com 6 mensagens por conversa, o WhatsApp (R$ 28) **custa quase o dobro do orçamento de IA** do ADR-0005 (R$ 15).
3. Saídas: (a) repassar o custo do WhatsApp à clínica, que já paga a Meta direto no modelo Tech Provider; (b) preço por faixa de conversas; (c) desenhar o bot para responder em 1–3 mensagens por turno e fechar a conversa cedo.
4. Lembretes são baratos (R$ 0,035) **se** aprovados como utility. O que pesa é a conversa que eles geram.

---

## 6. O que contradiz ou ajusta o ADR-0005

- O ADR diz que "o custo do WhatsApp Cloud API para conversas iniciadas pelo paciente ainda precisa ser confirmado". **Confirmado: a partir de 01/10/2026 não é grátis.** São R$ 0,035 por mensagem do bot, depois de 1.000 grátis por número por mês.
- O teto de "R$ 0,05 por conversa" vale só para IA. Somando WhatsApp, cada mensagem do bot além da franquia custa R$ 0,035. Com 6 mensagens, isso dá cerca de R$ 0,09 por conversa no volume acima da franquia, sozinho quase o dobro do teto de IA.
- A conta do relatório de viabilidade precisa de uma linha nova: `whatsapp = max(0, conversas × msgs_bot − 1000) × 0,035 + lembretes × 0,035`. Também precisa da decisão de **quem paga** (clínica direto à Meta ou nós).

---

## Fontes (acessadas em 26/09/2026)

- Meta for Developers, "Pricing on the WhatsApp Business Platform" (atualizada em 10/09/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Meta for Developers, "Upcoming pricing updates for Meta Business Agent, service and utility messages" (atualizada em 25/08/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages
- Meta for Developers, "New pricing policy for AI Providers" (atualizada em 01/09/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers
- Rate cards oficiais em CSV (USD e BRL, "effective July 1, 2026" e "effective October 1, 2026", com volume tiers), baixados dos links da página de preços (hospedados em scontent.*.fbcdn.net; os links são assinados e expiram, então pegue-os de novo pela página de preços). Página pública equivalente: https://business.whatsapp.com/products/platform-pricing (redireciona para whatsappbusiness.com/pt-br/products/platform-pricing/)
- Meta for Developers, "Messaging Limits" (21/05/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits
- Meta for Developers, "Partners" (21/05/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview
- Meta for Developers, "Become a Tech Provider" (20/08/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers
- Meta for Developers, "Embedded Signup" (24/07/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview
- Meta for Developers, "Onboard WhatsApp Business app users" (coexistência, 26/06/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users
- Banco Central do Brasil, PTAX (API Olinda), cotação de 25/09/2026: https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/
- Chatwoot, "WhatsApp Embedded Signup" (self-hosted): https://developers.chatwoot.com/self-hosted/configuration/features/integrations/whatsapp-embedded-signup
