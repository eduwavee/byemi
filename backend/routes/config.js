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
  res.json(db.getConfig("reminders"));
});

// PUT /api/config/reminders
router.put("/reminders", (req, res) => {
  const { turno, service, cumple, serviceDays } = req.body;
  const days = Number(serviceDays);
  if (!turno || !service || !cumple || !days || days < 1) {
    return res.status(400).json({ error: "Completá los mensajes y los días" });
  }
  res.json(
    db.setConfig("reminders", {
      turno: String(turno),
      service: String(service),
      cumple: String(cumple),
      serviceDays: days,
    })
  );
});

// GET /api/config/catalog  -> servicios y extras con precio y duracion
router.get("/catalog", (_req, res) => {
  res.json(db.getConfig("catalog"));
});

// PUT /api/config/catalog
router.put("/catalog", (req, res) => {
  const cleanList = (list, withDuration) =>
    (Array.isArray(list) ? list : [])
      .map((item) => ({
        name: String(item.name || "").trim(),
        price: Math.max(0, Number(item.price) || 0),
        ...(withDuration ? { duration: Math.max(15, Number(item.duration) || 60) } : {}),
      }))
      .filter((item) => item.name);

  const services = cleanList(req.body.services, true);
  const extras = cleanList(req.body.extras, false);
  if (services.length === 0) return res.status(400).json({ error: "Tiene que haber al menos un servicio" });
  const names = services.map((s) => s.name.toLowerCase());
  if (new Set(names).size !== names.length) {
    return res.status(400).json({ error: "Hay servicios con el mismo nombre" });
  }
  res.json(db.setConfig("catalog", { services, extras }));
});

// GET /api/config/agenda  -> horario de trabajo
router.get("/agenda", (_req, res) => {
  res.json(db.getConfig("agenda"));
});

// PUT /api/config/agenda
router.put("/agenda", (req, res) => {
  const { start, end, daysOff } = req.body;
  const validTime = (t) => /^\d{2}:\d{2}$/.test(t || "");
  if (!validTime(start) || !validTime(end) || start >= end) {
    return res.status(400).json({ error: "Revisá el horario: la entrada tiene que ser antes que la salida" });
  }
  const days = (Array.isArray(daysOff) ? daysOff : [])
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  res.json(db.setConfig("agenda", { start, end, daysOff: [...new Set(days)] }));
});

module.exports = router;
