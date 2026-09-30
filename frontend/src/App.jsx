import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api, auth } from "./api";
import { toLocalDateStr, DEFAULT_CATALOG, DEFAULT_AGENDA } from "./utils";
import { INSPO_PHOTOS, INSTAGRAM_URL, INSTAGRAM_HANDLE } from "./inspo";
import Caja from "./Caja";
import Agenda from "./Agenda";
import Clientas from "./Clientas";
import Ajustes from "./Ajustes";
import Login from "./Login";
import Recordatorios, {
  DEFAULT_REMINDERS,
  birthdaysToday,
  dueForService,
  pendingTurnos,
  readBirthdaySent,
  readSent,
} from "./Recordatorios";
import "./styles.css";

const TABS = [
  { key: "caja", label: "Caja", icon: WalletIcon },
  { key: "agenda", label: "Agenda", icon: CalendarIcon },
  { key: "clientas", label: "Clientas", icon: HeartIcon },
  { key: "avisos", label: "Avisos", icon: BellIcon },
  { key: "ajustes", label: "Ajustes", icon: SlidersIcon },
];

export default function App() {
  const [authState, setAuthState] = useState("checking"); // checking | setup | login | ok

  const checkAuth = useCallback(async () => {
    try {
      const status = await api.authStatus();
      setAuthState(!status.configured ? "setup" : status.valid ? "ok" : "login");
    } catch {
      // sin conexion: se muestra la app con el aviso de "sin conexión"
      setAuthState("ok");
    }
  }, []);

  useEffect(() => {
    auth.onUnauthorized(() => setAuthState("login"));
    checkAuth();
  }, [checkAuth]);

  if (authState === "checking") return <div className="page" />;
  if (authState === "setup" || authState === "login") {
    return <Login mode={authState} onDone={() => setAuthState("ok")} />;
  }
  return (
    <Main
      onLogout={async () => {
        await api.logout().catch(() => {});
        auth.setToken("");
        setAuthState("login");
      }}
    />
  );
}

function Main({ onLogout }) {
  const [today] = useState(() => toLocalDateStr(new Date()));
  const [tab, setTab] = useState("caja");
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [reminderCfg, setReminderCfg] = useState(DEFAULT_REMINDERS);
  const [catalog, setCatalog] = useState(DEFAULT_CATALOG);
  const [agendaCfg, setAgendaCfg] = useState(DEFAULT_AGENDA);
  const [preselectClientId, setPreselectClientId] = useState(null);
  const [cajaPrefill, setCajaPrefill] = useState(null);
  const [toast, setToast] = useState(null);
  const [offline, setOffline] = useState(false);

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
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

  const reloadAll = useCallback(() => {
    loadClients();
    loadAppointments();
  }, [loadClients, loadAppointments]);

  useEffect(() => {
    reloadAll();
    api.getReminderConfig().then(setReminderCfg).catch(() => {});
    api.getCatalog().then(setCatalog).catch(() => {});
    api.getAgendaConfig().then(setAgendaCfg).catch(() => {});
  }, [reloadAll]);

  const pendingCount = useMemo(() => {
    const sent = readSent();
    const bdaySent = readBirthdaySent();
    const dueUnsent = dueForService(clients, today, reminderCfg.serviceDays).filter(
      (c) => sent[c.id] !== c.lastVisit
    );
    const bdays = birthdaysToday(clients, today).filter((c) => bdaySent[c.id] !== today.slice(0, 4));
    return pendingTurnos(appointments, today).length + dueUnsent.length + bdays.length;
  }, [clients, appointments, today, reminderCfg.serviceDays]);

  const goTo = (key) => {
    setTab(key);
    window.scrollTo({ top: 0 });
  };

  const scheduleFor = (clientId) => {
    setPreselectClientId(clientId);
    goTo("agenda");
  };

  // "Vino": pasa el turno a la caja para cobrarlo
  const attend = (appt) => {
    setCajaPrefill({
      appointmentId: appt.id,
      date: appt.date,
      name: appt.name,
      service: appt.service,
      deposit: appt.deposit || 0,
    });
    goTo("caja");
  };

  const clearPreselect = useCallback(() => setPreselectClientId(null), []);

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

        {tab === "caja" && !cajaPrefill && <InspoStrip />}

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
              catalog={catalog}
              prefill={cajaPrefill}
              onPrefillUsed={(saved) => {
                setCajaPrefill(null);
                if (saved) reloadAll();
              }}
              onEntriesChanged={loadClients}
              setOffline={setOffline}
            />
          )}
          {tab === "agenda" && (
            <Agenda
              today={today}
              clients={clients}
              catalog={catalog}
              agendaCfg={agendaCfg}
              flash={flash}
              preselectClientId={preselectClientId}
              onPreselectUsed={clearPreselect}
              onChanged={reloadAll}
              onAttend={attend}
            />
          )}
          {tab === "clientas" && (
            <Clientas
              today={today}
              clients={clients}
              setClients={setClients}
              catalog={catalog}
              flash={flash}
              onSchedule={scheduleFor}
            />
          )}
          {tab === "avisos" && (
            <Recordatorios
              today={today}
              clients={clients}
              appointments={appointments}
              setAppointments={setAppointments}
              reminderCfg={reminderCfg}
              setReminderCfg={setReminderCfg}
              flash={flash}
              onGoToAgenda={() => goTo("agenda")}
              onAttend={attend}
            />
          )}
          {tab === "ajustes" && (
            <Ajustes
              catalog={catalog}
              setCatalog={setCatalog}
              agendaCfg={agendaCfg}
              setAgendaCfg={setAgendaCfg}
              flash={flash}
              onLogout={onLogout}
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
              {key === "avisos" && pendingCount > 0 && <span className="tabBadge">{pendingCount}</span>}
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

const iconProps = {
  viewBox: "0 0 24 24",
  width: 22,
  height: 22,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function WalletIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18M16 14.5h2" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}
