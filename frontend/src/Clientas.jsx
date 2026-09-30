import React, { useState, useMemo } from "react";
import { api } from "./api";
import { SERVICE_TYPES, lastVisitLabel, whatsAppLink, fmtShortDate } from "./utils";

const EMPTY = { name: "", phone: "", service: "", notes: "" };
const AVATAR_TONES = ["pink", "lilac", "peach", "mint", "butter"];

const toneFor = (name) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
};

export default function Clientas({ today, clients, setClients, flash, onSchedule }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | client id
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.service.toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q)
    );
  }, [clients, query]);

  const startNew = () => {
    setDraft({ ...EMPTY, name: query.trim() });
    setEditing("new");
  };

  const startEdit = (c) => {
    setDraft({ name: c.name, phone: c.phone, service: c.service, notes: c.notes });
    setEditing(c.id);
  };

  const cancel = () => {
    setEditing(null);
    setDraft(EMPTY);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      flash("Poné el nombre de la clienta.");
      return;
    }
    setSaving(true);
    try {
      if (editing === "new") {
        const created = await api.addClient(draft);
        setClients((prev) =>
          [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "es"))
        );
        flash("Clienta guardada.");
      } else {
        const updated = await api.updateClient(editing, draft);
        setClients((prev) =>
          prev
            .map((c) => (c.id === editing ? updated : c))
            .sort((a, b) => a.name.localeCompare(b.name, "es"))
        );
        flash("Cambios guardados.");
      }
      cancel();
    } catch {
      flash("No se pudo guardar. Revisá tu conexión.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const client = clients.find((c) => c.id === editing);
    if (!client || !window.confirm(`¿Borrar a ${client.name}? También se borran sus turnos.`)) return;
    try {
      await api.deleteClient(client.id);
      setClients((prev) => prev.filter((c) => c.id !== client.id));
      cancel();
      flash("Clienta borrada.");
    } catch {
      flash("No se pudo borrar.");
    }
  };

  const form = (
    <form className="card clientForm" onSubmit={save}>
      <div className="cardHeader">
        <h2 className="h2">{editing === "new" ? "Nueva clienta" : "Editar clienta"}</h2>
        <button type="button" className="linkBtn" onClick={cancel}>Cancelar</button>
      </div>

      <label className="field">
        <span className="fieldLabel">Nombre</span>
        <input
          className="input"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="Ej: Sofi Martínez"
          autoFocus
        />
      </label>

      <label className="field">
        <span className="fieldLabel">WhatsApp</span>
        <input
          className="input"
          type="tel"
          inputMode="tel"
          value={draft.phone}
          onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
          placeholder="Ej: 11 2345 6789"
        />
      </label>

      <div className="field">
        <span className="fieldLabel">Servicio que se suele hacer</span>
        <div className="chipRow">
          {SERVICE_TYPES.map((s) => (
            <button
              type="button"
              key={s}
              className={`chip ${draft.service === s ? "chipActive" : ""}`}
              onClick={() => setDraft((d) => ({ ...d, service: d.service === s ? "" : s }))}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span className="fieldLabel">Notas</span>
        <textarea
          className="input textarea"
          rows={3}
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          placeholder="Colores que le gustan, largo, forma, alergias…"
        />
      </label>

      <div className="formActions">
        {editing !== "new" && (
          <button type="button" className="dangerLink" onClick={remove}>Borrar clienta</button>
        )}
        <button type="submit" className="primaryBtn" disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );

  return (
    <>
      <div className="sectionIntro">
        <h2 className="sectionTitle">Mis clientas</h2>
        <p className="sectionSub">
          {clients.length === 0
            ? "Anotá a tus clientas para tener a mano su servicio, notas y WhatsApp."
            : `${clients.length} ${clients.length === 1 ? "clienta guardada" : "clientas guardadas"}`}
        </p>
      </div>

      {editing === "new" ? (
        form
      ) : (
        <div className="searchRow">
          <input
            className="input"
            type="search"
            placeholder="Buscar por nombre, servicio o nota"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="primaryBtn" onClick={startNew}>+ Nueva</button>
        </div>
      )}

      {clients.length > 0 && filtered.length === 0 && (
        <div className="emptyState">
          No hay ninguna clienta que coincida con "{query}".
        </div>
      )}

      <div className="clientList">
        {filtered.map((c) =>
          editing === c.id ? (
            <React.Fragment key={c.id}>{form}</React.Fragment>
          ) : (
            <article key={c.id} className="clientCard">
              <div className="clientTop">
                <div className={`avatar avatar-${toneFor(c.name)}`} aria-hidden="true">
                  {c.name.trim().charAt(0).toUpperCase()}
                </div>
                <div className="clientMain">
                  <div className="clientName">{c.name}</div>
                  <div className="clientMeta">
                    {c.service && <span className="tag">{c.service}</span>}
                    <span>{lastVisitLabel(c.lastVisit, today)}</span>
                    {c.visits > 0 && <span>· {c.visits} {c.visits === 1 ? "visita" : "visitas"}</span>}
                  </div>
                </div>
                <button className="linkBtn" onClick={() => startEdit(c)}>Editar</button>
              </div>

              {c.notes && <p className="clientNotes">{c.notes}</p>}

              <div className="clientActions">
                {c.nextAppointment ? (
                  <span className="nextAppt">Próximo turno: {fmtShortDate(c.nextAppointment)}</span>
                ) : (
                  <button className="softBtn" onClick={() => onSchedule(c.id)}>Agendar turno</button>
                )}
                {c.phone && (
                  <a
                    className="waBtn"
                    href={whatsAppLink(c.phone)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </article>
          )
        )}
      </div>
    </>
  );
}
