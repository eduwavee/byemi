import React, { useState, useMemo, useRef } from "react";
import { api, photoUrl } from "./api";
import {
  MONTHS,
  compressImage,
  daysBetween,
  fmtBirthday,
  fmtMoney,
  fmtShortDate,
  lastVisitLabel,
  whatsAppLink,
} from "./utils";

const EMPTY = { name: "", phone: "", service: "", notes: "", birthday: "" };
const AVATAR_TONES = ["pink", "lilac", "peach", "mint", "butter"];
const AWAY_DAYS = 60;

const toneFor = (name) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
};

const byName = (a, b) => a.name.localeCompare(b.name, "es");

export default function Clientas({ today, clients, setClients, catalog, flash, onSchedule }) {
  const [view, setView] = useState("lista");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | client id
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [viewer, setViewer] = useState(null); // { clientId, index }

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

  const replaceClient = (updated) =>
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)).sort(byName));

  const startNew = () => {
    setDraft({ ...EMPTY, name: query.trim() });
    setEditing("new");
  };

  const startEdit = (c) => {
    setDraft({ name: c.name, phone: c.phone, service: c.service, notes: c.notes, birthday: c.birthday });
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
        setClients((prev) => [...prev, created].sort(byName));
        flash("Clienta guardada.");
      } else {
        replaceClient(await api.updateClient(editing, draft));
        flash("Cambios guardados.");
      }
      cancel();
    } catch {
      flash("No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const client = clients.find((c) => c.id === editing);
    if (!client || !window.confirm(`¿Borrar a ${client.name}? También se borran sus turnos y fotos.`)) return;
    try {
      await api.deleteClient(client.id);
      setClients((prev) => prev.filter((c) => c.id !== client.id));
      cancel();
      flash("Clienta borrada.");
    } catch {
      flash("No se pudo borrar.");
    }
  };

  const addPhoto = async (client, file) => {
    if (!file) return;
    flash("Subiendo foto…");
    try {
      const dataUrl = await compressImage(file);
      const photo = await api.addPhoto(client.id, dataUrl);
      replaceClient({ ...client, photos: [photo, ...client.photos] });
      flash("Foto guardada.");
    } catch {
      flash("No se pudo subir la foto.");
    }
  };

  const deletePhoto = async (client, photo) => {
    if (!window.confirm("¿Borrar esta foto?")) return;
    try {
      await api.deletePhoto(photo.id);
      replaceClient({ ...client, photos: client.photos.filter((p) => p.id !== photo.id) });
      setViewer(null);
    } catch {
      flash("No se pudo borrar la foto.");
    }
  };

  const [bMonth, bDay] = draft.birthday ? draft.birthday.split("-") : ["", ""];
  const setBirthday = (month, day) =>
    setDraft((d) => ({ ...d, birthday: month && day ? `${month}-${day}` : month ? `${month}-01` : "" }));

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
          {catalog.services.map(({ name }) => (
            <button
              type="button"
              key={name}
              className={`chip ${draft.service === name ? "chipActive" : ""}`}
              onClick={() => setDraft((d) => ({ ...d, service: d.service === name ? "" : name }))}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="fieldLabel">Cumpleaños</span>
        <div className="fieldRow">
          <select
            className="input"
            value={bDay || ""}
            onChange={(e) => setBirthday(bMonth || "01", e.target.value)}
            aria-label="Día del cumpleaños"
          >
            <option value="">Día</option>
            {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
              <option key={d} value={d}>{Number(d)}</option>
            ))}
          </select>
          <select
            className="input"
            value={bMonth || ""}
            onChange={(e) => setBirthday(e.target.value, bDay || "01")}
            aria-label="Mes del cumpleaños"
          >
            <option value="">Mes</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
            ))}
          </select>
        </div>
        {draft.birthday && (
          <button type="button" className="linkBtn" onClick={() => setDraft((d) => ({ ...d, birthday: "" }))}>
            Quitar cumpleaños
          </button>
        )}
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

  const viewerClient = viewer && clients.find((c) => c.id === viewer.clientId);

  return (
    <>
      <div className="sectionIntro">
        <h2 className="sectionTitle">Mis clientas</h2>
        <p className="sectionSub">
          {clients.length === 0
            ? "Anotá a tus clientas para tener a mano su servicio, notas, fotos y WhatsApp."
            : `${clients.length} ${clients.length === 1 ? "clienta guardada" : "clientas guardadas"}`}
        </p>
      </div>

      {clients.length > 0 && (
        <div className="segmented">
          <button className={`segBtn ${view === "lista" ? "segActive" : ""}`} onClick={() => setView("lista")}>
            Lista
          </button>
          <button className={`segBtn ${view === "ranking" ? "segActive" : ""}`} onClick={() => setView("ranking")}>
            Ranking
          </button>
        </div>
      )}

      {view === "ranking" ? (
        <Ranking today={today} clients={clients} />
      ) : (
        <>
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
            <div className="emptyState">No hay ninguna clienta que coincida con "{query}".</div>
          )}

          <div className="clientList">
            {filtered.map((c) =>
              editing === c.id ? (
                <React.Fragment key={c.id}>{form}</React.Fragment>
              ) : (
                <ClientCard
                  key={c.id}
                  c={c}
                  today={today}
                  onEdit={() => startEdit(c)}
                  onSchedule={() => onSchedule(c.id)}
                  onAddPhoto={(file) => addPhoto(c, file)}
                  onOpenPhoto={(index) => setViewer({ clientId: c.id, index })}
                />
              )
            )}
          </div>
        </>
      )}

      {viewerClient && viewerClient.photos[viewer.index] && (
        <PhotoViewer
          client={viewerClient}
          index={viewer.index}
          onIndex={(index) => setViewer({ ...viewer, index })}
          onClose={() => setViewer(null)}
          onDelete={(photo) => deletePhoto(viewerClient, photo)}
        />
      )}
    </>
  );
}

function ClientCard({ c, today, onEdit, onSchedule, onAddPhoto, onOpenPhoto }) {
  const fileRef = useRef(null);
  const shown = c.photos.slice(0, 4);
  const extra = c.photos.length - shown.length;

  return (
    <article className="clientCard">
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
          {c.birthday && <div className="clientBday">🎂 {fmtBirthday(c.birthday)}</div>}
        </div>
        <button className="linkBtn" onClick={onEdit}>Editar</button>
      </div>

      {c.notes && <p className="clientNotes">{c.notes}</p>}

      <div className="photoStrip">
        {shown.map((p, i) => (
          <button key={p.id} className="photoThumb" onClick={() => onOpenPhoto(i)} aria-label="Ver foto">
            <img src={photoUrl(p.file)} alt="" loading="lazy" />
            {i === shown.length - 1 && extra > 0 && <span className="photoMore">+{extra}</span>}
          </button>
        ))}
        <button className="photoAdd" onClick={() => fileRef.current?.click()} aria-label={`Agregar foto de ${c.name}`}>
          <span aria-hidden="true">＋</span>
          <span className="photoAddLabel">Foto</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            onAddPhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <div className="clientActions">
        {c.nextAppointment ? (
          <span className="nextAppt">Próximo turno: {fmtShortDate(c.nextAppointment)}</span>
        ) : (
          <button className="softBtn" onClick={onSchedule}>Agendar turno</button>
        )}
        {c.phone && (
          <a className="waBtn" href={whatsAppLink(c.phone)} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        )}
      </div>
    </article>
  );
}

function PhotoViewer({ client, index, onIndex, onClose, onDelete }) {
  const photo = client.photos[index];
  const total = client.photos.length;
  return (
    <div className="viewerBackdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Fotos de ${client.name}`}>
      <div className="viewer" onClick={(e) => e.stopPropagation()}>
        <div className="viewerTop">
          <div>
            <div className="viewerName">{client.name}</div>
            <div className="viewerDate">{fmtShortDate(photo.createdAt.slice(0, 10))} · {index + 1} de {total}</div>
          </div>
          <button className="viewerClose" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <img className="viewerImg" src={photoUrl(photo.file)} alt={`Trabajo de ${client.name}`} />
        <div className="viewerActions">
          <button className="navBtn" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label="Foto anterior">‹</button>
          <button className="dangerLink" onClick={() => onDelete(photo)}>Borrar foto</button>
          <button className="navBtn" disabled={index === total - 1} onClick={() => onIndex(index + 1)} aria-label="Foto siguiente">›</button>
        </div>
      </div>
    </div>
  );
}

function Ranking({ today, clients }) {
  const withVisits = clients.filter((c) => c.visits > 0);
  const topVisits = [...withVisits].sort((a, b) => b.visits - a.visits).slice(0, 5);
  const topSpent = [...withVisits].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);
  const away = withVisits
    .filter((c) => !c.nextAppointment && daysBetween(c.lastVisit, today) >= AWAY_DAYS)
    .sort((a, b) => (a.lastVisit < b.lastVisit ? -1 : 1));

  if (withVisits.length === 0) {
    return (
      <div className="card emptyState">
        Todavía no hay visitas. Se cuentan cuando cargás en la Caja un cobro con el nombre de la clienta.
      </div>
    );
  }

  return (
    <>
      <RankCard title="Las que más vienen" items={topVisits} value={(c) => `${c.visits} ${c.visits === 1 ? "visita" : "visitas"}`} />
      <RankCard title="Las que más invierten" items={topSpent} value={(c) => fmtMoney(c.totalSpent)} />

      <h3 className="groupTitle">Hace mucho que no vienen</h3>
      <p className="sectionSub" style={{ marginTop: -4, marginBottom: 10 }}>
        Más de {AWAY_DAYS} días sin venir y sin turno. Un mensajito puede traerlas de vuelta.
      </p>
      {away.length === 0 ? (
        <div className="card emptyState">Todas vinieron hace poco 💖</div>
      ) : (
        <div className="card cardList">
          {away.map((c) => (
            <div key={c.id} className="turnoRow">
              <div className="turnoMain">
                <div className="entryName">{c.name}</div>
                <div className="entryTime">{lastVisitLabel(c.lastVisit, today)}</div>
              </div>
              {c.phone && (
                <a className="waBtn" href={whatsAppLink(c.phone)} target="_blank" rel="noreferrer">
                  Escribirle
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function RankCard({ title, items, value }) {
  return (
    <>
      <h3 className="groupTitle">{title}</h3>
      <div className="card cardList">
        {items.map((c, i) => (
          <div key={c.id} className="turnoRow">
            <span className={`rankNum rank${i + 1}`}>{i + 1}</span>
            <div className="turnoMain">
              <div className="entryName">{c.name}</div>
              {c.service && <div className="entryTime">{c.service}</div>}
            </div>
            <b className="rankValue">{value(c)}</b>
          </div>
        ))}
      </div>
    </>
  );
}
