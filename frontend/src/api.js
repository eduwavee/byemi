// En desarrollo, Vite corre en :5173 y el backend en :3001.
// En producción, seteá VITE_API_URL en el build (ver README) apuntando a tu backend deployado.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const TOKEN_KEY = "byemi:token";
let token = "";
try {
  token = localStorage.getItem(TOKEN_KEY) || "";
} catch {
  // sin storage: hay que entrar cada vez
}
let onUnauthorized = () => {};

export const auth = {
  getToken: () => token,
  setToken(next) {
    token = next || "";
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // idem
    }
  },
  onUnauthorized(fn) {
    onUnauthorized = fn;
  },
};

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    auth.setToken("");
    onUnauthorized();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body || {}) });
const put = (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) });
const del = (path) => request(path, { method: "DELETE" });

export const photoUrl = (file) => `${API_URL}/api/photos/file/${file}?t=${encodeURIComponent(token)}`;

export const api = {
  authStatus: () => request(`/api/auth/status`),
  setupPassword: (password) => post(`/api/auth/setup`, { password }),
  login: (password) => post(`/api/auth/login`, { password }),
  logout: () => post(`/api/auth/logout`),
  changePassword: (current, next) => post(`/api/auth/change`, { current, next }),

  getEntries: (date) => request(`/api/entries/${date}`),
  getDates: () => request(`/api/entries`),
  addEntry: (date, entry) => post(`/api/entries/${date}`, entry),
  deleteEntry: (id) => del(`/api/entries/id/${id}`),

  getExpenses: (date) => request(`/api/expenses/${date}`),
  addExpense: (date, expense) => post(`/api/expenses/${date}`, expense),
  deleteExpense: (id) => del(`/api/expenses/id/${id}`),

  getSplit: () => request(`/api/config/split`),
  saveSplit: (split) => put(`/api/config/split`, split),
  resetGoal: () => post(`/api/config/split/reset-goal`),
  getSummary: (range, date) => request(`/api/summary/${range}/${date}`),
  getAllTime: (since) => request(`/api/summary/alltime${since ? `?since=${since}` : ""}`),

  getCatalog: () => request(`/api/config/catalog`),
  saveCatalog: (catalog) => put(`/api/config/catalog`, catalog),
  getAgendaConfig: () => request(`/api/config/agenda`),
  saveAgendaConfig: (cfg) => put(`/api/config/agenda`, cfg),
  getReminderConfig: () => request(`/api/config/reminders`),
  saveReminderConfig: (cfg) => put(`/api/config/reminders`, cfg),

  getClients: () => request(`/api/clients`),
  addClient: (client) => post(`/api/clients`, client),
  updateClient: (id, client) => put(`/api/clients/${id}`, client),
  deleteClient: (id) => del(`/api/clients/${id}`),
  addPhoto: (clientId, dataUrl) => post(`/api/photos`, { clientId, dataUrl }),
  deletePhoto: (id) => del(`/api/photos/${id}`),

  getAppointments: (from, to) => request(`/api/appointments?from=${from}${to ? `&to=${to}` : ""}`),
  addAppointment: (appt) => post(`/api/appointments`, appt),
  updateAppointment: (id, appt) => put(`/api/appointments/${id}`, appt),
  markReminded: (id) => post(`/api/appointments/${id}/reminded`),
  deleteAppointment: (id) => del(`/api/appointments/${id}`),

  // descarga un archivo del backend (con la sesion) y lo guarda en el celu/compu
  async download(path, filename) {
    const res = await fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
