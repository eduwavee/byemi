const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const photosDir = path.join(dataDir, "photos");
if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });

const db = new Database(path.join(dataDir, "control-unas.db"));

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    time TEXT NOT NULL,
    service_type TEXT NOT NULL DEFAULT '',
    extras TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    service TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    birthday TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    time TEXT NOT NULL DEFAULT '',
    service TEXT NOT NULL DEFAULT '',
    deposit REAL NOT NULL DEFAULT 0,
    entry_id TEXT,
    reminded_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

  CREATE TABLE IF NOT EXISTS client_photos (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.pragma("foreign_keys = ON");

// migracion: agrega columnas nuevas a bases creadas por versiones anteriores
function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumnIfMissing("entries", "service_type", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("entries", "extras", "TEXT NOT NULL DEFAULT '[]'");
addColumnIfMissing("clients", "birthday", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("appointments", "deposit", "REAL NOT NULL DEFAULT 0");
addColumnIfMissing("appointments", "entry_id", "TEXT");

// ---------- config ----------

function getConfig(key) {
  const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key);
  return row ? JSON.parse(row.value) : null;
}

function setConfig(key, value) {
  db.prepare(
    "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, JSON.stringify(value));
  return value;
}

// completa una config con los valores por defecto que le falten
function ensureConfig(key, defaults) {
  const current = getConfig(key);
  if (!current) return setConfig(key, defaults);
  const missing = Object.keys(defaults).some((k) => current[k] === undefined);
  return missing ? setConfig(key, { ...defaults, ...current }) : current;
}

ensureConfig("split", {
  insumos: 30,
  ganancia: 50,
  otroLabel: "Meta: Televisor",
  otro: 20,
  otroGoal: 0,
  otroGoalSince: null,
});

ensureConfig("reminders", {
  turno:
    "¡Hola {nombre}! 💅 Te recuerdo tu turno de {servicio} el {dia} a las {hora}. ¡Te espero! Si no podés venir avisame así libero el horario 🌸",
  service:
    "¡Hola {nombre}! 💖 Ya pasaron {semanas} semanas desde tu último service. ¿Querés que te reserve un turno para esta semana?",
  cumple:
    "¡Feliz cumple {nombre}! 🎂💅 Te regalo un 10% de descuento en tu próximo service de este mes. ¡Que lo disfrutes mucho!",
  serviceDays: 21,
});

// precios en 0 = no autocompletar el monto
ensureConfig("catalog", {
  services: [
    { name: "Kapping", price: 0, duration: 90 },
    { name: "Softgel", price: 0, duration: 90 },
    { name: "Esculpidas", price: 0, duration: 120 },
    { name: "Esculpidas Híbridas", price: 0, duration: 120 },
  ],
  extras: [
    { name: "Largo L/XL", price: 0 },
    { name: "Extensión de uñas", price: 0 },
    { name: "Remoción colega", price: 0 },
  ],
});

// daysOff: 0 = domingo ... 6 = sabado
ensureConfig("agenda", { start: "09:00", end: "19:00", daysOff: [0] });

module.exports = db;
module.exports.getConfig = getConfig;
module.exports.setConfig = setConfig;
module.exports.photosDir = photosDir;
