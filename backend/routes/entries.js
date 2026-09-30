const express = require("express");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

// GET /api/entries/:date  -> lista de clientas cargadas ese dia
router.get("/:date", (req, res) => {
  const { date } = req.params;
  const rows = db
    .prepare(
      "SELECT id, name, amount, time, service_type, extras FROM entries WHERE date = ? ORDER BY created_at ASC"
    )
    .all(date);
  res.json(
    rows.map((r) => ({
      ...r,
      serviceType: r.service_type,
      extras: JSON.parse(r.extras || "[]"),
      service_type: undefined,
    }))
  );
});

// GET /api/entries-dates  -> lista de fechas que tienen al menos una carga
router.get("/", (_req, res) => {
  const rows = db
    .prepare("SELECT DISTINCT date FROM entries ORDER BY date DESC")
    .all();
  res.json(rows.map((r) => r.date));
});

// POST /api/entries/:date  -> agrega una clienta
router.post("/:date", (req, res) => {
  const { date } = req.params;
  const { name, amount, time, serviceType, extras, appointmentId } = req.body;

  const parsedAmount = Number(amount);
  if (!parsedAmount || parsedAmount <= 0) {
    return res.status(400).json({ error: "Monto invalido" });
  }

  const finalName = (name || "Clienta").trim() || "Clienta";
  const finalServiceType = serviceType || "";
  const finalExtras = Array.isArray(extras) ? extras : [];

  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO entries (id, date, name, amount, time, service_type, extras) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, date, finalName, parsedAmount, time || "", finalServiceType, JSON.stringify(finalExtras));

  // si viene de un turno ("Vino"), lo marca como atendido
  if (appointmentId) {
    db.prepare("UPDATE appointments SET entry_id = ? WHERE id = ?").run(id, appointmentId);
  }

  res.status(201).json({
    id,
    name: finalName,
    amount: parsedAmount,
    time,
    serviceType: finalServiceType,
    extras: finalExtras,
  });
});

// DELETE /api/entries/id/:id
router.delete("/id/:id", (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM entries WHERE id = ?").run(id);
  // el turno vuelve a quedar pendiente si se borra su cobro
  db.prepare("UPDATE appointments SET entry_id = NULL WHERE entry_id = ?").run(id);
  res.status(204).end();
});

module.exports = router;
