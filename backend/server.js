const express = require("express");
const cors = require("cors");

const auth = require("./auth");
const entriesRouter = require("./routes/entries");
const configRouter = require("./routes/config");
const summaryRouter = require("./routes/summary");
const clientsRouter = require("./routes/clients");
const appointmentsRouter = require("./routes/appointments");
const expensesRouter = require("./routes/expenses");
const photosRouter = require("./routes/photos");
const exportRouter = require("./routes/export");

const app = express();
const PORT = process.env.PORT || 3001;

// detras del proxy del hosting, para que el freno de intentos vea la IP real
app.set("trust proxy", 1);

app.use(cors());
// las fotos llegan en base64 dentro del JSON
app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", auth.router);

app.use("/api", auth.requireAuth);
app.use("/api/entries", entriesRouter);
app.use("/api/config", configRouter);
app.use("/api/summary", summaryRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/photos", photosRouter);
app.use("/api/export", exportRouter);

app.listen(PORT, () => {
  console.log(`Control Unas API corriendo en http://localhost:${PORT}`);
});
