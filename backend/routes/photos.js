const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("../db");

const router = express.Router();
const FILE_RE = /^[0-9a-f-]{36}\.jpg$/;

const filePath = (filename) => path.join(db.photosDir, filename);

// borra del disco las fotos de una clienta (se llama antes de borrarla)
function deleteClientPhotoFiles(clientId) {
  const rows = db.prepare("SELECT filename FROM client_photos WHERE client_id = ?").all(clientId);
  for (const r of rows) fs.rm(filePath(r.filename), { force: true }, () => {});
}

// POST /api/photos  { clientId, dataUrl }  -> la imagen ya viene achicada desde el celu
router.post("/", (req, res) => {
  const { clientId, dataUrl } = req.body;
  if (!db.prepare("SELECT 1 FROM clients WHERE id = ?").get(clientId)) {
    return res.status(404).json({ error: "Clienta no encontrada" });
  }
  const match = /^data:image\/jpeg;base64,(.+)$/.exec(dataUrl || "");
  if (!match) return res.status(400).json({ error: "Formato de imagen no soportado" });

  const id = crypto.randomUUID();
  const filename = `${id}.jpg`;
  fs.writeFileSync(filePath(filename), Buffer.from(match[1], "base64"));
  db.prepare("INSERT INTO client_photos (id, client_id, filename) VALUES (?, ?, ?)").run(id, clientId, filename);
  res.status(201).json({ id, file: filename, createdAt: new Date().toISOString() });
});

// GET /api/photos/file/:filename
router.get("/file/:filename", (req, res) => {
  const { filename } = req.params;
  if (!FILE_RE.test(filename) || !fs.existsSync(filePath(filename))) return res.status(404).end();
  res.set("Cache-Control", "private, max-age=31536000, immutable");
  res.sendFile(filePath(filename));
});

// DELETE /api/photos/:id
router.delete("/:id", (req, res) => {
  const row = db.prepare("SELECT filename FROM client_photos WHERE id = ?").get(req.params.id);
  if (row) {
    db.prepare("DELETE FROM client_photos WHERE id = ?").run(req.params.id);
    fs.rm(filePath(row.filename), { force: true }, () => {});
  }
  res.status(204).end();
});

module.exports = router;
module.exports.deleteClientPhotoFiles = deleteClientPhotoFiles;
