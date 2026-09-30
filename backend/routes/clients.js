const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { deleteClientPhotoFiles } = require("./photos");

const router = express.Router();

// las visitas se cruzan con la caja por nombre (sin distinguir mayusculas)
const SELECT_CLIENTS = `
  SELECT c.id, c.name, c.phone, c.service, c.notes, c.birthday,
    (SELECT MAX(e.date) FROM entries e WHERE LOWER(TRIM(e.name)) = LOWER(TRIM(c.name))) AS lastVisit,
    (SELECT COUNT(*) FROM entries e WHERE LOWER(TRIM(e.name)) = LOWER(TRIM(c.name))) AS visits,
    (SELECT COALESCE(SUM(e.amount), 0) FROM entries e WHERE LOWER(TRIM(e.name)) = LOWER(TRIM(c.name))) AS totalSpent,
    (SELECT MIN(a.date) FROM appointments a
      WHERE a.client_id = c.id AND a.date >= ? AND a.entry_id IS NULL) AS nextAppointment,
    (SELECT json_group_array(json_object('id', p.id, 'file', p.filename, 'createdAt', p.created_at))
      FROM (SELECT * FROM client_photos WHERE client_id = c.id ORDER BY created_at DESC) p) AS photos
  FROM clients c
`;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const toJson = (row) => row && { ...row, photos: JSON.parse(row.photos || "[]") };
const getOne = (id) => toJson(db.prepare(`${SELECT_CLIENTS} WHERE c.id = ?`).get(today(), id));

const clean = (body) => {
  const birthday = String(body.birthday || "").trim();
  return {
    name: String(body.name || "").trim(),
    phone: String(body.phone || "").trim(),
    service: String(body.service || "").trim(),
    notes: String(body.notes || "").trim(),
    // formato MM-DD, sin año
    birthday: /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(birthday) ? birthday : "",
  };
};

// GET /api/clients
router.get("/", (_req, res) => {
  res.json(db.prepare(`${SELECT_CLIENTS} ORDER BY c.name COLLATE NOCASE ASC`).all(today()).map(toJson));
});

// POST /api/clients
router.post("/", (req, res) => {
  const c = clean(req.body);
  if (!c.name) return res.status(400).json({ error: "El nombre es obligatorio" });
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO clients (id, name, phone, service, notes, birthday) VALUES (?, ?, ?, ?, ?, ?)").run(
    id, c.name, c.phone, c.service, c.notes, c.birthday
  );
  res.status(201).json(getOne(id));
});

// PUT /api/clients/:id
router.put("/:id", (req, res) => {
  const c = clean(req.body);
  if (!c.name) return res.status(400).json({ error: "El nombre es obligatorio" });
  const info = db
    .prepare("UPDATE clients SET name = ?, phone = ?, service = ?, notes = ?, birthday = ? WHERE id = ?")
    .run(c.name, c.phone, c.service, c.notes, c.birthday, req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Clienta no encontrada" });
  res.json(getOne(req.params.id));
});

// DELETE /api/clients/:id  (borra tambien sus turnos y fotos)
router.delete("/:id", (req, res) => {
  deleteClientPhotoFiles(req.params.id);
  db.prepare("DELETE FROM clients WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
