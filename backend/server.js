const express = require("express");
const cors = require("cors");

const entriesRouter = require("./routes/entries");
const configRouter = require("./routes/config");
const summaryRouter = require("./routes/summary");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/entries", entriesRouter);
app.use("/api/config", configRouter);
app.use("/api/summary", summaryRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Control Unas API corriendo en http://localhost:${PORT}`);
});
