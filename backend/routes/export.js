const express = require("express");
const db = require("../db");

const router = express.Router();

// cada export: consulta + columnas (clave -> titulo en la planilla)
const TABLES = {
  ingresos: {
    sql: "SELECT date, time, name, service_type, extras, amount FROM entries ORDER BY date, created_at",
    columns: { date: "Fecha", time: "Hora", name: "Clienta", service_type: "Servicio", extras: "Extras", amount: "Monto" },
    map: (r) => ({ ...r, extras: JSON.parse(r.extras || "[]").join(", ") }),
  },
  gastos: {
    sql: "SELECT date, description, amount FROM expenses ORDER BY date, created_at",
    columns: { date: "Fecha", description: "Detalle", amount: "Monto" },
  },
  clientas: {
    sql: "SELECT name, phone, service, birthday, notes, created_at FROM clients ORDER BY name COLLATE NOCASE",
    columns: { name: "Nombre", phone: "WhatsApp", service: "Servicio habitual", birthday: "Cumpleaños (MM-DD)", notes: "Notas", created_at: "Alta" },
  },
  turnos: {
    sql: `SELECT a.date, a.time, c.name, a.service, a.deposit, a.entry_id IS NOT NULL AS done
          FROM appointments a JOIN clients c ON c.id = a.client_id ORDER BY a.date, a.time`,
    columns: { date: "Fecha", time: "Hora", name: "Clienta", service: "Servicio", deposit: "Seña", done: "Vino" },
    map: (r) => ({ ...r, done: r.done ? "Sí" : "No" }),
  },
};

// Excel en español usa ";" como separador. El BOM hace que respete los acentos.
const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// GET /api/export/:table.csv
router.get("/:table.csv", (req, res) => {
  const t = TABLES[req.params.table];
  if (!t) return res.status(404).json({ error: "No existe ese listado" });
  const rows = db.prepare(t.sql).all().map(t.map || ((r) => r));
  const keys = Object.keys(t.columns);
  const lines = [
    keys.map((k) => csvCell(t.columns[k])).join(";"),
    ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(";")),
  ];
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="byemi-${req.params.table}.csv"`);
  res.send("﻿" + lines.join("\r\n"));
});

// GET /api/export/backup.json  -> copia completa (sin la clave ni las fotos)
router.get("/backup.json", (_req, res) => {
  const backup = {
    exportedAt: new Date().toISOString(),
    entries: db.prepare("SELECT * FROM entries").all(),
    expenses: db.prepare("SELECT * FROM expenses").all(),
    clients: db.prepare("SELECT * FROM clients").all(),
    appointments: db.prepare("SELECT * FROM appointments").all(),
    photos: db.prepare("SELECT * FROM client_photos").all(),
    config: Object.fromEntries(
      db
        .prepare("SELECT key, value FROM config WHERE key != 'auth'")
        .all()
        .map((r) => [r.key, JSON.parse(r.value)])
    ),
  };
  res.set("Content-Disposition", 'attachment; filename="byemi-backup.json"');
  res.json(backup);
});

module.exports = router;
