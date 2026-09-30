const express = require("express");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

const SELECT_APPOINTMENTS = `
  SELECT a.id, a.client_id AS clientId, a.date, a.time, a.service, a.deposit,
    a.reminded_at AS remindedAt, a.entry_id IS NOT NULL AS done,
    c.name, c.phone
  FROM appointments a JOIN clients c ON c.id = a.client_id
`;

const toJson = (row) => row && { ...row, done: !!row.done };

// GET /api/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", (req, res) => {
  const from = req.query.from || "0000-00-00";
  const to = req.query.to || "9999-99-99";
  res.json(
    db
      .prepare(`${SELECT_APPOINTMENTS} WHERE a.date BETWEEN ? AND ? ORDER BY a.date ASC, a.time ASC`)
      .all(from, to)
      .map(toJson)
  );
});

// POST /api/appointments
router.post("/", (req, res) => {
  const { clientId, date, time, service, deposit } = req.body;
  if (!clientId || !date) return res.status(400).json({ error: "Falta la clienta o la fecha" });
  if (!db.prepare("SELECT 1 FROM clients WHERE id = ?").get(clientId)) {
    return res.status(404).json({ error: "Clienta no encontrada" });
  }
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO appointments (id, client_id, date, time, service, deposit) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, clientId, date, time || "", service || "", Math.max(0, Number(deposit) || 0));
  res.status(201).json(toJson(db.prepare(`${SELECT_APPOINTMENTS} WHERE a.id = ?`).get(id)));
});

// PUT /api/appointments/:id
router.put("/:id", (req, res) => {
  const { clientId, date, time, service, deposit } = req.body;
  if (!clientId || !date) return res.status(400).json({ error: "Falta la clienta o la fecha" });
  const info = db
    .prepare("UPDATE appointments SET client_id = ?, date = ?, time = ?, service = ?, deposit = ? WHERE id = ?")
    .run(clientId, date, time || "", service || "", Math.max(0, Number(deposit) || 0), req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Turno no encontrado" });
  res.json(toJson(db.prepare(`${SELECT_APPOINTMENTS} WHERE a.id = ?`).get(req.params.id)));
});

// POST /api/appointments/:id/reminded  -> marca que ya se mando el recordatorio
router.post("/:id/reminded", (req, res) => {
  db.prepare("UPDATE appointments SET reminded_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json(toJson(db.prepare(`${SELECT_APPOINTMENTS} WHERE a.id = ?`).get(req.params.id)));
});

// DELETE /api/appointments/:id
router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM appointments WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
