require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { WebSocketServer } = require('ws');
const { initDb, getData, saveData } = require('./src/db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'chave_segredo_padrao_barbearia';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'barbeiro123';

// Em produção, recusa iniciar se a senha padrão não for alterada
if (process.env.NODE_ENV === 'production') {
  if (ADMIN_PASSWORD === 'barbeiro123' || ADMIN_PASSWORD === 'admin123') {
    console.error('❌ ERRO FATAL: Em produção, você DEVE definir uma senha forte na variável ADMIN_PASSWORD.');
    process.exit(1);
  }
}

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Broadcast para todos os clientes conectados via WebSocket
function broadcastUpdate(data) {
  const payload = JSON.stringify({
    type: 'UPDATE',
    data: getPublicData(data)
  });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  });
}

// Filtro de dados públicos (sem expor credenciais)
function getPublicData(data) {
  const current = data || getData();
  const barbers = (current.barbers && current.barbers.length > 0) ? current.barbers : [
    { id: 'joao', name: 'João', queueCount: 0, isOpen: true },
    { id: 'juninho', name: 'Juninho', queueCount: 0, isOpen: true }
  ];
  const queueCount = barbers.reduce((acc, b) => acc + (Number(b.queueCount) || 0), 0);
  const avgTime = Number(current.avgTimePerClient) || 40;
  const estimatedWaitMinutes = Math.max(...barbers.map(b => (Number(b.queueCount) || 0) * avgTime), 0);

  return {
    shopInfo: current.shopInfo,
    queueCount,
    barbers: barbers.map(b => ({
      id: b.id,
      name: b.name,
      queueCount: Number(b.queueCount) || 0,
      isOpen: b.isOpen !== false,
      estimatedWaitMinutes: (Number(b.queueCount) || 0) * avgTime
    })),
    avgTimePerClient: avgTime,
    estimatedWaitMinutes,
    isOpen: current.isOpen,
    statusMessage: current.statusMessage,
    services: current.services,
    promotion: current.promotion,
    lastUpdated: current.lastUpdated
  };
}

// Middleware de autenticação JWT
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido ou expirado.' });
  }
}

// ================= ROTAS PÚBLICAS =================

// 1. Dados públicos da barbearia e fila
app.get('/api/public/status', (req, res) => {
  res.json(getPublicData());
});

// 2. Endpoint exclusivo e direto para BOTs (WhatsApp / Typebot / Z-API / etc)
app.get('/api/bot/summary', (req, res) => {
  const current = getData();
  const queueCount = Number(current.queueCount) || 0;
  const avgTime = Number(current.avgTimePerClient) || 25;
  const waitTime = queueCount * avgTime;

  let promoText = "Nenhuma promoção ativa no momento.";
  if (current.promotion && current.promotion.isActive) {
    promoText = `🔥 *${current.promotion.title}*\n${current.promotion.description}\n_Regra: ${current.promotion.conditions}_`;
  }

  res.json({
    shop_name: current.shopInfo.name,
    queue_count: queueCount,
    estimated_wait_minutes: waitTime,
    is_open: current.isOpen,
    status_text: current.isOpen ? "Aberto" : "Fechado",
    address: current.shopInfo.address,
    reference: current.shopInfo.referencePoint,
    maps_link: current.shopInfo.googleMapsUrl,
    whatsapp: current.shopInfo.whatsappNumber,
    business_hours: current.shopInfo.businessHours,
    promotion_active: !!current.promotion?.isActive,
    promotion_details: promoText,
    whatsapp_message_formatted: 
      `💈 *${current.shopInfo.name}* (Jardim Carapina)\n\n` +
      `👥 *Fila Atual:* ${queueCount} ${queueCount === 1 ? 'pessoa' : 'pessoas'} aguardando\n` +
      `⏱️ *Tempo Estimado:* ~${waitTime} minutos\n` +
      `📍 *Endereço:* ${current.shopInfo.address} (${current.shopInfo.referencePoint})\n\n` +
      (current.promotion?.isActive ? `🎁 *Promoção Ativa:*\n${current.promotion.title}\n\n` : '') +
      `Como posso te ajudar hoje? Digite o número da opção:`
  });
});

// 3. Login administrativo (gera token com expiração de 24h)
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Informe a senha.' });
  }

  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, message: 'Autenticado com sucesso' });
  } else {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }
});

// ================= ROTAS ADMINISTRATIVAS PROTEGIDAS =================

// Obter todos os dados incluindo configs completas
app.get('/api/admin/data', authMiddleware, (req, res) => {
  res.json(getData());
});

// Alterações rápidas na fila (+1, -1, zerar ou definir valor)
app.post('/api/admin/queue', authMiddleware, (req, res) => {
  const { action, value, barberId } = req.body;
  const current = getData();

  if (!current.barbers || current.barbers.length === 0) {
    current.barbers = [
      { id: 'joao', name: 'João', queueCount: 0, isOpen: true },
      { id: 'juninho', name: 'Juninho', queueCount: 0, isOpen: true }
    ];
  }

  let target = current.barbers.find(b => b.id === barberId);
  if (target) {
    if (action === 'increment') {
      target.queueCount = (Number(target.queueCount) || 0) + 1;
    } else if (action === 'decrement' || action === 'next') {
      target.queueCount = Math.max(0, (Number(target.queueCount) || 0) - 1);
    } else if (action === 'set') {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 0) target.queueCount = num;
    } else if (action === 'toggle_status') {
      target.isOpen = !target.isOpen;
    }
  } else {
    if (action === 'increment') {
      current.barbers[0].queueCount += 1;
    } else if (action === 'decrement' || action === 'next') {
      if (current.barbers[0].queueCount > 0) current.barbers[0].queueCount -= 1;
    } else if (action === 'reset_all') {
      current.barbers.forEach(b => b.queueCount = 0);
    }
  }

  current.queueCount = current.barbers.reduce((acc, b) => acc + (Number(b.queueCount) || 0), 0);
  saveData(current);
  broadcastUpdate(current);
  res.json({ success: true, barbers: current.barbers, queueCount: current.queueCount, data: getPublicData(current) });
});

// Configurar tempo médio de atendimento e status da loja
app.post('/api/admin/settings', authMiddleware, (req, res) => {
  const { avgTimePerClient, isOpen, statusMessage } = req.body;
  const current = getData();

  if (avgTimePerClient !== undefined) {
    const time = parseInt(avgTimePerClient, 10);
    if (isNaN(time) || time <= 0) {
      return res.status(400).json({ error: 'Tempo médio deve ser maior que 0 minutos.' });
    }
    current.avgTimePerClient = time;
  }

  if (isOpen !== undefined) {
    current.isOpen = Boolean(isOpen);
  }

  if (statusMessage !== undefined) {
    current.statusMessage = String(statusMessage).trim();
  }

  saveData(current);
  broadcastUpdate(current);
  res.json({ success: true, data: getPublicData(current) });
});

// Configurar promoção ativa
app.post('/api/admin/promotion', authMiddleware, (req, res) => {
  const { isActive, title, description, conditions } = req.body;
  const current = getData();

  current.promotion = {
    isActive: Boolean(isActive),
    title: title !== undefined ? String(title).trim() : current.promotion.title,
    description: description !== undefined ? String(description).trim() : current.promotion.description,
    conditions: conditions !== undefined ? String(conditions).trim() : current.promotion.conditions
  };

  saveData(current);
  broadcastUpdate(current);
  res.json({ success: true, promotion: current.promotion });
});

// Configurar informações comerciais (endereço, mapa, whatsapp, horários)
app.post('/api/admin/shop-info', authMiddleware, (req, res) => {
  const { name, address, referencePoint, googleMapsUrl, whatsappNumber, businessHours } = req.body;
  const current = getData();

  if (name) current.shopInfo.name = String(name).trim();
  if (address) current.shopInfo.address = String(address).trim();
  if (referencePoint !== undefined) current.shopInfo.referencePoint = String(referencePoint).trim();
  if (googleMapsUrl) current.shopInfo.googleMapsUrl = String(googleMapsUrl).trim();
  if (whatsappNumber) current.shopInfo.whatsappNumber = String(whatsappNumber).trim().replace(/\D/g, '');
  if (businessHours) current.shopInfo.businessHours = String(businessHours).trim();

  saveData(current);
  broadcastUpdate(current);
  res.json({ success: true, shopInfo: current.shopInfo });
});

// Configurar serviços e preços
app.post('/api/admin/services', authMiddleware, (req, res) => {
  const { services } = req.body;
  if (!Array.isArray(services)) {
    return res.status(400).json({ error: 'Serviços deve ser uma lista.' });
  }

  const current = getData();
  current.services = services.map((s, index) => ({
    id: s.id || index + 1,
    name: String(s.name || '').trim(),
    price: Number(s.price) || 0,
    duration: Number(s.duration) || 20
  }));

  saveData(current);
  broadcastUpdate(current);
  res.json({ success: true, services: current.services });
});

// Tratamento de conexões WebSocket - apenas leitura/broadcast
// Bloqueia qualquer tentativa de comando de escrita via WebSocket não autenticado
wss.on('connection', (ws) => {
  // Envia estado atual imediatamente ao conectar
  ws.send(JSON.stringify({
    type: 'INITIAL_STATE',
    data: getPublicData()
  }));

  // O WebSocket é exclusivamente de transmissão (push unidirecional).
  // Mensagens recebidas do cliente são ignoradas para evitar qualquer desvio das rotas REST autenticadas.
  ws.on('message', () => {
    // No-op seguro
  });

  ws.on('error', (err) => {
    console.error('WebSocket erro:', err.message);
  });
});

// Roteamento SPA simples para páginas públicas e admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicia servidor se chamado diretamente
if (require.main === module) {
  initDb().then(() => {
    server.listen(PORT, () => {
      console.log(`💈 Barbearia Sistema rodando em http://localhost:${PORT}`);
      console.log(`📱 Painel do Barbeiro: http://localhost:${PORT}/admin`);
      console.log(`👥 Página da Fila ao Vivo: http://localhost:${PORT}/`);
    });
  });
}

module.exports = { app, server, wss, broadcastUpdate, getPublicData };
