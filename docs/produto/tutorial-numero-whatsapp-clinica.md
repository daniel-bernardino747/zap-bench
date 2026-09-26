# Como preparar o número de WhatsApp da sua clínica para o atendente automático

Guia para o dono ou a recepção da clínica. Atualizado em 26/09/2026.

O atendente automático (o "bot") responde aos pacientes pelo **WhatsApp oficial da Meta**, a chamada *WhatsApp Cloud API*. Ele fica ligado a um painel (Chatwoot) onde a sua equipe acompanha as conversas e assume quando quiser. Este guia mostra como escolher o número, o que preparar e o que fica por nossa conta.

> Onde aparece **(INFERIDO)**, é orientação nossa que não conseguimos confirmar numa página oficial da Meta. O resto vem da documentação oficial. As fontes estão no fim.

---

## 1. A decisão principal: número atual ou número novo?

Hoje a maioria das clínicas atende pelo **app WhatsApp Business no celular da recepção**. Há dois caminhos:

### Caminho A: usar o número atual, mantendo o app no celular ("coexistência") ✅ recomendado na maioria dos casos

Desde 2025 a Meta permite ligar um número que **já está no app WhatsApp Business** à API oficial **sem tirar o app do celular**. A Meta chama isso de *coexistência*.

- O número **continua funcionando no app WhatsApp Business** do celular. A recepção pode seguir respondendo por ali.
- O bot recebe e responde as mensagens pela API, e "o WhatsApp mantém o histórico sincronizado entre os dois".
- O histórico dos **últimos 6 meses** de conversas individuais pode ser copiado para o painel, se vocês autorizarem na hora da conexão. Os **contatos** também são copiados.
- **Brasil:** a documentação oficial atual não lista restrição de país para a coexistência. No início (2025) havia países de fora, como União Europeia, Reino Unido, Nigéria e África do Sul, e o Brasil nunca esteve na lista. Segundo uma discussão do Chatwoot que cita a documentação da Meta, em março/2026 só Nigéria e África do Sul continuavam de fora. **(INFERIDO que funciona no Brasil; confirmar na hora da conexão)**.
- Requisito: app **WhatsApp Business versão 2.24.17 ou superior**.

**O que muda no app do celular depois da conexão:**

| Recurso do app | Depois da conexão |
|---|---|
| Conversas individuais | Continuam. Tudo aparece nos dois lados. |
| Grupos | Continuam no app, mas **não aparecem no painel** |
| Mensagens temporárias | **Desligadas** nas conversas individuais |
| Visualização única | **Desligada** |
| Localização em tempo real | **Desligada** |
| Listas de transmissão | **Desligadas.** As existentes ficam só para leitura e não dá para criar novas. |
| Chamadas de voz/vídeo | Continuam no app. Não passam pelo bot. |
| Catálogo, etiquetas, respostas rápidas, mensagem de ausência | Continuam no app |
| Aparelhos conectados (WhatsApp Web etc.) | **São todos desconectados** na hora e precisam ser conectados de novo. O WhatsApp para Windows não é compatível. |

**Cuidados na coexistência:**

- **Abra o app no celular principal pelo menos uma vez a cada 14 dias.** Se o celular principal ficar cerca de 14 dias sem uso, a Meta **desconecta o número da API** e o bot para.
- **Não reinstale o WhatsApp, não troque de celular e não mude o número** sem nos avisar. Qualquer uma dessas ações desconecta a API. Ao reinstalar, o app oferece religar (a opção vem marcada), e a religação leva alguns minutos.
- **Combine quem responde.** Se alguém responder pelo celular enquanto o bot conversa, o paciente recebe as duas respostas. O painel recebe uma cópia do que foi enviado pelo celular, mas não temos certeza de que isso "pausa" o bot sozinho. **(INFERIDO: regra da casa, quem quiser assumir usa o painel.)**
- As mensagens enviadas **pelo app do celular continuam grátis**. As enviadas pelo bot/painel seguem a tabela da Meta (ver o documento de custos).

### Caminho B: número novo, só para o bot

- Um chip novo (celular é o recomendado) usado **só** na API.
- O número antigo continua no celular como está.
- Desvantagem: os pacientes precisam aprender o número novo, e ele começa sem histórico.
- Vantagem: separação total. O bot nunca disputa conversa com o celular.

### Caminho C: tirar o número atual do app e passar para a API ⚠️ evite

Só faz sentido se a coexistência não funcionar para vocês.

> ### ⚠️ ATENÇÃO: o que não tem volta (ou dá muito trabalho desfazer)
>
> - **Apagar a conta do WhatsApp (Configurações > Conta > Apagar minha conta)** para registrar o número na API **perde o histórico de mensagens**. Depois disso, o número **não pode ser usado no app WhatsApp Business**, a não ser que seja retirado da API. **Faça backup antes.** Isso só é necessário no Caminho C. **Na coexistência (Caminho A) não se apaga nada.**
> - Um número registrado só na API **não funciona no WhatsApp comum nem no WhatsApp Business do celular**. Ele continua recebendo ligações e SMS normais.
> - A **cópia do histórico** na coexistência só pode ser feita **uma vez** e precisa acontecer **em até 24 horas** depois da conexão. Deixe o app aberto no celular durante a conexão.
> - Número **banido** pelo WhatsApp não pode ser registrado antes de ser liberado por recurso.
> - O **nome de exibição** só pode ser trocado 10 vezes a cada 30 dias, e cada troca passa por nova análise.

---

## 2. Requisitos do número

Segundo a documentação oficial, o número precisa:

- **Ser da clínica** (vocês são donos dele);
- Ter **DDI e DDD**. Números curtos não servem;
- Conseguir **receber SMS ou ligação** para o código de verificação;
- **Não estar em outra conta do WhatsApp** (WhatsApp comum ou outra conta da API). A exceção é a coexistência (Caminho A), que usa justamente o número que já está no app Business.

Tipos de número:

- **Celular (recomendado):** recebe o código por SMS ou ligação.
- **Fixo:** funciona, mas o código **tem que vir por ligação**, porque SMS em fixo não é recomendado. Desligue desvio de chamada e URA (menu "digite 1…") na hora da verificação.
- **0800 / número com URA:** dá para registrar, mas a ligação de verificação não passa pelo menu. É preciso que caia numa pessoa. Evite.
- **VoIP:** possível se o provedor aceitar SMS/ligações internacionais. Evite se puder.

Dica: deixe o número apto a **receber ligações e SMS internacionais**, porque o código pode vir de fora do Brasil.

---

## 3. O que a clínica precisa ter

### 3.1 Conta no Meta Business (portfólio empresarial)

- É o "cadastro da empresa" na Meta (antigo Business Manager, hoje "portfólio empresarial" no Meta Business Suite, em business.facebook.com).
- Precisa de uma pessoa da clínica com **conta pessoal no Facebook** para entrar e ser administradora.
- Se a clínica já anuncia no Instagram/Facebook, **provavelmente já tem um portfólio**. Use o mesmo. **(INFERIDO)**
- Os ativos do WhatsApp (número, conta) **ficam em nome da clínica**, não nosso. A clínica tem acesso total ao WhatsApp Manager, e ninguém pode restringir esse acesso.

### 3.2 Verificação do negócio (recomendada, não obrigatória para começar)

- Dá para **começar a usar sem verificação**.
- Portfólio **não verificado**: pode enviar mensagens que a clínica inicia (lembretes, avisos) para até **250 pacientes diferentes a cada 24h**. Não há limite para **responder** pacientes que escreveram primeiro, que é o caso do bot. **Com verificação**, o limite sobe para **2.000** e depois aumenta sozinho conforme o uso.
- Portfólio novo pode ter até **2 números**. Verificado, até **20**.
- O que a Meta pede: nome da empresa, endereço, telefone, e-mail e site, uma forma de confirmar o vínculo com a empresa (e-mail no domínio, telefone, SMS etc.) e, **se a empresa não for encontrada**, documentos.
- Para empresa brasileira, os documentos costumam ser **comprovante de inscrição do CNPJ**, contrato social ou conta de consumo no nome da empresa. **(INFERIDO: não conseguimos abrir a página de ajuda da Meta com a lista de documentos aceitos.)** Os dados precisam bater exatamente com o CNPJ (razão social, endereço).
- Ter um **site** e um **e-mail no domínio da clínica** (ex.: contato@clinicaexemplo.com.br) facilita a confirmação. **(INFERIDO)**

### 3.3 Nome de exibição

- É o nome que o paciente vê no perfil do WhatsApp. Ele é informado na hora de registrar o número.
- Ele passa por análise automática quando o número atinge limites maiores. Se for recusado, dá para editar e reenviar, ou recorrer.
- Regras práticas **(INFERIDO a partir das diretrizes de nome da Meta, que não conseguimos abrir na íntegra)**:
  - usar o **nome real da clínica**, igual ou parecido com o do CNPJ/fachada/site (ex.: "Clínica Sorriso Centro");
  - não usar só termos genéricos ("Dentista", "Clínica Odontológica");
  - não usar emoji, link, telefone ou palavras como "oficial" sem motivo;
  - usar maiúsculas normais (evitar "CLÍNICA SORRISO").
- Pode trocar até **10 vezes a cada 30 dias**. Cada troca passa por nova análise.

### 3.4 Perfil do WhatsApp Business

Preencha (por nós, pelo WhatsApp Manager ou, na coexistência, pelo próprio app):

- **Foto:** logotipo da clínica, quadrado e legível em tamanho pequeno;
- **Descrição/"sobre"**: especialidades, "atendimento automático 24h, com equipe em horário comercial";
- **Endereço** (texto livre, até 256 caracteres), **site**, **e-mail**;
- **Categoria:** saúde/medicina.
- O **horário de funcionamento** não aparece como campo na API oficial, então coloque na descrição. **(INFERIDO)**

### 3.5 Forma de pagamento na Meta

- A Meta cobra as mensagens **direto da clínica**, no cartão cadastrado na conta de WhatsApp (Billing Hub / WhatsApp Manager). Nós não temos linha de crédito com a Meta.
- **Sem forma de pagamento, a partir de 01/10/2026 a Meta para de entregar as respostas do bot** assim que a franquia grátis do mês (1.000 mensagens) acabar.
- Prefira criar a conta em **reais (BRL)**. Até 30/06/2027 toda conta de empresa brasileira precisa estar em BRL.
- Valores: ver `docs/produto/whatsapp-cloud-api-custos.md`.

---

## 4. Quem faz o quê

| A clínica entrega / faz | Nós fazemos |
|---|---|
| Escolhe o caminho (A, B ou C) e o número | Explicamos as consequências e confirmamos a escolha |
| Uma pessoa administradora do portfólio Meta, com Facebook, disponível por cerca de 20 minutos numa chamada | Enviamos o **link de conexão** (o "cadastro incorporado" do painel) e acompanhamos a chamada |
| Durante a conexão: celular com o app Business aberto (Caminho A) ou acesso ao chip para receber o código (Caminhos B e C) | Configuramos o painel, o bot, as mensagens automáticas e os webhooks |
| Nome de exibição, logo, descrição, endereço, site | Preenchemos o perfil se a clínica preferir |
| Cartão de crédito cadastrado na conta de WhatsApp da Meta | Mostramos onde cadastrar e acompanhamos o consumo |
| Documentos para a verificação do negócio (CNPJ etc.), se a Meta pedir | Orientamos o envio. Não enviamos documentos em nome da clínica. |
| Combinar com a recepção: usar o painel para assumir conversas e abrir o app a cada 14 dias | Treinamos a equipe no painel |

Como a conexão funciona: o painel tem um botão **"Conectar com WhatsApp Business"**. Ele abre uma janela da própria Meta onde a pessoa da clínica entra com o Facebook, escolhe ou cria o portfólio, informa o número, recebe o código e define o nome de exibição. No Caminho A, a Meta detecta que o número já está no app e manda uma mensagem da "conta oficial do Facebook Business" no WhatsApp da clínica. Nela, a pessoa toca em **Conectar**, confirma se quer compartilhar o histórico e cola o código. **A clínica não precisa nos passar senha nenhuma.**

> Para nós (equipe técnica): o botão de coexistência exige que o nosso app Meta seja **Tech Provider** (verificação do nosso negócio + App Review). Antes disso, dá para conectar no máximo 10 clínicas novas por semana. O Chatwoot self-hosted precisa de `WHATSAPP_APP_ID`, `WHATSAPP_CONFIGURATION_ID` e `WHATSAPP_APP_SECRET`. O código atual do Chatwoot trata o evento de coexistência e o webhook `smb_message_echoes`. Não use o "fluxo manual" do Chatwoot para um número que está no app Business: a própria documentação do Chatwoot manda usar Embedded Signup/Coexistência nesse caso.

---

## 5. Checklist final

**Antes da chamada de conexão**

- [ ] Caminho escolhido: A (coexistência), B (número novo) ou C (migrar tirando do app)
- [ ] App WhatsApp Business atualizado (versão 2.24.17 ou superior), no Caminho A
- [ ] Backup das conversas feito (sempre bom, obrigatório no Caminho C)
- [ ] Número recebe SMS ou ligação, inclusive internacional. Fixo: sem desvio nem URA.
- [ ] Número não está em outra conta de API nem banido
- [ ] Pessoa administradora do portfólio Meta com login do Facebook em mãos
- [ ] Nome de exibição decidido (nome real da clínica)
- [ ] Logo, descrição, endereço, site e e-mail prontos
- [ ] Cartão para cadastrar na Meta

**Depois da conexão**

- [ ] Cartão cadastrado na conta de WhatsApp (moeda BRL)
- [ ] Perfil preenchido
- [ ] Mensagem de teste enviada de um celular qualquer e respondida pelo bot
- [ ] Recepção treinada: assumir conversa pelo painel e não pelo celular
- [ ] Lembrete na agenda: abrir o app no celular principal pelo menos a cada 14 dias (Caminho A)
- [ ] Verificação do negócio iniciada (se a clínica for enviar lembretes a muitos pacientes)

---

## 6. Problemas comuns

| Problema | O que fazer |
|---|---|
| **"Número já está em uso"** | No Caminho A, use o botão de conexão com o app Business (coexistência). No B ou C, o número precisa ser apagado do WhatsApp antes. Leva até 3 minutos para ficar disponível. |
| **Código de verificação não chega** | Tente por ligação em vez de SMS. Libere recebimento internacional. Em fixo, desative desvio e URA. |
| **Número banido** | É preciso pedir revisão (recurso) ao WhatsApp antes de registrar. Enquanto isso, use um número novo. |
| **Nome de exibição recusado** | Ajuste para o nome real da clínica, sem termos genéricos, emojis ou maiúsculas exageradas, e reenvie. Também dá para recorrer pelo suporte. |
| **Verificação do negócio pendente ou recusada** | Confira se razão social, endereço e site batem exatamente com o CNPJ. Reenvie com o comprovante do CNPJ. O bot funciona enquanto isso, porque o limite só afeta mensagens que a clínica inicia. |
| **"Limite de 250"** | Só vale para mensagens **iniciadas pela clínica** (ex.: lembretes) para pacientes diferentes em 24h. Respostas a pacientes não têm esse limite. Para subir: verificar o negócio ou manter boa qualidade de envio. |
| **Bot parou de responder de repente (Caminho A)** | Provável desconexão: celular sem uso há cerca de 14 dias, WhatsApp reinstalado, troca de aparelho ou de número. Abra o app e aceite religar. Se não aparecer a opção, avise a gente. |
| **Paciente diz que recebeu duas respostas** | Alguém respondeu pelo celular enquanto o bot atendia. Assuma pelo painel. |
| **Bot parou de responder a partir de outubro** | Verifique se há cartão cadastrado na Meta. Sem cartão, as respostas param depois de 1.000 no mês. |
| **Mensagem de paciente não aparece no painel** | Ela pode ter vindo de um aparelho não compatível (ex.: WhatsApp para Windows) ou ser a primeira mensagem de um contato novo, que costuma se resolver em segundos. Confira no app do celular. |

---

## Fontes (acessadas em 26/09/2026)

- Meta for Developers, "Onboard WhatsApp Business app users" (coexistência, atualizada em 26/06/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users
- Meta for Developers, "Migrate an existing WhatsApp number to a business account" (16/06/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/migrate-existing-whatsapp-number-to-a-business-account
- Meta for Developers, "Business phone numbers" (21/05/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers
- Meta for Developers, "Display names" (16/06/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names
- Meta for Developers, "Business profiles" (30/06/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/business-profiles
- Meta for Developers, "Messaging Limits" (21/05/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits
- Meta for Developers, "Embedded Signup" (24/07/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview
- Meta for Developers, "Partners" (21/05/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview
- Meta for Developers, "Become a Tech Provider" (20/08/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers
- Meta for Developers, "Upcoming pricing updates for Meta Business Agent, service and utility messages" (25/08/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages
- Meta for Developers, "Pricing on the WhatsApp Business Platform" (10/09/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Meta for Developers, Changelog do WhatsApp (entradas de coexistência de mai–ago/2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog
- Meta Business Help Center, "Display name guidelines for the WhatsApp Business Platform" (não foi possível ler o conteúdo, só o título): https://www.facebook.com/business/help/757569725593362
- Meta Business Help Center, "Verificar sua empresa no Meta Business Suite" (não foi possível ler o conteúdo, só o título): https://www.facebook.com/business/help/2058515294227817
- Chatwoot, "How to setup a WhatsApp channel (Manual flow)": https://www.chatwoot.com/hc/user-guide/articles/1756799850-how-to-setup-a-whats_app-channel-manual-flow
- Chatwoot, "WhatsApp Embedded Signup" (self-hosted): https://developers.chatwoot.com/self-hosted/configuration/features/integrations/whatsapp-embedded-signup
- Chatwoot, código-fonte (tratamento de `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` e `smb_message_echoes`), consultado via GitHub em 26/09/2026: https://github.com/chatwoot/chatwoot
- Chatwoot, discussão #11216 sobre coexistência (fonte secundária para a lista de países, fev–mar/2026): https://github.com/orgs/chatwoot/discussions/11216
