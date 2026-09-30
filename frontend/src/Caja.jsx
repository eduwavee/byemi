import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "./api";
import {
  toLocalDateStr,
  fmtMoney,
  fmtDateLabel,
  suggestedPrice,
} from "./utils";

const DEFAULT_SPLIT = {
  insumos: 30,
  ganancia: 50,
  otroLabel: "Meta: Televisor",
  otro: 20,
  otroGoal: 0,
  otroGoalSince: null,
};

export const SPLIT_COLORS = { insumos: "#EE8AA6", ganancia: "#F2B880", otro: "#B79CEB" };

export default function Caja({
  today,
  flash,
  clients,
  catalog,
  prefill,
  onPrefillUsed,
  onEntriesChanged,
  setOffline,
}) {
  const [currentDate, setCurrentDate] = useState(today);
  const [entries, setEntries] = useState([]);
  const [split, setSplit] = useState(DEFAULT_SPLIT);
  const [splitDraft, setSplitDraft] = useState(DEFAULT_SPLIT);
  const [datesIndex, setDatesIndex] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [extras, setExtras] = useState([]);
  // el monto se completa solo con la lista de precios hasta que se lo toca a mano
  const [amountTouched, setAmountTouched] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryRange, setSummaryRange] = useState("week");
  const [summaryAnchor, setSummaryAnchor] = useState(currentDate);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [goalTotal, setGoalTotal] = useState(0);

  const loadDay = useCallback(async (date) => {
    setLoading(true);
    try {
      const [list, exp] = await Promise.all([api.getEntries(date), api.getExpenses(date)]);
      setEntries(list);
      setExpenses(exp);
      setOffline(false);
    } catch (err) {
      setOffline(true);
      flash("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const expensesTotal = useMemo(
    () => expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [expenses]
  );

  const serviceNames = catalog.services.map((s) => s.name);
  const extraNames = catalog.extras.map((x) => x.name);

  useEffect(() => {
    if (amountTouched) return;
    const price = suggestedPrice(catalog, serviceType, extras);
    setAmount(price > 0 ? String(price) : "");
  }, [serviceType, extras, catalog, amountTouched]);

  // "Vino" desde un turno: precarga la clienta y el servicio
  useEffect(() => {
    if (!prefill) return;
    setCurrentDate(prefill.date);
    setName(prefill.name);
    setServiceType(prefill.service || "");
    setExtras([]);
    setAmountTouched(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [prefill]);

  const toggleExtra = (opt) => {
    setExtras((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]));
  };

  // si el nombre coincide con una clienta guardada, sugiere su servicio habitual
  const onNameChange = (value) => {
    setName(value);
    const match = clients.find((c) => c.name.toLowerCase() === value.trim().toLowerCase());
    if (match && match.service && serviceNames.includes(match.service) && !serviceType) {
      setServiceType(match.service);
    }
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
        appointmentId: prefill?.appointmentId,
      });
      setEntries((prev) => [...prev, created]);
      setName("");
      setAmount("");
      setAmountTouched(false);
      setServiceType("");
      setExtras([]);
      if (prefill) onPrefillUsed(true);
      if (!datesIndex.includes(currentDate)) {
        setDatesIndex((prev) => [currentDate, ...prev].sort((a, b) => (a < b ? 1 : -1)));
      }
      loadGoalProgress(split.otroGoalSince);
      onEntriesChanged();
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
      onEntriesChanged();
    } catch {
      setEntries(prev);
      flash("No se pudo borrar.");
    }
  };

  const addExpense = async (e) => {
    e.preventDefault();
    const val = parseFloat(expenseAmount);
    if (!val || val <= 0) {
      flash("Poné el monto del gasto.");
      return;
    }
    try {
      const created = await api.addExpense(currentDate, { description: expenseDesc.trim(), amount: val });
      setExpenses((prev) => [...prev, created]);
      setExpenseDesc("");
      setExpenseAmount("");
    } catch {
      flash("No se pudo guardar el gasto.");
    }
  };

  const deleteExpense = async (id) => {
    const prev = expenses;
    setExpenses((list) => list.filter((x) => x.id !== id));
    try {
      await api.deleteExpense(id);
    } catch {
      setExpenses(prev);
      flash("No se pudo borrar el gasto.");
    }
  };

  const cancelPrefill = () => {
    onPrefillUsed(false);
    setName("");
    setServiceType("");
    setExtras([]);
    setAmountTouched(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const COLORS = SPLIT_COLORS;
  const conicGradient = `conic-gradient(${COLORS.insumos} 0% ${split.insumos}%, ${COLORS.ganancia} ${split.insumos}% ${
    split.insumos + split.ganancia
  }%, ${COLORS.otro} ${split.insumos + split.ganancia}% 100%)`;

  return (
    <>
      <div className="dateNav">
        <button className="navBtn" onClick={() => shiftDate(-1)} aria-label="Día anterior">‹</button>
        <div className="dateBox">
          <div className="dateLabel">
            {fmtDateLabel(currentDate)}
            {currentDate === today && <span className="todayPill">Hoy</span>}
          </div>
          <input
            type="date"
            value={currentDate}
            max={today}
            onChange={(e) => e.target.value && setCurrentDate(e.target.value)}
            className="dateInput"
            aria-label="Elegir fecha"
          />
        </div>
        <button
          className="navBtn"
          onClick={() => currentDate < today && shiftDate(1)}
          disabled={currentDate >= today}
          aria-label="Día siguiente"
        >
          ›
        </button>
      </div>

      <div className="totalCard">
        <div className="totalLabel">Total del día</div>
        <div className="totalNumber">{fmtMoney(total)}</div>
        <div className="totalSub">
          {entries.length} {entries.length === 1 ? "clienta" : "clientas"}
          {expensesTotal > 0 && <> · quedan {fmtMoney(total - expensesTotal)} después de gastos</>}
        </div>
      </div>

      <div className="card">
        {prefill && (
          <div className="prefillBanner">
            <div>
              <b>Cobrando el turno de {prefill.name}</b>
              {prefill.deposit > 0 && (
                <div>
                  Dejó seña de {fmtMoney(prefill.deposit)}
                  {Number(amount) > 0 && <> — cobrale {fmtMoney(Math.max(0, Number(amount) - prefill.deposit))}</>}
                </div>
              )}
            </div>
            <button type="button" className="linkBtn" onClick={cancelPrefill}>Cancelar</button>
          </div>
        )}
        <form onSubmit={addEntry} className="form">
          <input
            className="input"
            style={{ flex: 1.3 }}
            placeholder="Nombre (opcional)"
            list="clientas-list"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
          <datalist id="clientas-list">
            {clients.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Monto"
            inputMode="decimal"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setAmountTouched(true);
            }}
          />
          <button type="submit" className="primaryBtn">Agregar</button>
        </form>

        <div className="fieldLabel">Tipo de servicio</div>
        <div className="chipRow">
          {serviceNames.map((s) => (
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

        <div className="fieldLabel" style={{ marginTop: 14 }}>Extras</div>
        <div className="chipRow">
          {extraNames.map((opt) => (
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

      <div className="card cardList">
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
                    {e.serviceType && <span className="tag">{e.serviceType}</span>}
                  </div>
                  {e.extras && e.extras.length > 0 && (
                    <div className="entryExtras">{e.extras.join(" · ")}</div>
                  )}
                </div>
                <div className="entryRight">
                  <div className="entryAmount">{fmtMoney(e.amount)}</div>
                  <button className="iconBtn" onClick={() => deleteEntry(e.id)} aria-label={`Borrar ${e.name}`}>×</button>
                </div>
              </div>
            ))
        )}
      </div>

      <div className="card">
        <div className="cardHeader">
          <h2 className="h2">Gastos del día</h2>
          {expensesTotal > 0 && <span className="hint">Total: {fmtMoney(expensesTotal)}</span>}
        </div>
        {expenses.map((x) => (
          <div key={x.id} className="miniRow">
            <span>{x.description}</span>
            <span className="entryRight">
              <b>−{fmtMoney(x.amount)}</b>
              <button className="iconBtn" onClick={() => deleteExpense(x.id)} aria-label={`Borrar gasto ${x.description}`}>×</button>
            </span>
          </div>
        ))}
        <form onSubmit={addExpense} className="form" style={{ marginTop: expenses.length ? 12 : 0, marginBottom: 0 }}>
          <input
            className="input"
            style={{ flex: 1.3 }}
            placeholder="Ej: esmaltes, limas"
            value={expenseDesc}
            onChange={(e) => setExpenseDesc(e.target.value)}
          />
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Monto"
            inputMode="decimal"
            type="number"
            min="0"
            step="0.01"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(e.target.value)}
          />
          <button type="submit" className="secondaryBtn">Anotar</button>
        </form>
      </div>

      <div className="card">
        <div className="cardHeader">
          <h2 className="h2">Reparto del día</h2>
          <span className="hint">Se aplica al total: {fmtMoney(total)}</span>
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
                className="smallInput goalAmountInput"
              />
            </div>

            <div className="splitFooter">
              <span className={splitSum === 100 ? "sumOk" : "sumBad"}>
                Suma: {splitSum}%{splitSum !== 100 && " — tiene que dar 100%"}
              </span>
              <button className="secondaryBtn" onClick={saveSplit}>Guardar reparto</button>
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

      <div className="toggleRow">
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
        <div className="card">
          <div className="segmented">
            <button
              className={`segBtn ${summaryRange === "week" ? "segActive" : ""}`}
              onClick={() => setSummaryRange("week")}
            >
              Semana
            </button>
            <button
              className={`segBtn ${summaryRange === "month" ? "segActive" : ""}`}
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
                <div className="miniRow">
                  <span><span className="dot" style={{ background: COLORS.insumos }} /> Insumos ({split.insumos}%)</span>
                  <b>{fmtMoney((summaryData.total * split.insumos) / 100)}</b>
                </div>
                <div className="miniRow">
                  <span><span className="dot" style={{ background: COLORS.ganancia }} /> Ganancia ({split.ganancia}%)</span>
                  <b>{fmtMoney((summaryData.total * split.ganancia) / 100)}</b>
                </div>
                <div className="miniRow">
                  <span><span className="dot" style={{ background: COLORS.otro }} /> {split.otroLabel} ({split.otro}%)</span>
                  <b>{fmtMoney((summaryData.total * split.otro) / 100)}</b>
                </div>
              </div>

              {summaryData.expensesTotal > 0 && (
                <div className="summarySection">
                  <div className="miniRow">
                    <span>Gastos anotados</span>
                    <b>−{fmtMoney(summaryData.expensesTotal)}</b>
                  </div>
                  <div className="miniRow">
                    <span>Queda (cobrado − gastos)</span>
                    <b>{fmtMoney(summaryData.total - summaryData.expensesTotal)}</b>
                  </div>
                </div>
              )}

              {summaryData.serviceBreakdown.length > 0 && (
                <div className="summarySection">
                  <div className="fieldLabel">Por tipo de servicio</div>
                  {summaryData.serviceBreakdown.map((s) => (
                    <div key={s.service_type} className="miniRow">
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
                    <div key={d.date} className="miniRow">
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

      <div className="toggleRow">
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
                className={`historyItem ${d === currentDate ? "historyActive" : ""}`}
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
    </>
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
          className="smallInput percentInput"
        />
        <span className="percentSign">%</span>
      </div>
      <div className="splitRowAmount">{fmtMoney(amount)}</div>
    </div>
  );
}
