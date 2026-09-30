import React, { useState, useEffect, useMemo } from "react";
import { api } from "./api";
import {
  addDays,
  daysBetween,
  daysToBirthday,
  fmtBirthday,
  fmtDateLabel,
  fmtMoney,
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
  cumple:
    "¡Feliz cumple {nombre}! 🎂💅 Te regalo un 10% de descuento en tu próximo service de este mes. ¡Que lo disfrutes mucho!",
  serviceDays: 21,
};

const BIRTHDAY_WINDOW = 7;

// guardado local de avisos ya mandados (service por visita, cumple por año)
const SENT_KEY = "byemi:service-sent";
const BDAY_KEY = "byemi:birthday-sent";
const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
};
const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sin storage: solo se pierde la marca visual
  }
};
export const readSent = () => readJson(SENT_KEY);
export const readBirthdaySent = () => readJson(BDAY_KEY);

// clientas que ya pasaron el intervalo desde su ultima visita y no tienen turno
export const dueForService = (clients, today, serviceDays) =>
  clients
    .filter(
      (c) => c.lastVisit && !c.nextAppointment && daysBetween(c.lastVisit, today) >= serviceDays
    )
    .sort((a, b) => (a.lastVisit < b.lastVisit ? -1 : 1));

// turnos de hoy y manana que todavia no tienen recordatorio
export const pendingTurnos = (appointments, today) =>
  appointments.filter((a) => !a.done && !a.remindedAt && a.date <= addDays(today, 1));

export const birthdaysToday = (clients, today) =>
  clients.filter((c) => daysToBirthday(c.birthday, today) === 0);

export default function Recordatorios({
  today,
  clients,
  appointments,
  setAppointments,
  reminderCfg,
  setReminderCfg,
  flash,
  onGoToAgenda,
  onAttend,
}) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [tplDraft, setTplDraft] = useState(reminderCfg);
  const [sent, setSent] = useState(readSent);
  const [bdaySent, setBdaySent] = useState(readBirthdaySent);
  const year = today.slice(0, 4);

  useEffect(() => setTplDraft(reminderCfg), [reminderCfg]);

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
    writeJson(SENT_KEY, next);
  };

  const markBirthdaySent = (c) => {
    const next = { ...bdaySent, [c.id]: year };
    setBdaySent(next);
    writeJson(BDAY_KEY, next);
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

  const birthdayMessage = (c) =>
    fillTemplate(reminderCfg.cumple, { nombre: firstName(c.name), servicio: c.service || "uñas" });

  const groups = useMemo(() => {
    const tomorrow = addDays(today, 1);
    const pending = appointments.filter((a) => !a.done);
    return [
      { key: "hoy", title: "Hoy", items: pending.filter((a) => a.date === today) },
      { key: "manana", title: "Mañana", items: pending.filter((a) => a.date === tomorrow) },
      { key: "prox", title: "Más adelante", items: pending.filter((a) => a.date > tomorrow) },
    ].filter((g) => g.items.length > 0);
  }, [appointments, today]);

  const due = useMemo(
    () => dueForService(clients, today, reminderCfg.serviceDays),
    [clients, today, reminderCfg.serviceDays]
  );

  const birthdays = useMemo(
    () =>
      clients
        .map((c) => ({ ...c, inDays: daysToBirthday(c.birthday, today) }))
        .filter((c) => c.inDays !== null && c.inDays <= BIRTHDAY_WINDOW)
        .sort((a, b) => a.inDays - b.inDays),
    [clients, today]
  );

  const waButton = (phone, text, done, onClick, label) =>
    phone ? (
      <a
        className={done ? "waBtn waDone" : "waBtn"}
        href={whatsAppLink(phone, text)}
        target="_blank"
        rel="noreferrer"
        onClick={onClick}
      >
        {done ? "✓ Avisado" : label}
      </a>
    ) : (
      <span className="hint">Sin teléfono</span>
    );

  return (
    <>
      <div className="sectionIntro">
        <h2 className="sectionTitle">Avisos</h2>
        <p className="sectionSub">Recordatorios de turnos, service y cumpleaños por WhatsApp.</p>
      </div>

      <div className="groupHeader">
        <h3 className="groupTitle">Próximos turnos</h3>
        <button className="softBtn" onClick={onGoToAgenda}>+ Agendar</button>
      </div>
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
                    <div className="apptTags">
                      {a.service && <span className="tag">{a.service}</span>}
                      {a.deposit > 0 && <span className="tag tagMint">Seña {fmtMoney(a.deposit)}</span>}
                    </div>
                  </div>
                  <div className="turnoActions">
                    {waButton(a.phone, turnoMessage(a), !!a.remindedAt, () => markReminded(a.id), "Recordar")}
                    {g.key === "hoy" && (
                      <button className="primaryBtn smallBtn" onClick={() => onAttend(a)}>Vino</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <h3 className="groupTitle">Cumpleaños</h3>
      {birthdays.length === 0 ? (
        <div className="card emptyState">Ningún cumple en los próximos {BIRTHDAY_WINDOW} días.</div>
      ) : (
        <div className="card cardList">
          {birthdays.map((c) => (
            <div key={c.id} className="turnoRow">
              <div className="bdayIcon" aria-hidden="true">🎂</div>
              <div className="turnoMain">
                <div className="entryName">{c.name}</div>
                <div className="entryTime">
                  {c.inDays === 0 ? "¡Hoy!" : c.inDays === 1 ? "Mañana" : `En ${c.inDays} días`} · {fmtBirthday(c.birthday)}
                </div>
              </div>
              <div className="turnoActions">
                {c.inDays === 0
                  ? waButton(c.phone, birthdayMessage(c), bdaySent[c.id] === year, () => markBirthdaySent(c), "Saludar")
                  : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="groupTitle">Les toca service</h3>
      <p className="sectionSub" style={{ marginTop: -4, marginBottom: 10 }}>
        Clientas que vinieron hace {reminderCfg.serviceDays} días o más y no tienen turno.
      </p>
      {due.length === 0 ? (
        <div className="card emptyState">Nadie pendiente por ahora ✨</div>
      ) : (
        <div className="card cardList">
          {due.map((c) => (
            <div key={c.id} className="turnoRow">
              <div className="turnoMain">
                <div className="entryName">{c.name}</div>
                <div className="entryTime">
                  Última visita {fmtShortDate(c.lastVisit)}
                  {c.service && <span className="tag">{c.service}</span>}
                </div>
              </div>
              <div className="turnoActions">
                {waButton(c.phone, serviceMessage(c), sent[c.id] === c.lastVisit, () => markServiceSent(c), "Avisar")}
              </div>
            </div>
          ))}
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
          <label className="field">
            <span className="fieldLabel">Saludo de cumpleaños</span>
            <textarea
              className="input textarea"
              rows={3}
              value={tplDraft.cumple}
              onChange={(e) => setTplDraft((t) => ({ ...t, cumple: e.target.value }))}
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
