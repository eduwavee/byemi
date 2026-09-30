import React, { useState, useEffect } from "react";
import { api, auth } from "./api";

const WEEKDAYS = [
  { n: 1, label: "Lun" },
  { n: 2, label: "Mar" },
  { n: 3, label: "Mié" },
  { n: 4, label: "Jue" },
  { n: 5, label: "Vie" },
  { n: 6, label: "Sáb" },
  { n: 0, label: "Dom" },
];

const EXPORTS = [
  { key: "ingresos", label: "Ingresos" },
  { key: "gastos", label: "Gastos" },
  { key: "clientas", label: "Clientas" },
  { key: "turnos", label: "Turnos" },
];

export default function Ajustes({ catalog, setCatalog, agendaCfg, setAgendaCfg, flash, onLogout }) {
  return (
    <>
      <div className="sectionIntro">
        <h2 className="sectionTitle">Ajustes</h2>
        <p className="sectionSub">Precios, horario, clave y copias de seguridad.</p>
      </div>
      <PriceList catalog={catalog} setCatalog={setCatalog} flash={flash} />
      <WorkHours agendaCfg={agendaCfg} setAgendaCfg={setAgendaCfg} flash={flash} />
      <Backup flash={flash} />
      <Password flash={flash} onLogout={onLogout} />
    </>
  );
}

function PriceList({ catalog, setCatalog, flash }) {
  const [draft, setDraft] = useState(catalog);
  useEffect(() => setDraft(catalog), [catalog]);

  const update = (kind, i, patch) =>
    setDraft((d) => ({ ...d, [kind]: d[kind].map((item, j) => (j === i ? { ...item, ...patch } : item)) }));
  const remove = (kind, i) => setDraft((d) => ({ ...d, [kind]: d[kind].filter((_, j) => j !== i) }));
  const add = (kind) =>
    setDraft((d) => ({
      ...d,
      [kind]: [...d[kind], kind === "services" ? { name: "", price: 0, duration: 90 } : { name: "", price: 0 }],
    }));

  const save = async () => {
    try {
      setCatalog(await api.saveCatalog(draft));
      flash("Precios guardados.");
    } catch (err) {
      flash(err.message || "No se pudieron guardar los precios.");
    }
  };

  const numberInput = (value, onChange, label, width = 96) => (
    <input
      className="smallInput"
      style={{ width }}
      type="number"
      min="0"
      inputMode="numeric"
      value={value || ""}
      placeholder="0"
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
    />
  );

  return (
    <div className="card">
      <div className="cardHeader">
        <h2 className="h2">Lista de precios</h2>
      </div>
      <p className="hint" style={{ marginTop: -6 }}>
        Con precios cargados, el monto de la Caja se completa solo. La duración se usa para ver los horarios libres de la Agenda.
      </p>

      <div className="fieldLabel" style={{ marginTop: 14 }}>Servicios</div>
      <div className="priceHead" aria-hidden="true">
        <span>Nombre</span><span>Precio $</span><span>Min.</span><span />
      </div>
      {draft.services.map((s, i) => (
        <div key={i} className="priceRow">
          <input
            className="labelInput"
            value={s.name}
            placeholder="Nombre del servicio"
            onChange={(e) => update("services", i, { name: e.target.value })}
            aria-label="Nombre del servicio"
          />
          {numberInput(s.price, (v) => update("services", i, { price: v }), `Precio de ${s.name}`)}
          {numberInput(s.duration, (v) => update("services", i, { duration: v }), `Duración de ${s.name} en minutos`, 60)}
          <button className="iconBtn" onClick={() => remove("services", i)} aria-label={`Quitar ${s.name}`}>×</button>
        </div>
      ))}
      <button className="linkBtn" onClick={() => add("services")}>+ Agregar servicio</button>

      <div className="fieldLabel" style={{ marginTop: 18 }}>Extras</div>
      {draft.extras.map((x, i) => (
        <div key={i} className="priceRow priceRowExtra">
          <input
            className="labelInput"
            value={x.name}
            placeholder="Nombre del extra"
            onChange={(e) => update("extras", i, { name: e.target.value })}
            aria-label="Nombre del extra"
          />
          {numberInput(x.price, (v) => update("extras", i, { price: v }), `Precio de ${x.name}`)}
          <button className="iconBtn" onClick={() => remove("extras", i)} aria-label={`Quitar ${x.name}`}>×</button>
        </div>
      ))}
      <button className="linkBtn" onClick={() => add("extras")}>+ Agregar extra</button>

      <div className="formActions" style={{ marginTop: 14 }}>
        <button className="primaryBtn" onClick={save}>Guardar precios</button>
      </div>
    </div>
  );
}

function WorkHours({ agendaCfg, setAgendaCfg, flash }) {
  const [draft, setDraft] = useState(agendaCfg);
  useEffect(() => setDraft(agendaCfg), [agendaCfg]);

  const toggleDay = (n) =>
    setDraft((d) => ({
      ...d,
      daysOff: d.daysOff.includes(n) ? d.daysOff.filter((x) => x !== n) : [...d.daysOff, n],
    }));

  const save = async () => {
    try {
      setAgendaCfg(await api.saveAgendaConfig(draft));
      flash("Horario guardado.");
    } catch (err) {
      flash(err.message || "No se pudo guardar el horario.");
    }
  };

  return (
    <div className="card">
      <div className="cardHeader">
        <h2 className="h2">Horario de trabajo</h2>
      </div>
      <div className="fieldRow">
        <label className="field">
          <span className="fieldLabel">Desde</span>
          <input className="input" type="time" value={draft.start} onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))} />
        </label>
        <label className="field">
          <span className="fieldLabel">Hasta</span>
          <input className="input" type="time" value={draft.end} onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))} />
        </label>
      </div>
      <div className="field">
        <span className="fieldLabel">Días que trabajás</span>
        <div className="chipRow">
          {WEEKDAYS.map(({ n, label }) => (
            <button
              key={n}
              type="button"
              className={`chip ${draft.daysOff.includes(n) ? "" : "chipActive"}`}
              onClick={() => toggleDay(n)}
              aria-pressed={!draft.daysOff.includes(n)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="formActions">
        <button className="primaryBtn" onClick={save}>Guardar horario</button>
      </div>
    </div>
  );
}

function Backup({ flash }) {
  const download = async (path, filename) => {
    try {
      await api.download(path, filename);
    } catch {
      flash("No se pudo descargar.");
    }
  };

  return (
    <div className="card">
      <div className="cardHeader">
        <h2 className="h2">Backup</h2>
      </div>
      <p className="hint" style={{ marginTop: -6 }}>
        Descargá tus datos en planillas que abren con Excel o Google Sheets. Conviene hacerlo una vez por semana.
      </p>
      <div className="chipRow" style={{ marginTop: 12 }}>
        {EXPORTS.map((x) => (
          <button key={x.key} className="secondaryBtn" onClick={() => download(`/api/export/${x.key}.csv`, `byemi-${x.key}.csv`)}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="formActions" style={{ marginTop: 14 }}>
        <button className="primaryBtn" onClick={() => download(`/api/export/backup.json`, `byemi-backup-${new Date().toISOString().slice(0, 10)}.json`)}>
          Backup completo
        </button>
      </div>
    </div>
  );
}

function Password({ flash, onLogout }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");

  const change = async (e) => {
    e.preventDefault();
    if (next !== repeat) return flash("Las claves nuevas no coinciden.");
    try {
      const { token } = await api.changePassword(current, next);
      // la sesion vieja queda cerrada; seguimos con la nueva
      auth.setToken(token);
      setCurrent("");
      setNext("");
      setRepeat("");
      flash("Clave cambiada. Se cerró la sesión en los otros dispositivos.");
    } catch (err) {
      flash(err.message || "No se pudo cambiar la clave.");
    }
  };

  return (
    <form className="card" onSubmit={change}>
      <div className="cardHeader">
        <h2 className="h2">Clave de acceso</h2>
        <button type="button" className="linkBtn" onClick={onLogout}>Cerrar sesión</button>
      </div>
      <label className="field">
        <span className="fieldLabel">Clave actual</span>
        <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <div className="fieldRow">
        <label className="field">
          <span className="fieldLabel">Clave nueva</span>
          <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        <label className="field">
          <span className="fieldLabel">Repetila</span>
          <input className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </label>
      </div>
      <div className="formActions">
        <button type="submit" className="secondaryBtn">Cambiar clave</button>
      </div>
    </form>
  );
}
