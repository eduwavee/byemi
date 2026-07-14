import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "./api";
import "./styles.css";

// ---------- helpers ----------
const toLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const fmtMoney = (n) => "$" + Math.round(n || 0).toLocaleString("es-AR");
const fmtDateLabel = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const DEFAULT_SPLIT = {
  insumos: 30,
  ganancia: 50,
  otroLabel: "Meta: Televisor",
  otro: 20,
  otroGoal: 0,
  otroGoalSince: null,
};

const SERVICE_TYPES = ["Kapping", "Softgel", "Esculpidas", "Esculpidas Híbridas"];
const EXTRAS_OPTIONS = ["Largo L/XL", "Extensión de uñas", "Remoción colega"];

export default function App() {
  const [today] = useState(() => toLocalDateStr(new Date()));
  const [currentDate, setCurrentDate] = useState(() => toLocalDateStr(new Date()));
  const [entries, setEntries] = useState([]);
  const [split, setSplit] = useState(DEFAULT_SPLIT);
  const [splitDraft, setSplitDraft] = useState(DEFAULT_SPLIT);
  const [datesIndex, setDatesIndex] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [extras, setExtras] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryRange, setSummaryRange] = useState("week");
  const [summaryAnchor, setSummaryAnchor] = useState(currentDate);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [goalTotal, setGoalTotal] = useState(0);
  const [toast, setToast] = useState(null);
  const [offline, setOffline] = useState(false);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const loadDay = useCallback(async (date) => {
    setLoading(true);
    try {
      const list = await api.getEntries(date);
      setEntries(list);
      setOffline(false);
    } catch (err) {
      setOffline(true);
      flash("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGoalProgress = useCallback(async (since) => {
    try {
      const res = await api.getAllTime(since || undefined);
      setGoalTotal(res.total);
    } catch {
      // silencioso: no rompe el resto de la app si esto falla
    }
  }, []);

  // initial load
  useEffect(() => {
    (async () => {
      try {
        const [dates, cfg] = await Promise.all([api.getDates(), api.getSplit()]);
        setDatesIndex(dates);
        setSplit(cfg);
        setSplitDraft(cfg);
        setOffline(false);
        loadGoalProgress(cfg.otroGoalSince);
      } catch {
        setOffline(true);
      }
      loadDay(currentDate);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDay(currentDate);
  }, [currentDate, loadDay]);

  const total = useMemo(
    () => entries.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [entries]
  );

  const toggleExtra = (opt) => {
    setExtras((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]));
  };

  const addEntry = async (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      flash("Poné un monto válido.");
      return;
    }
    if (!serviceType) {
      flash("Elegí el tipo de servicio.");
      return;
    }
    const time = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    try {
      const created = await api.addEntry(currentDate, {
        name: name.trim(),
        amount: val,
        time,
        serviceType,
        extras,
      });
      setEntries((prev) => [...prev, created]);
      setName("");
      setAmount("");
      setServiceType("");
      setExtras([]);
      if (!datesIndex.includes(currentDate)) {
        setDatesIndex((prev) => [currentDate, ...prev].sort((a, b) => (a < b ? 1 : -1)));
      }
      loadGoalProgress(split.otroGoalSince);
    } catch {
      flash("No se pudo guardar. Revisá tu conexión.");
    }
  };

  const deleteEntry = async (id) => {
    const prev = entries;
    setEntries((e) => e.filter((x) => x.id !== id));
    try {
      await api.deleteEntry(id);
      loadGoalProgress(split.otroGoalSince);
    } catch {
      setEntries(prev);
      flash("No se pudo borrar.");
    }
  };

  const shiftDate = (delta) => {
    const [y, m, d] = currentDate.split("-").map(Number);
    const dt = new Date(y, m - 1, d + delta);
    setCurrentDate(toLocalDateStr(dt));
  };

  const loadSummary = useCallback(async (range, anchor) => {
    setSummaryLoading(true);
    try {
      const data = await api.getSummary(range, anchor);
      setSummaryData(data);
    } catch {
      flash("No se pudo cargar el resumen.");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showSummary) loadSummary(summaryRange, summaryAnchor);
  }, [showSummary, summaryRange, summaryAnchor, loadSummary]);

  const shiftSummaryAnchor = (delta) => {
    const [y, m, d] = summaryAnchor.split("-").map(Number);
    const dt =
      summaryRange === "week"
        ? new Date(y, m - 1, d + delta * 7)
        : new Date(y, m - 1 + delta, 1);
    setSummaryAnchor(toLocalDateStr(dt));
  };

  const summaryRangeLabel = () => {
    if (!summaryData) return "";
    if (summaryRange === "week") {
      return `${fmtDateLabel(summaryData.start)} al ${fmtDateLabel(summaryData.end)}`;
    }
    const [y, m] = summaryData.start.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  };

  const splitSum =
    Number(splitDraft.insumos || 0) + Number(splitDraft.ganancia || 0) + Number(splitDraft.otro || 0);

  const saveSplit = async () => {
    if (splitSum !== 100) {
      flash("Los porcentajes tienen que sumar 100%.");
      return;
    }
    try {
      const saved = await api.saveSplit(splitDraft);
      setSplit(saved);
      setSplitDraft(saved);
      loadGoalProgress(saved.otroGoalSince);
      flash("Reparto guardado.");
    } catch {
      flash("No se pudo guardar el reparto.");
    }
  };

  const resetGoal = async () => {
    try {
      const saved = await api.resetGoal();
      setSplit(saved);
      setSplitDraft(saved);
      loadGoalProgress(saved.otroGoalSince);
      flash("Meta reiniciada.");
    } catch {
      flash("No se pudo reiniciar la meta.");
    }
  };

  const insumosAmt = (total * Number(split.insumos || 0)) / 100;
  const gananciaAmt = (total * Number(split.ganancia || 0)) / 100;
  const otroAmt = (total * Number(split.otro || 0)) / 100;

  const goalAccumulated = (goalTotal * Number(split.otro || 0)) / 100;
  const goalPct =
    split.otroGoal > 0 ? Math.min(100, Math.round((goalAccumulated / split.otroGoal) * 100)) : 0;
  const goalRemaining = Math.max(0, (split.otroGoal || 0) - goalAccumulated);

  const COLORS = { insumos: "#E8748C", ganancia: "#C9A455", otro: "#A98BC9" };
  const conicGradient = `conic-gradient(${COLORS.insumos} 0% ${split.insumos}%, ${COLORS.ganancia} ${split.insumos}% ${
    split.insumos + split.ganancia
  }%, ${COLORS.otro} ${split.insumos + split.ganancia}% 100%)`;

  return (
    <div className="page">
      <div className="shell">
        <div className="header">
          <div>
            <div className="eyebrow">SYNC · CONTROL DIARIO</div>
            <h1 className="h1">Uñas &amp; Caja</h1>
          </div>
          <div className="dateNav">
            <button className="navBtn" onClick={() => shiftDate(-1)} aria-label="Día anterior">‹</button>
            <div className="dateBox">
              <div className="dateLabel">
                {fmtDateLabel(currentDate)}
                {currentDate === today && <span className="todayPill">HOY</span>}
              </div>
              <input
                type="date"
                value={currentDate}
                max={today}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="dateInput"
              />
            </div>
            <button
              className="navBtn"
              style={{ opacity: currentDate >= today ? 0.35 : 1 }}
              onClick={() => currentDate < today && shiftDate(1)}
              disabled={currentDate >= today}
              aria-label="Día siguiente"
            >
              ›
            </button>
          </div>
        </div>

        {offline && (
          <div className="offlineBanner">
            No hay conexión con el servidor. Revisá que el backend esté corriendo.
          </div>
        )}

        <div className="totalCard">
          <div className="totalLabel">Total del día</div>
          <div className="totalNumber">{fmtMoney(total)}</div>
          <div className="totalSub">{entries.length} {entries.length === 1 ? "clienta" : "clientas"}</div>
        </div>

        <form onSubmit={addEntry} className="form">
          <input
            className="input"
            style={{ flex: 1.3 }}
            placeholder="Nombre (opcional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Monto"
            inputMode="decimal"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button type="submit" className="addBtn">Agregar</button>
        </form>

        <div className="serviceBlock">
          <div className="fieldLabel">Tipo de servicio</div>
          <div className="chipRow">
            {SERVICE_TYPES.map((s) => (
              <button
                type="button"
                key={s}
                className={`chip ${serviceType === s ? "chipActive" : ""}`}
                onClick={() => setServiceType(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="fieldLabel" style={{ marginTop: 12 }}>Extras</div>
          <div className="chipRow">
            {EXTRAS_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt}
                className={`chip chipExtra ${extras.includes(opt) ? "chipActive" : ""}`}
                onClick={() => toggleExtra(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="entriesCard">
          {loading ? (
            <div className="emptyState">Cargando…</div>
          ) : entries.length === 0 ? (
            <div className="emptyState">Todavía no cargaste ninguna clienta este día.</div>
          ) : (
            entries
              .slice()
              .reverse()
              .map((e) => (
                <div key={e.id} className="entryRow">
                  <div>
                    <div className="entryName">{e.name}</div>
                    <div className="entryTime">
                      {e.time}
                      {e.serviceType && <span className="entryService">{e.serviceType}</span>}
                    </div>
                    {e.extras && e.extras.length > 0 && (
                      <div className="entryExtras">{e.extras.join(" · ")}</div>
                    )}
                  </div>
                  <div className="entryRight">
                    <div className="entryAmount">{fmtMoney(e.amount)}</div>
                    <button className="deleteBtn" onClick={() => deleteEntry(e.id)} aria-label={`Borrar ${e.name}`}>×</button>
                  </div>
                </div>
              ))
          )}
        </div>

        <div className="splitCard">
          <div className="splitHeader">
            <h2 className="h2">Reparto del día</h2>
            <span className="splitHint">Se aplica al total: {fmtMoney(total)}</span>
          </div>
          <div className="splitBody">
            <div className="donutWrap">
              <div className="donut" style={{ background: conicGradient }}>
                <div className="donutHole">
                  <div className="donutTotal">{fmtMoney(total)}</div>
                </div>
              </div>
            </div>
            <div className="splitRows">
              <SplitRow
                color={COLORS.insumos}
                label="Insumos"
                value={splitDraft.insumos}
                amount={insumosAmt}
                onChange={(v) => setSplitDraft((s) => ({ ...s, insumos: v }))}
              />
              <SplitRow
                color={COLORS.ganancia}
                label="Ganancia"
                value={splitDraft.ganancia}
                amount={gananciaAmt}
                onChange={(v) => setSplitDraft((s) => ({ ...s, ganancia: v }))}
              />
              <SplitRow
                color={COLORS.otro}
                label={splitDraft.otroLabel}
                value={splitDraft.otro}
                amount={otroAmt}
                editableLabel
                onLabelChange={(v) => setSplitDraft((s) => ({ ...s, otroLabel: v }))}
                onChange={(v) => setSplitDraft((s) => ({ ...s, otro: v }))}
              />
              <div className="goalAmountRow">
                <span className="fieldLabel" style={{ marginBottom: 0 }}>Meta en $</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="ej: 1500000"
                  value={splitDraft.otroGoal || ""}
                  onChange={(e) => setSplitDraft((s) => ({ ...s, otroGoal: e.target.value }))}
                  className="goalAmountInput"
                />
              </div>

              <div className="splitFooter">
                <span style={{ color: splitSum === 100 ? "#B48A93" : "#E8748C", fontWeight: 600 }}>
                  Suma: {splitSum}%{splitSum !== 100 && " — tiene que dar 100%"}
                </span>
                <button className="saveBtn" onClick={saveSplit}>Guardar reparto</button>
              </div>

              {split.otroGoal > 0 && (
                <div className="goalProgress">
                  <div className="goalProgressTop">
                    <span className="fieldLabel" style={{ marginBottom: 0 }}>
                      Progreso de "{split.otroLabel}"
                    </span>
                    <button className="linkBtn" onClick={resetGoal}>Reiniciar</button>
                  </div>
                  <div className="progressBarTrack">
                    <div
                      className="progressBarFill"
                      style={{ width: `${goalPct}%`, background: COLORS.otro }}
                    />
                  </div>
                  <div className="goalProgressNums">
                    <span>{fmtMoney(goalAccumulated)} de {fmtMoney(split.otroGoal)}</span>
                    <span>{goalPct}%</span>
                  </div>
                  {goalRemaining > 0 && (
                    <div className="goalRemaining">Faltan {fmtMoney(goalRemaining)}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="summaryToggle">
          <button
            className="linkBtn"
            onClick={() => {
              if (!showSummary) setSummaryAnchor(currentDate);
              setShowSummary((s) => !s);
            }}
          >
            {showSummary ? "Ocultar resumen" : "Ver resumen semanal / mensual"}
          </button>
        </div>

        {showSummary && (
          <div className="splitCard">
            <div className="summaryTabs">
              <button
                className={`tabBtn ${summaryRange === "week" ? "tabActive" : ""}`}
                onClick={() => setSummaryRange("week")}
              >
                Semana
              </button>
              <button
                className={`tabBtn ${summaryRange === "month" ? "tabActive" : ""}`}
                onClick={() => setSummaryRange("month")}
              >
                Mes
              </button>
            </div>

            <div className="summaryNav">
              <button className="navBtn" onClick={() => shiftSummaryAnchor(-1)} aria-label="Período anterior">‹</button>
              <div className="summaryPeriodLabel">{summaryRangeLabel()}</div>
              <button className="navBtn" onClick={() => shiftSummaryAnchor(1)} aria-label="Período siguiente">›</button>
            </div>

            {summaryLoading || !summaryData ? (
              <div className="emptyState">Cargando…</div>
            ) : (
              <>
                <div className="summaryTotal">
                  <div className="totalLabel">Total del período</div>
                  <div className="totalNumber" style={{ fontSize: 34 }}>{fmtMoney(summaryData.total)}</div>
                  <div className="totalSub">
                    {summaryData.count} {summaryData.count === 1 ? "clienta" : "clientas"}
                  </div>
                  {summaryData.previous && summaryData.previous.total > 0 && (
                    <ComparisonBadge current={summaryData.total} previous={summaryData.previous.total} />
                  )}
                  {summaryData.previous && summaryData.previous.total === 0 && summaryData.total > 0 && (
                    <div className="comparisonBadge comparisonNeutral">
                      Sin datos del {summaryRange === "week" ? "período" : "mes"} anterior para comparar
                    </div>
                  )}
                </div>

                <div className="splitRows" style={{ marginTop: 14 }}>
                  <div className="summaryMiniRow">
                    <span><span className="dot" style={{ background: "#E8748C" }} /> Insumos ({split.insumos}%)</span>
                    <b>{fmtMoney((summaryData.total * split.insumos) / 100)}</b>
                  </div>
                  <div className="summaryMiniRow">
                    <span><span className="dot" style={{ background: "#C9A455" }} /> Ganancia ({split.ganancia}%)</span>
                    <b>{fmtMoney((summaryData.total * split.ganancia) / 100)}</b>
                  </div>
                  <div className="summaryMiniRow">
                    <span><span className="dot" style={{ background: "#A98BC9" }} /> {split.otroLabel} ({split.otro}%)</span>
                    <b>{fmtMoney((summaryData.total * split.otro) / 100)}</b>
                  </div>
                </div>

                {summaryData.serviceBreakdown.length > 0 && (
                  <div className="summarySection">
                    <div className="fieldLabel">Por tipo de servicio</div>
                    {summaryData.serviceBreakdown.map((s) => (
                      <div key={s.service_type} className="summaryMiniRow">
                        <span>{s.service_type} ({s.count})</span>
                        <b>{fmtMoney(s.total)}</b>
                      </div>
                    ))}
                  </div>
                )}

                {summaryData.days.length > 0 && (
                  <div className="summarySection">
                    <div className="fieldLabel">Por día</div>
                    {summaryData.days.map((d) => (
                      <div key={d.date} className="summaryMiniRow">
                        <span style={{ textTransform: "capitalize" }}>{fmtDateLabel(d.date)}</span>
                        <b>{fmtMoney(d.total)}</b>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="historyToggle">
          <button className="linkBtn" onClick={() => setShowHistory((s) => !s)}>
            {showHistory ? "Ocultar historial" : "Ver días anteriores"}
          </button>
        </div>
        {showHistory && (
          <div className="historyList">
            {datesIndex.length === 0 ? (
              <div className="emptyState">Sin historial todavía.</div>
            ) : (
              datesIndex.map((d) => (
                <button
                  key={d}
                  className="historyItem"
                  style={{ borderColor: d === currentDate ? "#C9A455" : "transparent" }}
                  onClick={() => {
                    setCurrentDate(d);
                    setShowHistory(false);
                  }}
                >
                  {fmtDateLabel(d)}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function ComparisonBadge({ current, previous }) {
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  const isUp = diff >= 0;
  return (
    <div className={`comparisonBadge ${isUp ? "comparisonUp" : "comparisonDown"}`}>
      {isUp ? "▲" : "▼"} {Math.abs(pct)}% vs. período anterior
    </div>
  );
}

function SplitRow({ color, label, value, amount, onChange, editableLabel, onLabelChange }) {
  return (
    <div className="splitRow">
      <div className="splitRowTop">
        <span className="dot" style={{ background: color }} />
        {editableLabel ? (
          <input className="labelInput" value={label} onChange={(e) => onLabelChange(e.target.value)} />
        ) : (
          <span className="splitRowLabel">{label}</span>
        )}
        <input
          type="number"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="percentInput"
        />
        <span className="percentSign">%</span>
      </div>
      <div className="splitRowAmount">{fmtMoney(amount)}</div>
    </div>
  );
}
