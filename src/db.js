const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = process.env.DATA_FILE 
  ? path.resolve(__dirname, '..', process.env.DATA_FILE) 
  : path.join(DATA_DIR, 'barbearia_data.json');

const DEFAULT_DATA = {
  queueCount: 0,
  avgTimePerClient: 25, // minutos por cliente
  isOpen: true,
  statusMessage: "Aberto e atendendo por ordem de chegada!",
  shopInfo: {
    name: "Barbearia Estilo & Arte",
    address: "Avenida Castro Alves, Jardim Carapina, Serra - ES",
    referencePoint: "Próximo à praça principal",
    googleMapsUrl: "https://www.google.com/maps/place/20%C2%B014'07.4%22S+40%C2%B017'09.5%22W/@-20.2353818,-40.2860516,7a,75y,158.98h,84.71t/data=!3m7!1e1!3m5!1sAQryWNzkTnjf6yXTV2Pkzw!2e0!6shttps:%2F%2Fstreetviewpixels-pa.clients6.google.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D5.292723189622194%26panoid%3DAQryWNzkTnjf6yXTV2Pkzw%26yaw%3D158.9810955420652!7i16384!8i8192!4m4!3m3!8m2!3d-20.2353866!4d-40.2859768?entry=ttu&g_ep=EgoyMDI2MTAwNi4wIKXMDSoASAFQAw%3D%3D",
    whatsappNumber: "5527999999999",
    businessHours: "Seg a Sáb: 09:00 às 19:30 | Dom: Fechado"
  },
  services: [
    { id: 1, name: "Corte Tradicional / Degradê", price: 30, duration: 25 },
    { id: 2, name: "Barba Terapia / Alinhamento", price: 20, duration: 20 },
    { id: 3, name: "Combo Cabelo + Barba", price: 45, duration: 40 },
    { id: 4, name: "Sobrancelha na navalha", price: 10, duration: 10 },
    { id: 5, name: "Platinado / Pigmentação", price: 60, duration: 50 }
  ],
  promotion: {
    isActive: false,
    title: "Promoção Relâmpago de Terça & Quarta",
    description: "Corte + Barba com R$ 10 de desconto entre 13h e 16h!",
    conditions: "Válido enquanto a fila estiver abaixo de 3 pessoas."
  },
  lastUpdated: new Date().toISOString()
};

let memoryCache = null;
let pgPool = null;

function getPgPool() {
  if (!pgPool && process.env.DATABASE_URL) {
    const isLocal = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isLocal ? false : { rejectUnauthorized: false }
    });
  }
  return pgPool;
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const tmpFile = `${DATA_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DATA_FILE);
  }
}

// Inicializador assíncrono para o banco (cria tabela e garante integridade)
async function initDb(customPool = null) {
  const pool = customPool || getPgPool();
  if (pool) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS barbearia_state (
          id INT PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const res = await pool.query('SELECT data FROM barbearia_state WHERE id = 1');
      if (res.rows.length === 0) {
        const initial = getLocalData();
        await pool.query('INSERT INTO barbearia_state (id, data) VALUES (1, $1)', [initial]);
        memoryCache = initial;
      } else {
        memoryCache = res.rows[0].data;
      }
      return true;
    } catch (err) {
      console.error('⚠️ Falha ao conectar no PostgreSQL, usando JSON local como fallback:', err.message);
    }
  }

  memoryCache = getLocalData();
  return false;
}

function getLocalData() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("Erro ao ler banco JSON local:", err.message);
    return DEFAULT_DATA;
  }
}

function saveLocalData(data) {
  ensureDataFile();
  data.lastUpdated = new Date().toISOString();
  const tmpFile = `${DATA_FILE}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DATA_FILE);
  return data;
}

function getData() {
  if (!memoryCache) {
    memoryCache = getLocalData();
  }
  return memoryCache;
}

function saveData(data, customPool = null) {
  data.lastUpdated = new Date().toISOString();
  memoryCache = data;
  
  saveLocalData(data);

  const pool = customPool || getPgPool();
  if (pool) {
    pool.query(
      `INSERT INTO barbearia_state (id, data, updated_at) 
       VALUES (1, $1, CURRENT_TIMESTAMP) 
       ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = CURRENT_TIMESTAMP`,
      [data]
    ).catch(err => {
      console.error('Erro ao sincronizar com PostgreSQL:', err.message);
    });
  }

  return data;
}

async function closeDb() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}

module.exports = {
  initDb,
  getData,
  saveData,
  closeDb,
  getPgPool,
  DEFAULT_DATA,
  DATA_FILE
};
