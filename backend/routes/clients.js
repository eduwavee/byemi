const express = require("express");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

// las visitas se cruzan con la caja por nombre (sin distinguir mayusculas)
const SELECT_CLIENTS = `
  SELECT c.id, c.name, c.phone, c.service, c.notes,
    (SELECT MAX(e.date) FROM entries e WHERE LOWER(TRIM(e.name)) = LOWER(TRIM(c.name))) AS lastVisit,
    (SELECT COUNT(*) FROM entries e WHERE LOWER(TRIM(e.name)) = LOWER(TRIM(c.name))) AS visits,
    (SELECT MIN(a.date) FROM appointments a WHERE a.client_id = c.id AND a.date >= ?) AS nextAppointment
  FROM clients c
`;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const clean = (body) => ({
  name: String(body.name || "").trim(),
  phone: String(body.phone || "").trim(),
  service: String(body.service || "").trim(),
  notes: String(body.notes || "").trim(),
});

// GET /api/clients
router.get("/", (_req, res) => {
  res.json(db.prepare(`${SELECT_CLIENTS} ORDER BY c.name COLLATE NOCASE ASC`).all(today()));
});

// POST /api/clients
router.post("/", (req, res) => {
  const c = clean(req.body);
  if (!c.name) return res.status(400).json({ error: "El nombre es obligatorio" });
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO clients (id, name, phone, service, notes) VALUES (?, ?, ?, ?, ?)").run(
    id, c.name, c.phone, c.service, c.notes
  );
  res.status(201).json(db.prepare(`${SELECT_CLIENTS} WHERE c.id = ?`).get(today(), id));
});

// PUT /api/clients/:id
router.put("/:id", (req, res) => {
  const c = clean(req.body);
  if (!c.name) return res.status(400).json({ error: "El nombre es obligatorio" });
  const info = db
    .prepare("UPDATE clients SET name = ?, phone = ?, service = ?, notes = ? WHERE id = ?")
    .run(c.name, c.phone, c.service, c.notes, req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Clienta no encontrada" });
  res.json(db.prepare(`${SELECT_CLIENTS} WHERE c.id = ?`).get(today(), req.params.id));
});

// DELETE /api/clients/:id  (borra tambien sus turnos)
router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM clients WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
