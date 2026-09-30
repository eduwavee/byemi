const express = require("express");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

// GET /api/expenses/:date
router.get("/:date", (req, res) => {
  res.json(
    db
      .prepare("SELECT id, description, amount FROM expenses WHERE date = ? ORDER BY created_at ASC")
      .all(req.params.date)
  );
});

// POST /api/expenses/:date
router.post("/:date", (req, res) => {
  const description = String(req.body.description || "").trim() || "Gasto";
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: "Monto invalido" });
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO expenses (id, date, description, amount) VALUES (?, ?, ?, ?)").run(
    id, req.params.date, description, amount
  );
  res.status(201).json({ id, description, amount });
});

// DELETE /api/expenses/id/:id
router.delete("/id/:id", (req, res) => {
  db.prepare("DELETE FROM expenses WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
