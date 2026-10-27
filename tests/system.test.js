const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { app, server, wss } = require('../server');
const WebSocket = require('ws');
const { DATA_FILE, initDb, getData, saveData, closeDb } = require('../src/db');

const TEST_PORT = 3099;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Iniciando bateria de testes do sistema da barbearia (JSON e PostgreSQL)...');
  
  let passedCount = 0;
  let failedCount = 0;
  const originalBackup = fs.existsSync(DATA_FILE) ? fs.readFileSync(DATA_FILE, 'utf-8') : null;

  function markPassed(name, engine) {
    passedCount++;
    console.log(`✅ [Passou] [Motor: ${engine}] ${name}`);
  }

  function markFailed(name, err) {
    failedCount++;
    console.error(`❌ [Falhou] ${name}:`, err.message);
  }

  // Inicializa servidor de teste
  await initDb();
  await new Promise(r => server.listen(TEST_PORT, r));
  console.log(`📡 Servidor de teste escutando na porta ${TEST_PORT}`);

  try {
    // 1. Endpoint público
    try {
      const publicStatus = await request('GET', '/api/public/status');
      assert.strictEqual(publicStatus.status, 200);
      assert(typeof publicStatus.data.queueCount === 'number');
      assert(publicStatus.data.shopInfo);
      assert.strictEqual(publicStatus.data.token, undefined);
      assert.strictEqual(publicStatus.data.password, undefined);
      markPassed('Teste 1: Endpoint público operacional e seguro contra vazamento', 'JSON');
    } catch (e) { markFailed('Teste 1', e); }

    // 2. Proteção contra alteração sem token
    try {
      const unauthChange = await request('POST', '/api/admin/queue', { action: 'increment' });
      assert.strictEqual(unauthChange.status, 401);
      markPassed('Teste 2: Bloqueio de operações não autenticadas (HTTP 401)', 'Segurança');
    } catch (e) { markFailed('Teste 2', e); }

    // 3. Login e Expiração do JWT
    let token = null;
    try {
      const wrongLogin = await request('POST', '/api/admin/login', { password: 'senha_incorreta' });
      assert.strictEqual(wrongLogin.status, 401);

      const validLogin = await request('POST', '/api/admin/login', { password: process.env.ADMIN_PASSWORD || 'barbeiro123' });
      assert.strictEqual(validLogin.status, 200);
      assert(validLogin.data.token);
      token = validLogin.data.token;

      const decoded = jwt.decode(token);
      assert(decoded.exp, 'JWT deve ter tempo de expiração (exp)');
      const remainingHours = (decoded.exp - decoded.iat) / 3600;
      assert(remainingHours <= 24, 'JWT deve expirar em 24h');
      markPassed('Teste 3: Autenticação administrativa com JWT e tempo de expiração válido', 'Segurança');
    } catch (e) { markFailed('Teste 3', e); }

    // 4. Incremento (+1 cliente)
    try {
      await request('POST', '/api/admin/queue', { action: 'set', value: 2 }, token);
      const incRes = await request('POST', '/api/admin/queue', { action: 'increment' }, token);
      assert.strictEqual(incRes.status, 200);
      assert.strictEqual(incRes.data.queueCount, 3);
      markPassed('Teste 4: Incremento de cliente na fila (+1)', 'JSON');
    } catch (e) { markFailed('Teste 4', e); }

    // 5. Decremento (-1 cliente)
    try {
      const decRes = await request('POST', '/api/admin/queue', { action: 'decrement' }, token);
      assert.strictEqual(decRes.status, 200);
      assert.strictEqual(decRes.data.queueCount, 2);
      markPassed('Teste 5: Decremento de cliente na fila (-1)', 'JSON');
    } catch (e) { markFailed('Teste 5', e); }

    // 6. Proteção contra contagem negativa
    try {
      await request('POST', '/api/admin/queue', { action: 'set', value: 0 }, token);
      const subZeroRes = await request('POST', '/api/admin/queue', { action: 'decrement' }, token);
      assert.strictEqual(subZeroRes.data.queueCount, 0);
      markPassed('Teste 6: Proteção contra valores negativos', 'Regra de Negócio');
    } catch (e) { markFailed('Teste 6', e); }

    // 7. Estimativa de tempo
    try {
      await request('POST', '/api/admin/settings', { avgTimePerClient: 20 }, token);
      await request('POST', '/api/admin/queue', { action: 'set', value: 4 }, token);
      const checkCalc = await request('GET', '/api/public/status');
      assert.strictEqual(checkCalc.data.queueCount, 4);
      assert.strictEqual(checkCalc.data.avgTimePerClient, 20);
      assert.strictEqual(checkCalc.data.estimatedWaitMinutes, 80);
      markPassed('Teste 7: Cálculo de tempo de espera dinâmico', 'Regra de Negócio');
    } catch (e) { markFailed('Teste 7', e); }

    // 8. Gestão de Promoções
    try {
      await request('POST', '/api/admin/promotion', {
        isActive: true,
        title: "Corte Promocional Terça",
        description: "R$ 5 de desconto",
        conditions: "Até 16h"
      }, token);
      const checkPromo = await request('GET', '/api/public/status');
      assert.strictEqual(checkPromo.data.promotion.isActive, true);
      assert.strictEqual(checkPromo.data.promotion.title, "Corte Promocional Terça");
      markPassed('Teste 8: Ativação e persistência de promoção', 'JSON');
    } catch (e) { markFailed('Teste 8', e); }

    // 9. Endpoint exclusivo para Bot WhatsApp
    try {
      const botSummary = await request('GET', '/api/bot/summary');
      assert.strictEqual(botSummary.status, 200);
      assert.strictEqual(botSummary.data.queue_count, 4);
      assert.strictEqual(botSummary.data.estimated_wait_minutes, 80);
      assert(botSummary.data.whatsapp_message_formatted.includes('Jardim Carapina'));
      assert.strictEqual(botSummary.data.JWT_SECRET, undefined);
      assert.strictEqual(botSummary.data.admin_password, undefined);
      markPassed('Teste 9: Endpoint público /api/bot/summary seguro e formatado', 'API');
    } catch (e) { markFailed('Teste 9', e); }

    // 10. Atualização em tempo real via WebSocket
    try {
      await new Promise((resolve, reject) => {
        const wsClient = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
        let initialReceived = false;

        wsClient.on('message', (msgStr) => {
          const msg = JSON.parse(msgStr);
          if (msg.type === 'INITIAL_STATE') {
            initialReceived = true;
            request('POST', '/api/admin/queue', { action: 'set', value: 7 }, token).catch(reject);
          } else if (msg.type === 'UPDATE') {
            assert(initialReceived);
            assert.strictEqual(msg.data.queueCount, 7);
            wsClient.close();
            resolve();
          }
        });
        wsClient.on('error', reject);
      });
      markPassed('Teste 10: WebSocket push em tempo real consistente', 'WebSocket');
    } catch (e) { markFailed('Teste 10', e); }

    // 11. Teste de Edição Dinâmica de Preços e Serviços sem mexer em código
    try {
      const updatedServices = [
        { id: 1, name: "Corte Navalhado VIP", price: 35, duration: 30 },
        { id: 2, name: "Barba Completa", price: 25, duration: 20 }
      ];
      const srvRes = await request('POST', '/api/admin/services', { services: updatedServices }, token);
      assert.strictEqual(srvRes.status, 200);
      assert.strictEqual(srvRes.data.services.length, 2);
      assert.strictEqual(srvRes.data.services[0].price, 35);

      const pubCheck = await request('GET', '/api/public/status');
      assert.strictEqual(pubCheck.data.services[0].name, "Corte Navalhado VIP");
      markPassed('Teste 11: Gerenciamento dinâmico de serviços e preços', 'JSON');
    } catch (e) { markFailed('Teste 11', e); }

    // 12. Teste de Persistência Atômica no Disco (Simulação de reinício)
    try {
      const dbContent = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      assert.strictEqual(dbContent.queueCount, 7);
      assert.strictEqual(dbContent.services[0].name, "Corte Navalhado VIP");
      markPassed('Teste 12: Integridade e persistência dos dados no arquivo JSON', 'JSON');
    } catch (e) { markFailed('Teste 12', e); }

    // 13. Teste de Validação da Camada PostgreSQL / Mock Driver (Garante SQL parametrizado e DDL)
    try {
      let createdTable = false;
      let insertedInitial = false;
      let updatedState = false;

      const mockPgPool = {
        query: async (sql, params) => {
          if (sql.includes('CREATE TABLE IF NOT EXISTS barbearia_state')) {
            createdTable = true;
            return { rows: [] };
          }
          if (sql.includes('SELECT data FROM barbearia_state WHERE id = 1')) {
            return { rows: [] }; // Simula banco recém-criado
          }
          if (sql.includes('INSERT INTO barbearia_state (id, data) VALUES (1, $1)')) {
            insertedInitial = true;
            assert(params[0].queueCount !== undefined, 'Query de inicialização deve receber estado inicial parametrizado');
            return { rows: [] };
          }
          if (sql.includes('ON CONFLICT (id) DO UPDATE SET data = $1')) {
            updatedState = true;
            assert.strictEqual(params[0].queueCount, 9, 'Query de atualização deve ser parametrizada com o novo estado');
            return { rows: [] };
          }
          return { rows: [] };
        }
      };

      // Executa inicialização no Postgres simulado
      const initSuccess = await initDb(mockPgPool);
      assert.strictEqual(initSuccess, true, 'initDb deve reportar sucesso no pool');
      assert.strictEqual(createdTable, true, 'Deve executar DDL da tabela no Postgres');
      assert.strictEqual(insertedInitial, true, 'Deve popular estado inicial no Postgres');

      // Executa escrita simulada no Postgres
      saveData({ ...getData(), queueCount: 9 }, mockPgPool);
      assert.strictEqual(updatedState, true, 'saveData deve disparar UPSERT parametrizado no Postgres');

      markPassed('Teste 13: Camada PostgreSQL (DDL de tabelas, consultas parametrizadas e upsert)', 'PostgreSQL');
    } catch (e) { markFailed('Teste 13', e); }

  } catch (err) {
    console.error('Erro crítico no executor de testes:', err);
  } finally {
    if (originalBackup) {
      fs.writeFileSync(DATA_FILE, originalBackup, 'utf-8');
    }
    await closeDb();
    wss.close();
    server.close();
  }

  console.log('\n=======================================');
  console.log(`TOTAL DE TESTES APROVADOS: ${passedCount}`);
  console.log(`TOTAL DE TESTES REPROVADOS: ${failedCount}`);
  console.log('=======================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
