# 💈 Barbearia Jardim Carapina — Sistema Inteligente

Sistema em tempo real para barbearia local com controle de fila ao vivo, estimativa de espera, gestão de promoções relâmpago, cardápio de serviços e integração direta com WhatsApp.

---

## 🚀 Como Executar o Projeto Localmente

1. **Instalar dependências (já executado):**
   ```bash
   npm install
   ```

2. **Iniciar o servidor:**
   ```bash
   npm start
   ```
   *(Ou para desenvolvimento com recarregamento automático: `npm run dev`)*

3. **Acessar as páginas:**
   - **📱 Tela Pública do Cliente (Fila ao vivo):** [http://localhost:3000](http://localhost:3000)
   - **🔒 Painel Administrativo do Barbeiro:** [http://localhost:3000/admin](http://localhost:3000/admin)
   - **🤖 Endpoint do Bot WhatsApp:** [http://localhost:3000/api/bot/summary](http://localhost:3000/api/bot/summary)

---

## 🔑 Credenciais Iniciais de Teste

- **Senha do Painel do Barbeiro:** `barbeiro123` *(configurável no arquivo `.env`)*

---

## 🧪 Como Rodar os Testes Automatizados

Para validar todas as 10 regras de negócio, proteções e sincronização:
```bash
npm test
```

---

## 🌐 Como Publicar na Internet com Custo Zero

Para que os clientes e os anúncios do Facebook acessem pelo celular de qualquer lugar:

1. **Render.com / Railway / Fly.io (Plano Gratuito / Baixo Custo):**
   - Conecte o repositório Git ao Render ou Railway.
   - Configure a variável `ADMIN_PASSWORD` e `JWT_SECRET`.
   - O projeto subirá automaticamente com HTTPS e WebSockets ativos.

2. **Configuração de Domínio ou Link Curto:**
   - Crie um link curto (ex: `barbeariajc.com.br` ou link gratuito do Render `barbearia-carapina.onrender.com`) para colocar na bio do Instagram e nos botões do anúncio.

---

## 📁 Estrutura do Projeto

```
barbearia/
├── data/
│   └── barbearia_data.json       # Persistência atômica da fila e configs
├── docs/
│   ├── WHATSAPP_INTEGRACAO.md    # Árvore de atendimento e conexão do bot
│   └── MARKETING_ADS_JARDIM_CARAPINA.md # Anúncios e segmentação no Meta Ads
├── public/
│   ├── index.html                # Tela pública da fila em tempo real
│   ├── admin.html                # Painel de controle do barbeiro
│   └── style.css                 # Design moderno mobile-first escuro
├── src/
│   └── db.js                     # Camada de banco de dados e validações
├── tests/
│   └── system.test.js            # Bateria completa de testes automatizados
├── server.js                     # Servidor Node.js + Express + WebSockets
├── .env                          # Variáveis de ambiente locais
├── .env.example                  # Modelo de variáveis de ambiente
└── package.json                  # Dependências e scripts
```
