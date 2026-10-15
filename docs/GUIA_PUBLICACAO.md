# 📱 Guia de Publicação Online: Barbearia Kairos

Este guia contém o passo a passo exato para você colocar o sistema no ar em **menos de 5 minutos**, obter o link permanente com HTTPS e passar para os clientes e barbeiros usarem no celular.

---

## 1. Subir o Projeto no seu GitHub

O repositório Git local já foi inicializado e comitado na pasta do projeto. Para enviar ao GitHub:

1. Acesse [github.com/new](https://github.com/new) e crie um novo repositório (ex: `barbearia-kairos`).
2. Copie os comandos que o GitHub exibir e execute no seu terminal:
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/barbearia-kairos.git
   git branch -M main
   git push -u origin main
   ```

---

## 2. Publicar na Nuvem (Custo Zero com Render)

O projeto já possui o arquivo `render.yaml` 100% configurado para rodar Node.js + WebSockets ao vivo.

1. Acesse [render.com](https://render.com) e faça login com seu GitHub.
2. Clique em **"New +"** -> **"Web Service"**.
3. Selecione o repositório `barbearia-kairos`.
4. Em **Environment Variables**, adicione:
   - `NODE_ENV`: `production`
   - `ADMIN_PASSWORD`: *(defina a senha forte que os barbeiros usarão para controlar a fila)*
   - `JWT_SECRET`: *(qualquer palavra ou código secreto aleatório)*
5. Clique em **"Create Web Service"**.
6. Em ~2 minutos, o Render fornecerá seu link seguro com cadeado HTTPS, por exemplo:
   👉 `https://barbearia-kairos.onrender.com`

---

## 3. Como os Barbeiros e Clientes usam no Telefone

### 📲 Para os Clientes (Fila ao vivo & Preços):
- **Link Direto:** `https://barbearia-kairos.onrender.com`
- O cliente clica no link e já vê na hora:
  - Quantas pessoas estão na fila agora.
  - Tempo estimado de espera (ex: ~25 min).
  - Tabela de preços e serviços.
  - Botão de WhatsApp direto da barbearia.
- **Instalar como App no Celular:**
  - **Android:** Ao abrir no Chrome, aparece o aviso ou basta clicar nos `3 pontinhos` -> **"Instalar aplicativo"** / **"Adicionar à tela inicial"**. Ficará com o ícone dourado da Kairos como se fosse baixado da Play Store!
  - **iPhone (iOS):** No Safari, clicar no botão **Compartilhar** (quadrado com seta para cima) -> **"Adicionar à Tela de Início"**.

### 💈 Para os Barbeiros (Painel de Gestão da Fila):
- **Link do Painel:** `https://barbearia-kairos.onrender.com/admin`
- O barbeiro digita a senha configurada e pode:
  - Clicar em **+1 Cliente** ou **-1 Cliente** com um toque.
  - Pausar/abrir a barbearia.
  - Ligar promoções relâmpago que avisam todos os clientes conectados instantaneamente.
