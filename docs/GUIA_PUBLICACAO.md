# 🚀 GUIA DEFINITIVO DE PUBLICAÇÃO DO SISTEMA DA BARBEARIA
**Ambiente: Render.com (Web Service) + PostgreSQL (Supabase / Neon) • Custo R$ 0,00**

Este documento detalha o procedimento exato e as limitações técnicas para disponibilizar a aplicação em uma URL pública segura com persistência garantida.

---

## 1. Limitações Reais dos Planos Gratuitos (Transparência Obrigatória)

Antes de publicar, é fundamental conhecer as regras dos serviços gratuitos:

1. **Render.com (Free Web Service):**
   - **Hibernação por inatividade:** Se a barbearia ficar **15 minutos** sem nenhum visitante no site ou mensagem no bot, o servidor desliga temporariamente para economizar recursos.
   - **Primeiro acesso:** Quando o primeiro cliente entra após a hibernação, o servidor leva cerca de **30 a 50 segundos** para "acordar". Os acessos seguintes ficam rápidos e instantâneos.
   - **Disco Efêmero:** Qualquer arquivo salvo em pasta local é descartado ao reiniciar. **Por essa razão, conectamos o PostgreSQL externo para que a contagem da fila nunca seja zerada ou perdida.**
   - **Custo:** R$ 0,00.

2. **Supabase (Free Tier) ou Neon Tech (PostgreSQL Free):**
   - Oferece 500 MB a 1 GB de banco de dados gratuito (nosso sistema usa menos de 1 MB).
   - O Supabase pausa projetos inativos após 7 dias seguidos sem nenhuma requisição (em uma barbearia com acessos normais, isso não acontece).
   - **Custo:** R$ 0,00.

---

## 2. Passo a Passo de Configuração

### Passo 1: Obter a URL do PostgreSQL Gratuito (Supabase ou Neon)
*Opção recomendada: **Neon.tech** ou **Supabase.com** (ambos fornecem connection string PostgreSQL gratuita em 1 clique).*

1. Crie uma conta gratuita em [https://neon.tech](https://neon.tech) ou [https://supabase.com](https://supabase.com).
2. Crie um novo projeto (ex: `barbearia-db`).
3. Copie a **Connection String** no formato URI. Exemplo:
   `postgresql://usuario:senha@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require`
   *(Guarde essa string; ela será a sua variável `DATABASE_URL` no Render).*

> 💡 **Nota Técnica:** Você **NÃO** precisa rodar nenhum script SQL nem criar tabelas manualmente. O sistema da barbearia (`src/db.js`) detecta o banco vazio e cria a tabela `barbearia_state` e os dados iniciais automaticamente no primeiro boot.

---

### Passo 2: Criar Repositório no GitHub e Subir o Código
1. Abra o terminal na pasta do projeto e inicie o repositório git:
   ```bash
   git init
   git add .
   git commit -m "Sistema Barbearia Jardim Carapina - Pronto para Producao"
   git branch -M main
   ```
2. Crie um repositório no seu GitHub (pode ser **Privado** para total segurança do seu código).
3. Conecte e envie:
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```
   *(O arquivo `.gitignore` já protege `.env`, pastas de dados e módulos para que nenhum segredo seja exposto).*

---

### Passo 3: Criar o Web Service no Render.com
1. Acesse [https://render.com](https://render.com) e conecte sua conta do GitHub.
2. Clique em **"New +"** > **"Web Service"**.
3. Selecione o repositório que você acabou de subir.
4. Preencha as configurações:
   - **Name:** `barbearia-jardim-carapina`
   - **Region:** `Ohio (US East)` (ou mais próxima)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
5. Role até a seção **"Environment Variables"** e clique em **"Add Environment Variable"** para inserir as 4 chaves:
   - `NODE_ENV`: `production`
   - `ADMIN_PASSWORD`: *(defina a senha forte que o barbeiro usará no celular. NÃO use 'barbeiro123' senão o servidor recusa iniciar)*
   - `JWT_SECRET`: *(um texto longo aleatório com letras e números, ex: `98f7a6bc12d34e56a78b90c12e34`)*
   - `DATABASE_URL`: *(a connection string do PostgreSQL copiada no Passo 1)*
6. Clique em **"Deploy Web Service"**.

Em cerca de 2 minutos, o Render exibirá status **Live** e sua URL pública segura:
👉 `https://barbearia-jardim-carapina.onrender.com`

---

## 3. Roteiro Prático de Validação em Dois Celulares

Após o deploy, faça o teste real:

1. **No Celular do Barbeiro:**
   - Acesse: `https://seu-app.onrender.com/admin`
   - Digite a senha definida em `ADMIN_PASSWORD`.
   - Você verá o painel de botões grandes.
2. **No Celular do Cliente (ou de um amigo):**
   - Acesse: `https://seu-app.onrender.com`
   - Verifique o indicador verde piscando: **"Fila ao vivo"**.
3. **Teste de Fila:**
   - No celular do barbeiro, aperte **"+1 CLIENTE"** duas vezes.
   - No celular do cliente, sem tocar na tela, observe a fila mudar para **2 pessoas** e o tempo estimado atualizar para **~50 min**.
4. **Teste de Persistência (Banco de Dados):**
   - Feche todos os navegadores.
   - Aguarde 20 minutos (para que o Render hiberne) ou clique em "Manual Deploy > Clear build cache and deploy".
   - Abra a página novamente: os 2 clientes e todas as alterações continuam lá, comprovando que o PostgreSQL manteve o estado intacto!
