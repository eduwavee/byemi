import React, { useState, useEffect, useMemo } from "react";
import { api } from "./api";
import {
  SERVICE_TYPES,
  addDays,
  daysBetween,
  fmtDateLabel,
  fmtShortDate,
  fillTemplate,
  firstName,
  whatsAppLink,
} from "./utils";

export const DEFAULT_REMINDERS = {
  turno:
    "¡Hola {nombre}! 💅 Te recuerdo tu turno de {servicio} el {dia} a las {hora}. ¡Te espero! Si no podés venir avisame así libero el horario 🌸",
  service:
    "¡Hola {nombre}! 💖 Ya pasaron {semanas} semanas desde tu último service. ¿Querés que te reserve un turno para esta semana?",
  serviceDays: 21,
};

// guardado local de a quien ya se le mando el aviso de service (por visita)
const SENT_KEY = "byemi:service-sent";
export const readSent = () => {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) || "{}");
  } catch {
    return {};
  }
};
const writeSent = (value) => {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(value));
  } catch {
    // sin storage: solo se pierde la marca visual
  }
};

// clientas que ya pasaron el intervalo desde su ultima visita y no tienen turno
export const dueForService = (clients, today, serviceDays) =>
  clients
    .filter(
      (c) => c.lastVisit && !c.nextAppointment && daysBetween(c.lastVisit, today) >= serviceDays
    )
    .sort((a, b) => (a.lastVisit < b.lastVisit ? -1 : 1));

// turnos de hoy y manana que todavia no tienen recordatorio
export const pendingTurnos = (appointments, today) =>
  appointments.filter((a) => !a.remindedAt && a.date <= addDays(today, 1));

export default function Recordatorios({
  today,
  clients,
  appointments,
  setAppointments,
  reminderCfg,
  setReminderCfg,
  flash,
  preselectClientId,
  onClientsChanged,
}) {
  const [draft, setDraft] = useState({ clientId: "", date: addDays(today, 1), time: "", service: "" });
  const [showTemplates, setShowTemplates] = useState(false);
  const [tplDraft, setTplDraft] = useState(reminderCfg);
  const [sent, setSent] = useState(readSent);

  useEffect(() => setTplDraft(reminderCfg), [reminderCfg]);

  useEffect(() => {
    if (!preselectClientId) return;
    const c = clients.find((x) => x.id === preselectClientId);
    setDraft((d) => ({ ...d, clientId: preselectClientId, service: c?.service || d.service }));
  }, [preselectClientId, clients]);

  const pickClient = (id) => {
    const c = clients.find((x) => x.id === id);
    setDraft((d) => ({ ...d, clientId: id, service: c?.service || d.service }));
  };

  const addTurno = async (e) => {
    e.preventDefault();
    if (!draft.clientId) {
      flash("Elegí una clienta.");
      return;
    }
    if (!draft.date) {
      flash("Elegí la fecha del turno.");
      return;
    }
    try {
      const created = await api.addAppointment(draft);
      setAppointments((prev) =>
        [...prev, created].sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))
      );
      setDraft({ clientId: "", date: draft.date, time: "", service: "" });
      onClientsChanged();
      flash("Turno agendado.");
    } catch {
      flash("No se pudo agendar. Revisá tu conexión.");
    }
  };

  const removeTurno = async (id) => {
    const prev = appointments;
    setAppointments((list) => list.filter((a) => a.id !== id));
    try {
      await api.deleteAppointment(id);
      onClientsChanged();
    } catch {
      setAppointments(prev);
      flash("No se pudo borrar el turno.");
    }
  };

  const markReminded = async (id) => {
    try {
      const updated = await api.markReminded(id);
      setAppointments((list) => list.map((a) => (a.id === id ? updated : a)));
    } catch {
      // el WhatsApp ya se abrio; si falla la marca no pasa nada grave
    }
  };

  const markServiceSent = (c) => {
    const next = { ...sent, [c.id]: c.lastVisit };
    setSent(next);
    writeSent(next);
  };

  const saveTemplates = async () => {
    try {
      const saved = await api.saveReminderConfig(tplDraft);
      setReminderCfg(saved);
      setShowTemplates(false);
      flash("Mensajes guardados.");
    } catch (err) {
      flash(err.message || "No se pudieron guardar los mensajes.");
    }
  };

  const turnoMessage = (a) =>
    fillTemplate(reminderCfg.turno, {
      nombre: firstName(a.name),
      servicio: a.service || "uñas",
      dia: a.date === today ? "hoy" : a.date === addDays(today, 1) ? "mañana" : fmtDateLabel(a.date),
      hora: a.time || "la hora que acordamos",
    });

  const serviceMessage = (c) =>
    fillTemplate(reminderCfg.service, {
      nombre: firstName(c.name),
      servicio: c.service || "uñas",
      semanas: Math.floor(daysBetween(c.lastVisit, today) / 7),
    });

  const groups = useMemo(() => {
    const tomorrow = addDays(today, 1);
    return [
      { key: "hoy", title: "Hoy", items: appointments.filter((a) => a.date === today) },
      { key: "manana", title: "Mañana", items: appointments.filter((a) => a.date === tomorrow) },
      { key: "prox", title: "Más adelante", items: appointments.filter((a) => a.date > tomorrow) },
    ].filter((g) => g.items.length > 0);
  }, [appointments, today]);

  const due = useMemo(
    () => dueForService(clients, today, reminderCfg.serviceDays),
    [clients, today, reminderCfg.serviceDays]
  );

  return (
    <>
      <div className="sectionIntro">
        <h2 className="sectionTitle">Recordatorios</h2>
        <p className="sectionSub">Agendá turnos y avisale a tus clientas por WhatsApp con un toque.</p>
      </div>

      <form className="card" onSubmit={addTurno}>
        <div className="cardHeader">
          <h2 className="h2">Nuevo turno</h2>
        </div>
        {clients.length === 0 ? (
          <div className="emptyState">Primero guardá alguna clienta en la pestaña Clientas.</div>
        ) : (
          <>
            <label className="field">
              <span className="fieldLabel">Clienta</span>
              <select
                className="input"
                value={draft.clientId}
                onChange={(e) => pickClient(e.target.value)}
              >
                <option value="">Elegí una clienta…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <div className="fieldRow">
              <label className="field">
                <span className="fieldLabel">Día</span>
                <input
                  className="input"
                  type="date"
                  min={today}
                  value={draft.date}
                  onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="fieldLabel">Hora</span>
                <input
                  className="input"
                  type="time"
                  value={draft.time}
                  onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
                />
              </label>
            </div>
            <div className="field">
              <span className="fieldLabel">Servicio</span>
              <div className="chipRow">
                {SERVICE_TYPES.map((s) => (
                  <button
                    type="button"
                    key={s}
                    className={`chip ${draft.service === s ? "chipActive" : ""}`}
                    onClick={() => setDraft((d) => ({ ...d, service: s }))}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="formActions">
              <button type="submit" className="primaryBtn">Agendar turno</button>
            </div>
          </>
        )}
      </form>

      <h3 className="groupTitle">Próximos turnos</h3>
      {groups.length === 0 ? (
        <div className="card emptyState">No hay turnos agendados.</div>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="turnoGroup">
            <div className="groupLabel">{g.title}</div>
            <div className="card cardList">
              {g.items.map((a) => (
                <div key={a.id} className="turnoRow">
                  <div className="turnoWhen">
                    <span className="turnoTime">{a.time || "—"}</span>
                    {g.key === "prox" && <span className="turnoDate">{fmtShortDate(a.date)}</span>}
                  </div>
                  <div className="turnoMain">
                    <div className="entryName">{a.name}</div>
                    {a.service && <span className="tag">{a.service}</span>}
                  </div>
                  <div className="turnoActions">
                    {a.phone ? (
                      <a
                        className={a.remindedAt ? "waBtn waDone" : "waBtn"}
                        href={whatsAppLink(a.phone, turnoMessage(a))}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => markReminded(a.id)}
                      >
                        {a.remindedAt ? "✓ Avisado" : "Recordar"}
                      </a>
                    ) : (
                      <span className="hint">Sin teléfono</span>
                    )}
                    <button
                      className="iconBtn"
                      onClick={() => removeTurno(a.id)}
                      aria-label={`Borrar turno de ${a.name}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <h3 className="groupTitle">Les toca service</h3>
      <p className="sectionSub" style={{ marginTop: -4 }}>
        Clientas que vinieron hace {reminderCfg.serviceDays} días o más y no tienen turno.
      </p>
      {due.length === 0 ? (
        <div className="card emptyState">Nadie pendiente por ahora ✨</div>
      ) : (
        <div className="card cardList">
          {due.map((c) => {
            const done = sent[c.id] === c.lastVisit;
            return (
              <div key={c.id} className="turnoRow">
                <div className="turnoMain">
                  <div className="entryName">{c.name}</div>
                  <div className="entryTime">
                    Última visita {fmtShortDate(c.lastVisit)}
                    {c.service && <span className="tag">{c.service}</span>}
                  </div>
                </div>
                <div className="turnoActions">
                  {c.phone ? (
                    <a
                      className={done ? "waBtn waDone" : "waBtn"}
                      href={whatsAppLink(c.phone, serviceMessage(c))}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => markServiceSent(c)}
                    >
                      {done ? "✓ Avisado" : "Avisar"}
                    </a>
                  ) : (
                    <span className="hint">Sin teléfono</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="toggleRow">
        <button className="linkBtn" onClick={() => setShowTemplates((s) => !s)}>
          {showTemplates ? "Cerrar mensajes" : "Editar mensajes de WhatsApp"}
        </button>
      </div>

      {showTemplates && (
        <div className="card">
          <p className="hint" style={{ marginTop: 0 }}>
            Podés usar {"{nombre}"}, {"{servicio}"}, {"{dia}"}, {"{hora}"} y {"{semanas}"}; se reemplazan solos.
          </p>
          <label className="field">
            <span className="fieldLabel">Recordatorio de turno</span>
            <textarea
              className="input textarea"
              rows={4}
              value={tplDraft.turno}
              onChange={(e) => setTplDraft((t) => ({ ...t, turno: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="fieldLabel">Aviso de service</span>
            <textarea
              className="input textarea"
              rows={4}
              value={tplDraft.service}
              onChange={(e) => setTplDraft((t) => ({ ...t, service: e.target.value }))}
            />
          </label>
          <label className="field fieldInline">
            <span className="fieldLabel" style={{ marginBottom: 0 }}>Avisar service a los</span>
            <input
              className="smallInput"
              type="number"
              min="1"
              value={tplDraft.serviceDays}
              onChange={(e) => setTplDraft((t) => ({ ...t, serviceDays: Number(e.target.value) }))}
            />
            <span className="hint">días</span>
          </label>
          <div className="formActions">
            <button className="linkBtn" onClick={() => setTplDraft(DEFAULT_REMINDERS)}>
              Volver a los originales
            </button>
            <button className="primaryBtn" onClick={saveTemplates}>Guardar mensajes</button>
          </div>
        </div>
      )}
    </>
  );
}
