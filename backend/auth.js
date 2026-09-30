const express = require("express");
const crypto = require("crypto");
const db = require("./db");

const { getConfig, setConfig } = db;
const MIN_LENGTH = 4;

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function checkPassword(password) {
  const auth = getConfig("auth");
  if (!auth) return false;
  const hash = crypto.scryptSync(String(password || ""), auth.salt, 64);
  return crypto.timingSafeEqual(hash, Buffer.from(auth.hash, "hex"));
}

function newSession() {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token_hash) VALUES (?)").run(sha256(token));
  return token;
}

function isValidToken(token) {
  if (!token) return false;
  return !!db.prepare("SELECT 1 FROM sessions WHERE token_hash = ?").get(sha256(token));
}

const tokenFrom = (req) => {
  const header = req.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
};

// la clave inicial puede venir de la variable de entorno APP_PASSWORD
if (!getConfig("auth") && process.env.APP_PASSWORD) {
  setConfig("auth", hashPassword(process.env.APP_PASSWORD));
}

// freno simple contra probar claves a lo loco: 10 intentos fallidos cada 15 min por IP
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
function tooManyAttempts(ip) {
  const a = attempts.get(ip);
  if (!a || Date.now() > a.until) return false;
  return a.count >= 10;
}
function registerFailure(ip) {
  const a = attempts.get(ip);
  if (!a || Date.now() > a.until) attempts.set(ip, { count: 1, until: Date.now() + WINDOW_MS });
  else a.count += 1;
}

// middleware: todo /api pide sesion, salvo las rutas publicas de auth
function requireAuth(req, res, next) {
  // las fotos se cargan con <img>, que no puede mandar headers
  const token = tokenFrom(req) || (req.path.startsWith("/photos/file/") ? req.query.t : "");
  if (isValidToken(token)) return next();
  res.status(401).json({ error: "Sesión vencida. Volvé a entrar." });
}

const router = express.Router();

// GET /api/auth/status
router.get("/status", (req, res) => {
  res.json({ configured: !!getConfig("auth"), valid: isValidToken(tokenFrom(req)) });
});

// POST /api/auth/setup  -> crear la clave la primera vez
router.post("/setup", (req, res) => {
  if (getConfig("auth")) return res.status(409).json({ error: "La clave ya está creada." });
  const password = String(req.body.password || "");
  if (password.length < MIN_LENGTH) {
    return res.status(400).json({ error: `La clave tiene que tener al menos ${MIN_LENGTH} caracteres.` });
  }
  setConfig("auth", hashPassword(password));
  res.json({ token: newSession() });
});

// POST /api/auth/login
router.post("/login", (req, res) => {
  if (tooManyAttempts(req.ip)) {
    return res.status(429).json({ error: "Demasiados intentos. Probá de nuevo en unos minutos." });
  }
  if (!checkPassword(req.body.password)) {
    registerFailure(req.ip);
    return res.status(401).json({ error: "Clave incorrecta." });
  }
  attempts.delete(req.ip);
  res.json({ token: newSession() });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  const token = tokenFrom(req);
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
  res.status(204).end();
});

// POST /api/auth/change  -> cambia la clave y cierra las demas sesiones
router.post("/change", requireAuth, (req, res) => {
  const { current, next } = req.body;
  if (!checkPassword(current)) return res.status(401).json({ error: "La clave actual no es correcta." });
  if (String(next || "").length < MIN_LENGTH) {
    return res.status(400).json({ error: `La clave nueva tiene que tener al menos ${MIN_LENGTH} caracteres.` });
  }
  setConfig("auth", hashPassword(String(next)));
  db.prepare("DELETE FROM sessions").run();
  res.json({ token: newSession() });
});

module.exports = { router, requireAuth };
