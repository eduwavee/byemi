import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "./api";
import {
  addDays,
  fmtMoney,
  fmtShortDate,
  minToTime,
  parseDate,
  serviceDuration,
  timeToMin,
  weekStart,
} from "./utils";

const NEW_CLIENT = "__new";

export default function Agenda({
  today,
  clients,
  catalog,
  agendaCfg,
  flash,
  preselectClientId,
  onPreselectUsed,
  onChanged,
  onAttend,
}) {
  const [from, setFrom] = useState(() => weekStart(today));
  const [appts, setAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(null); // null | { id?, draft }

  const to = addDays(from, 6);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAppts(await api.getAppointments(from, to));
    } catch {
      flash("No se pudo cargar la agenda.");
    } finally {
      setLoading(false);
    }
  }, [from, to, flash]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = useCallback(
    (date, time = "", clientId = "") => {
      const c = clients.find((x) => x.id === clientId);
      setSheet({ draft: { clientId, date, time, service: c?.service || "", deposit: "" } });
    },
    [clients]
  );

  // llega desde Clientas -> "Agendar turno"
  useEffect(() => {
    if (!preselectClientId) return;
    openNew(addDays(today, 1), "", preselectClientId);
    onPreselectUsed();
  }, [preselectClientId, openNew, onPreselectUsed, today]);

  const openEdit = (a) =>
    setSheet({
      id: a.id,
      draft: { clientId: a.clientId, date: a.date, time: a.time, service: a.service, deposit: a.deposit || "" },
    });

  const afterChange = () => {
    setSheet(null);
    load();
    onChanged();
  };

  const minDuration = Math.max(30, Math.min(...catalog.services.map((s) => s.duration || 60)));

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(from, i);
      const items = appts.filter((a) => a.date === date);
      const off = agendaCfg.daysOff.includes(parseDate(date).getDay());
      return { date, items, off, free: off || date < today ? [] : freeGaps(date, items) };
    });

    function freeGaps(date, items) {
      let cursor = timeToMin(agendaCfg.start);
      const end = timeToMin(agendaCfg.end);
      if (date === today) {
        const now = new Date();
        cursor = Math.max(cursor, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30);
      }
      const busy = items
        .filter((a) => a.time)
        .map((a) => [timeToMin(a.time), timeToMin(a.time) + serviceDuration(catalog, a.service)])
        .sort((a, b) => a[0] - b[0]);
      const gaps = [];
      for (const [s, e] of busy) {
        if (s - cursor >= minDuration) gaps.push([cursor, s]);
        cursor = Math.max(cursor, e);
      }
      if (end - cursor >= minDuration) gaps.push([cursor, end]);
      return gaps;
    }
  }, [from, appts, agendaCfg, today, catalog, minDuration]);

  const weekLabel = `${fmtShortDate(from)} – ${fmtShortDate(to)}`;

  return (
    <>
      <div className="sectionIntro">
        <h2 className="sectionTitle">Agenda</h2>
        <p className="sectionSub">
          Horario {agendaCfg.start} a {agendaCfg.end}. Tocá un horario libre para agendar.
        </p>
      </div>

      <div className="dateNav">
        <button className="navBtn" onClick={() => setFrom(addDays(from, -7))} aria-label="Semana anterior">‹</button>
        <div className="dateBox">
          <div className="dateLabel">{weekLabel}</div>
          {from !== weekStart(today) && (
            <button className="linkBtn" onClick={() => setFrom(weekStart(today))}>Ir a esta semana</button>
          )}
        </div>
        <button className="navBtn" onClick={() => setFrom(addDays(from, 7))} aria-label="Semana siguiente">›</button>
      </div>

      {loading && appts.length === 0 ? (
        <div className="card emptyState">Cargando…</div>
      ) : (
        days.map((d) => (
          <section key={d.date} className={`dayCard ${d.date === today ? "dayToday" : ""} ${d.date < today ? "dayPast" : ""}`}>
            <div className="dayHeader">
              <div>
                <span className="dayName">{fmtShortDate(d.date)}</span>
                {d.date === today && <span className="todayPill">Hoy</span>}
              </div>
              {!d.off && d.date >= today && (
                <button className="softBtn" onClick={() => openNew(d.date)}>+ Turno</button>
              )}
            </div>

            {d.off && d.items.length === 0 && <div className="dayEmpty">No trabajás este día</div>}
            {!d.off && d.items.length === 0 && d.free.length === 0 && (
              <div className="dayEmpty">{d.date < today ? "Sin turnos" : "Sin horarios libres"}</div>
            )}

            {d.items.map((a) => (
              <div key={a.id} className={`apptRow ${a.done ? "apptDone" : ""}`}>
                <button className="apptMain" onClick={() => openEdit(a)} aria-label={`Editar turno de ${a.name}`}>
                  <span className="turnoTime">{a.time || "—"}</span>
                  <span className="apptInfo">
                    <span className="entryName">{a.name}</span>
                    <span className="apptTags">
                      {a.service && <span className="tag">{a.service}</span>}
                      {a.deposit > 0 && <span className="tag tagMint">Seña {fmtMoney(a.deposit)}</span>}
                    </span>
                  </span>
                </button>
                {a.done ? (
                  <span className="doneMark">✓ Vino</span>
                ) : (
                  a.date <= today && (
                    <button className="primaryBtn smallBtn" onClick={() => onAttend(a)}>Vino</button>
                  )
                )}
              </div>
            ))}

            {d.free.length > 0 && (
              <div className="freeRow">
                {d.free.map(([s, e]) => (
                  <button key={s} className="freeSlot" onClick={() => openNew(d.date, minToTime(s))}>
                    Libre {minToTime(s)}–{minToTime(e)}
                  </button>
                ))}
              </div>
            )}
          </section>
        ))
      )}

      {sheet && (
        <TurnoSheet
          sheet={sheet}
          today={today}
          clients={clients}
          catalog={catalog}
          appts={appts}
          flash={flash}
          onClose={() => setSheet(null)}
          onSaved={afterChange}
        />
      )}
    </>
  );
}

function TurnoSheet({ sheet, today, clients, catalog, appts, flash, onClose, onSaved }) {
  const [draft, setDraft] = useState(sheet.draft);
  const [newClient, setNewClient] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const pickClient = (id) => {
    const c = clients.find((x) => x.id === id);
    set({ clientId: id, service: c?.service || draft.service });
  };

  // aviso si se pisa con otro turno del mismo dia
  const overlap = useMemo(() => {
    if (!draft.time) return null;
    const s = timeToMin(draft.time);
    const e = s + serviceDuration(catalog, draft.service);
    return appts.find((a) => {
      if (a.id === sheet.id || a.date !== draft.date || !a.time) return false;
      const as = timeToMin(a.time);
      const ae = as + serviceDuration(catalog, a.service);
      return s < ae && as < e;
    });
  }, [draft, appts, catalog, sheet.id]);

  const save = async (e) => {
    e.preventDefault();
    if (!draft.clientId) return flash("Elegí una clienta.");
    if (draft.clientId === NEW_CLIENT && !newClient.name.trim()) return flash("Poné el nombre de la clienta.");
    if (!draft.date) return flash("Elegí el día.");
    setSaving(true);
    try {
      let clientId = draft.clientId;
      if (clientId === NEW_CLIENT) {
        const created = await api.addClient({ ...newClient, service: draft.service });
        clientId = created.id;
      }
      const body = { ...draft, clientId, deposit: Number(draft.deposit) || 0 };
      if (sheet.id) await api.updateAppointment(sheet.id, body);
      else await api.addAppointment(body);
      flash(sheet.id ? "Turno actualizado." : "Turno agendado.");
      onSaved();
    } catch (err) {
      flash(err.message || "No se pudo guardar el turno.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("¿Borrar este turno?")) return;
    try {
      await api.deleteAppointment(sheet.id);
      flash("Turno borrado.");
      onSaved();
    } catch {
      flash("No se pudo borrar el turno.");
    }
  };

  return (
    <div className="sheetBackdrop" onClick={onClose}>
      <form
        className="sheet"
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={sheet.id ? "Editar turno" : "Nuevo turno"}
      >
        <div className="sheetHandle" aria-hidden="true" />
        <div className="cardHeader">
          <h2 className="h2">{sheet.id ? "Editar turno" : "Nuevo turno"}</h2>
          <button type="button" className="linkBtn" onClick={onClose}>Cerrar</button>
        </div>

        <label className="field">
          <span className="fieldLabel">Clienta</span>
          <select className="input" value={draft.clientId} onChange={(e) => pickClient(e.target.value)}>
            <option value="">Elegí una clienta…</option>
            <option value={NEW_CLIENT}>+ Clienta nueva</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        {draft.clientId === NEW_CLIENT && (
          <div className="fieldRow">
            <label className="field">
              <span className="fieldLabel">Nombre</span>
              <input
                className="input"
                value={newClient.name}
                onChange={(e) => setNewClient((c) => ({ ...c, name: e.target.value }))}
                autoFocus
              />
            </label>
            <label className="field">
              <span className="fieldLabel">WhatsApp</span>
              <input
                className="input"
                type="tel"
                inputMode="tel"
                value={newClient.phone}
                onChange={(e) => setNewClient((c) => ({ ...c, phone: e.target.value }))}
              />
            </label>
          </div>
        )}

        <div className="fieldRow">
          <label className="field">
            <span className="fieldLabel">Día</span>
            <input
              className="input"
              type="date"
              min={sheet.id ? undefined : today}
              value={draft.date}
              onChange={(e) => set({ date: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="fieldLabel">Hora</span>
            <input className="input" type="time" value={draft.time} onChange={(e) => set({ time: e.target.value })} />
          </label>
        </div>

        <div className="field">
          <span className="fieldLabel">Servicio</span>
          <div className="chipRow">
            {catalog.services.map((s) => (
              <button
                type="button"
                key={s.name}
                className={`chip ${draft.service === s.name ? "chipActive" : ""}`}
                onClick={() => set({ service: s.name })}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <label className="field fieldInline">
          <span className="fieldLabel" style={{ marginBottom: 0 }}>Seña $</span>
          <input
            className="smallInput"
            style={{ width: 120 }}
            type="number"
            min="0"
            inputMode="decimal"
            placeholder="0"
            value={draft.deposit}
            onChange={(e) => set({ deposit: e.target.value })}
          />
        </label>

        {overlap && (
          <div className="warnBox">
            Se superpone con el turno de {overlap.name} a las {overlap.time}.
          </div>
        )}

        <div className="formActions">
          {sheet.id && (
            <button type="button" className="dangerLink" onClick={remove}>Borrar turno</button>
          )}
          <button type="submit" className="primaryBtn" disabled={saving}>
            {saving ? "Guardando…" : "Guardar turno"}
          </button>
        </div>
      </form>
    </div>
  );
}
