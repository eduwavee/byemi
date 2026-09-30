const express = require("express");
const db = require("../db");

const router = express.Router();

const toDateObj = (str) => {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// semana de lunes a domingo, que contiene la fecha dada
function getWeekRange(dateStr) {
  const d = toDateObj(dateStr);
  const day = d.getDay(); // 0 = domingo ... 6 = sabado
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toStr(monday), end: toStr(sunday) };
}

// mes calendario que contiene la fecha dada
function getMonthRange(dateStr) {
  const d = toDateObj(dateStr);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: toStr(first), end: toStr(last) };
}

// dado un rango, calcula el rango equivalente inmediatamente anterior
function getPreviousRange(range, start) {
  if (range === "week") {
    const monday = toDateObj(start);
    const prevMonday = new Date(monday);
    prevMonday.setDate(monday.getDate() - 7);
    return getWeekRange(toStr(prevMonday));
  }
  const first = toDateObj(start);
  const prevMonth = new Date(first.getFullYear(), first.getMonth() - 1, 1);
  return getMonthRange(toStr(prevMonth));
}

function getTotalForRange(start, end) {
  const row = db
    .prepare("SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM entries WHERE date BETWEEN ? AND ?")
    .get(start, end);
  return row;
}

function buildSummary(start, end) {
  const days = db
    .prepare(
      "SELECT date, SUM(amount) as total, COUNT(*) as count FROM entries WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date ASC"
    )
    .all(start, end);

  const serviceBreakdown = db
    .prepare(
      `SELECT service_type, COUNT(*) as count, SUM(amount) as total
       FROM entries WHERE date BETWEEN ? AND ? AND service_type != ''
       GROUP BY service_type ORDER BY total DESC`
    )
    .all(start, end);

  const total = days.reduce((s, r) => s + r.total, 0);
  const count = days.reduce((s, r) => s + r.count, 0);

  const expensesTotal = db
    .prepare("SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date BETWEEN ? AND ?")
    .get(start, end).total;

  return { start, end, total, count, days, serviceBreakdown, expensesTotal };
}

// GET /api/summary/week/:date
router.get("/week/:date", (req, res) => {
  const { start, end } = getWeekRange(req.params.date);
  const summary = buildSummary(start, end);
  const prevRange = getPreviousRange("week", start);
  summary.previous = { ...prevRange, ...getTotalForRange(prevRange.start, prevRange.end) };
  res.json(summary);
});

// GET /api/summary/month/:date
router.get("/month/:date", (req, res) => {
  const { start, end } = getMonthRange(req.params.date);
  const summary = buildSummary(start, end);
  const prevRange = getPreviousRange("month", start);
  summary.previous = { ...prevRange, ...getTotalForRange(prevRange.start, prevRange.end) };
  res.json(summary);
});

// GET /api/summary/alltime?since=YYYY-MM-DD  -> total historico (o desde una fecha), para la barra de la meta
router.get("/alltime", (req, res) => {
  const { since } = req.query;
  const row = since
    ? db
        .prepare("SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM entries WHERE date >= ?")
        .get(since)
    : db.prepare("SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM entries").get();
  res.json(row);
});

module.exports = router;
