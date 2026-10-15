# GUIA COMPLETO DE INTEGRAÇÃO DO WHATSAPP & BOT INTELIGENTE
**Barbearia Jardim Carapina - Serra/ES**

Este documento detalha o funcionamento técnico da automação de atendimento via WhatsApp, custos reais, modelos de mensagens e como conectar com plataformas externas sem risco de bloqueio.

---

## 1. Como Funciona a Integração com os Dados Reais

O sistema da barbearia disponibiliza dois canais diretos para consulta do bot:

- **Endpoint de Resumo Geral:** `GET /api/bot/summary`
- **Endpoint de Status Público:** `GET /api/public/status`

### Exemplo de Resposta do Endpoint `/api/bot/summary`:
```json
{
  "shop_name": "Barbearia Estilo & Arte",
  "queue_count": 2,
  "estimated_wait_minutes": 50,
  "is_open": true,
  "status_text": "Aberto",
  "address": "Rua Principal, Jardim Carapina, Serra - ES",
  "reference": "Próximo à praça principal",
  "maps_link": "https://maps.google.com/?q=Jardim+Carapina+Serra+ES",
  "whatsapp": "5527999999999",
  "business_hours": "Seg a Sáb: 09:00 às 19:30 | Dom: Fechado",
  "promotion_active": true,
  "promotion_details": "🔥 *Promoção Relâmpago de Terça*\nCorte + Barba com desconto\n_Regra: Válido hoje_",
  "whatsapp_message_formatted": "..."
}
```

O bot **nunca inventa números**: toda vez que o cliente digita "2" ou pergunta pela fila, a automação faz um HTTP GET nessa rota e devolve os valores exatos configurados pelo barbeiro.

---

## 2. Fluxo do Menu Interativo (Árvore de Atendimento)

### Mensagem de Boas-Vindas (Gatilho inicial quando o cliente clica no anúncio):
> "Fala parceiro! 💈 Seja bem-vindo à *Barbearia [Nome]* aqui em Jardim Carapina!
> 
> Como posso te ajudar agora? Digite o número da opção desejada:
> 
> 1️⃣ 📍 *Como Chegar / Localização*
> 2️⃣ 👥 *Ver Fila de Espera Agora*
> 3️⃣ ✂️ *Tabela de Preços e Serviços*
> 4️⃣ 🎁 *Promoção Ativa do Dia*
> 5️⃣ 💬 *Falar com o Barbeiro / Outro assunto*"

---

### Resposta Opção 1: 📍 Localização
> "Estamos localizados no coração de Jardim Carapina! 🏠
> 
> 📍 *Endereço:* {{data.address}}
> 🧭 *Ponto de referência:* {{data.reference}}
> 🕒 *Horário:* {{data.business_hours}}
> 
> 🗺️ *Clique no link para abrir o GPS:*
> {{data.maps_link}}
> 
> Digite *0* para voltar ao menu inicial."

---

### Resposta Opção 2: 👥 Fila de Espera (Dados Ao Vivo)
> "💈 *Status da Fila Agora:*
> 
> 👥 *Pessoas aguardando:* {{data.queue_count}} cliente(s)
> ⏱️ *Tempo estimado de espera:* ~{{data.estimated_wait_minutes}} minutos
> 
> 💡 *Dica:* Se a fila estiver baixa, aproveite para vir agora e cortar sem esperar!
> 
> Digite *0* para voltar ao menu."

---

### Resposta Opção 3: ✂️ Preços e Serviços
> "Confira nossa tabela de serviços:
> 
> ✂️ *Corte Tradicional / Degradê:* R$ 30,00
> 🧔 *Barba Terapia / Alinhamento:* R$ 20,00
> 💈 *Combo Cabelo + Barba:* R$ 45,00
> ✨ *Sobrancelha na navalha:* R$ 10,00
> 🎨 *Platinado / Pigmentação:* R$ 60,00
> 
> Atendemos por ordem de chegada ou horário marcado.
> Digite *0* para voltar ao menu."

---

### Resposta Opção 4: 🎁 Promoção Ativa
*(Se `promotion_active == true`)*:
> "{{data.promotion_details}}
> 
> Chegue na loja e informe que viu a promoção no WhatsApp para garantir o valor promocional!"

*(Se `promotion_active == false`)*:
> "No momento estamos sem promoções relâmpago ativas, mas nossos combos continuam com valor especial! Digite *3* para ver os preços."

---

### Resposta Opção 5: 💬 Falar com o Barbeiro
> "Perfeito! Já avisei o barbeiro. Enquanto ele finaliza o atendimento atual, pode deixar sua mensagem ou dúvida aqui que ele responde em instantes! 💈"

---

## 3. Opções de Implementação e Custos Reais

Para ligar esse menu no WhatsApp real existem 3 caminhos:

### Opção A: WhatsApp Business Oficial (Meta Cloud API + Typebot / Chatwoot) — **Mais Seguro**
- **Como funciona:** Usa a API oficial da Meta (Facebook). Zero risco de banimento de chip.
- **Custos:**
  - Primeiras 1.000 conversas por mês iniciadas por clientes: **GRÁTIS**.
  - Servidor da aplicação / Typebot: pode rodar em VPS de R$ 25 a R$ 30/mês (ou na nuvem gratuita).
- **Pré-requisitos:** Conta no Meta Business Suite, número de celular exclusivo e verificação básica da empresa.

### Opção B: Evolution API / Z-API com Webhook HTTP (Custo Quase Zero)
- **Como funciona:** Escaneia o QR Code do WhatsApp Web em um micro-servidor Node.js e envia as mensagens automaticamente.
- **Vantagem:** Muito fácil de rodar no mesmo servidor do sistema.
- **Risco:** Solução não oficial (se disparar spam em massa pode sofrer restrição temporária; para responder clientes que chamam organicamente o risco é muito baixo).

### Opção C: Atalho Inicial Imediato (Sem Bot Externo — Custo R$ 0)
- O sistema já gera links dinâmicos no formato:
  `https://wa.me/5527999999999?text=Ol%C3%A1!%20Vi%20a%20fila%20da%20barbearia%20e%20gostaria%20de%20tirar%20uma%20d%C3%BAvida`
- No próprio aplicativo do **WhatsApp Business gratuito no celular**, você configura as **Respostas Rápidas** (atalhos `/fila`, `/preco`, `/local`) enquanto a infraestrutura do bot oficial é ativada.
