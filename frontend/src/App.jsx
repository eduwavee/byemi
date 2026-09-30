import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "./api";
import { toLocalDateStr } from "./utils";
import { INSPO_PHOTOS, INSTAGRAM_URL, INSTAGRAM_HANDLE } from "./inspo";
import Caja from "./Caja";
import Clientas from "./Clientas";
import Recordatorios, {
  DEFAULT_REMINDERS,
  dueForService,
  pendingTurnos,
  readSent,
} from "./Recordatorios";
import "./styles.css";

const TABS = [
  { key: "caja", label: "Caja", icon: WalletIcon },
  { key: "clientas", label: "Clientas", icon: HeartIcon },
  { key: "recordatorios", label: "Recordatorios", icon: BellIcon },
];

export default function App() {
  const [today] = useState(() => toLocalDateStr(new Date()));
  const [tab, setTab] = useState("caja");
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [reminderCfg, setReminderCfg] = useState(DEFAULT_REMINDERS);
  const [preselectClientId, setPreselectClientId] = useState(null);
  const [toast, setToast] = useState(null);
  const [offline, setOffline] = useState(false);

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const loadClients = useCallback(async () => {
    try {
      setClients(await api.getClients());
    } catch {
      // la caja avisa si no hay conexion
    }
  }, []);

  const loadAppointments = useCallback(async () => {
    try {
      setAppointments(await api.getAppointments(today));
    } catch {
      // idem
    }
  }, [today]);

  useEffect(() => {
    loadClients();
    loadAppointments();
    api.getReminderConfig().then(setReminderCfg).catch(() => {});
  }, [loadClients, loadAppointments]);

  const pendingCount = useMemo(() => {
    const sent = readSent();
    const dueUnsent = dueForService(clients, today, reminderCfg.serviceDays).filter(
      (c) => sent[c.id] !== c.lastVisit
    );
    return pendingTurnos(appointments, today).length + dueUnsent.length;
  }, [clients, appointments, today, reminderCfg.serviceDays]);

  const goTo = (key) => {
    setTab(key);
    window.scrollTo({ top: 0 });
  };

  const scheduleFor = (clientId) => {
    setPreselectClientId(clientId);
    goTo("recordatorios");
  };

  return (
    <div className="page">
      <div className="shell">
        <header className="header">
          <div className="brandMark" aria-hidden="true">✿</div>
          <div>
            <div className="eyebrow">Nails studio</div>
            <h1 className="brand">by <em>Emi</em></h1>
          </div>
        </header>

        {tab === "caja" && <InspoStrip />}

        {offline && (
          <div className="offlineBanner">
            No hay conexión con el servidor. Revisá que el backend esté corriendo.
          </div>
        )}

        <main>
          {tab === "caja" && (
            <Caja
              today={today}
              flash={flash}
              clients={clients}
              onEntriesChanged={loadClients}
              setOffline={setOffline}
            />
          )}
          {tab === "clientas" && (
            <Clientas
              today={today}
              clients={clients}
              setClients={setClients}
              flash={flash}
              onSchedule={scheduleFor}
            />
          )}
          {tab === "recordatorios" && (
            <Recordatorios
              today={today}
              clients={clients}
              appointments={appointments}
              setAppointments={setAppointments}
              reminderCfg={reminderCfg}
              setReminderCfg={setReminderCfg}
              flash={flash}
              preselectClientId={preselectClientId}
              onClientsChanged={loadClients}
            />
          )}
        </main>
      </div>

      <nav className="tabBar" aria-label="Secciones">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`tabItem ${tab === key ? "tabItemActive" : ""}`}
            onClick={() => goTo(key)}
            aria-current={tab === key ? "page" : undefined}
          >
            <span className="tabIcon">
              <Icon />
              {key === "recordatorios" && pendingCount > 0 && (
                <span className="tabBadge">{pendingCount}</span>
              )}
            </span>
            <span className="tabLabel">{label}</span>
          </button>
        ))}
      </nav>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function InspoStrip() {
  const [failed, setFailed] = useState(() => new Set());
  const visible = INSPO_PHOTOS.filter((p) => !failed.has(p.src));
  if (visible.length === 0) return null;

  return (
    <section className="inspo" aria-label="Trabajos del salón">
      <div className="inspoTrack">
        {visible.map((p) => (
          <img
            key={p.src}
            src={p.src}
            alt={p.alt}
            className="inspoImg"
            loading="lazy"
            onError={() => setFailed((prev) => new Set(prev).add(p.src))}
          />
        ))}
      </div>
      {INSTAGRAM_URL && (
        <a className="inspoLink" href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
          {INSTAGRAM_HANDLE || "Ver en Instagram"} →
        </a>
      )}
    </section>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18M16 14.5h2" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </svg>
  );
}
