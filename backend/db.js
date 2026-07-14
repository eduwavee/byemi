const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

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
`);

// migracion: si la base ya existia de una version anterior sin estas columnas, las agrega
const existingCols = db.prepare("PRAGMA table_info(entries)").all().map((c) => c.name);
if (!existingCols.includes("service_type")) {
  db.exec("ALTER TABLE entries ADD COLUMN service_type TEXT NOT NULL DEFAULT ''");
}
if (!existingCols.includes("extras")) {
  db.exec("ALTER TABLE entries ADD COLUMN extras TEXT NOT NULL DEFAULT '[]'");
}

// default split config if not set
const existing = db.prepare("SELECT value FROM config WHERE key = ?").get("split");
if (!existing) {
  db.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run(
    "split",
    JSON.stringify({
      insumos: 30,
      ganancia: 50,
      otroLabel: "Meta: Televisor",
      otro: 20,
      otroGoal: 0,
      otroGoalSince: null,
    })
  );
} else {
  // migracion: configs de una version anterior sin los campos de meta
  const parsed = JSON.parse(existing.value);
  if (parsed.otroGoal === undefined || parsed.otroGoalSince === undefined) {
    const migrated = { otroGoal: 0, otroGoalSince: null, ...parsed };
    db.prepare("UPDATE config SET value = ? WHERE key = ?").run(JSON.stringify(migrated), "split");
  }
}

module.exports = db;
