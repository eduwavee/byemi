const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /api/config/split
router.get("/split", (_req, res) => {
  const row = db.prepare("SELECT value FROM config WHERE key = ?").get("split");
  res.json(JSON.parse(row.value));
});

// PUT /api/config/split
router.put("/split", (req, res) => {
  const { insumos, ganancia, otro, otroLabel, otroGoal, otroGoalSince } = req.body;
  const total = Number(insumos) + Number(ganancia) + Number(otro);

  if (total !== 100) {
    return res.status(400).json({ error: "Los porcentajes deben sumar 100" });
  }

  const current = JSON.parse(db.prepare("SELECT value FROM config WHERE key = ?").get("split").value);

  const value = JSON.stringify({
    insumos: Number(insumos),
    ganancia: Number(ganancia),
    otro: Number(otro),
    otroLabel: otroLabel || "Otro",
    otroGoal: otroGoal !== undefined ? Number(otroGoal) || 0 : current.otroGoal || 0,
    otroGoalSince: otroGoalSince !== undefined ? otroGoalSince : current.otroGoalSince || null,
  });

  db.prepare("UPDATE config SET value = ? WHERE key = ?").run(value, "split");
  res.json(JSON.parse(value));
});

// POST /api/config/split/reset-goal -> reinicia el progreso de la meta desde hoy
router.post("/split/reset-goal", (req, res) => {
  const current = JSON.parse(db.prepare("SELECT value FROM config WHERE key = ?").get("split").value);
  const today = new Date();
  const since = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
  const value = JSON.stringify({ ...current, otroGoalSince: since });
  db.prepare("UPDATE config SET value = ? WHERE key = ?").run(value, "split");
  res.json(JSON.parse(value));
});

// GET /api/config/reminders
router.get("/reminders", (_req, res) => {
  const row = db.prepare("SELECT value FROM config WHERE key = ?").get("reminders");
  res.json(JSON.parse(row.value));
});

// PUT /api/config/reminders
router.put("/reminders", (req, res) => {
  const { turno, service, serviceDays } = req.body;
  const days = Number(serviceDays);
  if (!turno || !service || !days || days < 1) {
    return res.status(400).json({ error: "Completá los dos mensajes y los días" });
  }
  const value = JSON.stringify({ turno: String(turno), service: String(service), serviceDays: days });
  db.prepare("UPDATE config SET value = ? WHERE key = ?").run(value, "reminders");
  res.json(JSON.parse(value));
});

module.exports = router;
