// Antes esto hablaba con un backend (Express + SQLite). Ahora hace lo mismo pero
// guardando todo en el celular (ver db.js), así que no hace falta pagar un servidor
// y la app anda sin internet. Las funciones mantienen los mismos nombres y respuestas.
import { tx, getAll, getByIndex, get, put, remove, getConfig, setConfig, uid, stamp, STORES } from "./db";

const SESSION_KEY = "byemi:session";
const MIN_LENGTH = 4;

const fail = (message) => {
  throw new Error(message);
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const byCreated = (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
const sameName = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

// ---------- config por defecto (la misma que tenía el backend) ----------

const DEFAULTS = {
  split: {
    insumos: 30,
    ganancia: 50,
    otroLabel: "Meta: Televisor",
    otro: 20,
    otroGoal: 0,
    otroGoalSince: null,
  },
  reminders: {
    turno:
      "¡Hola {nombre}! 💅 Te recuerdo tu turno de {servicio} el {dia} a las {hora}. ¡Te espero! Si no podés venir avisame así libero el horario 🌸",
    service:
      "¡Hola {nombre}! 💖 Ya pasaron {semanas} semanas desde tu último service. ¿Querés que te reserve un turno para esta semana?",
    cumple:
      "¡Feliz cumple {nombre}! 🎂💅 Te regalo un 10% de descuento en tu próximo service de este mes. ¡Que lo disfrutes mucho!",
    serviceDays: 21,
  },
  // precios en 0 = no autocompletar el monto
  catalog: {
    services: [
      { name: "Kapping", price: 0, duration: 90 },
      { name: "Softgel", price: 0, duration: 90 },
      { name: "Esculpidas", price: 0, duration: 120 },
      { name: "Esculpidas Híbridas", price: 0, duration: 120 },
    ],
    extras: [
      { name: "Largo L/XL", price: 0 },
      { name: "Extensión de uñas", price: 0 },
      { name: "Remoción colega", price: 0 },
    ],
  },
  // daysOff: 0 = domingo ... 6 = sabado
  agenda: { start: "09:00", end: "19:00", daysOff: [0] },
};

const readConfig = async (key) => ({ ...DEFAULTS[key], ...(await getConfig(key)) });

// ---------- clave ----------
// La clave protege la app si alguien agarra el celular. Se guarda como hash PBKDF2.

const toHex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
const randomHex = (bytes) => toHex(crypto.getRandomValues(new Uint8Array(bytes)));

async function hashWith(password, salt) {
  const enc = new TextEncoder();
  if (!crypto.subtle) {
    // solo pasa en http (probando por la red local); en la app publicada siempre hay https
    let h = 0x811c9dc5;
    for (const b of enc.encode(salt + password)) h = Math.imul(h ^ b, 0x01000193) >>> 0;
    return `fnv:${h.toString(16)}`;
  }
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 150000, hash: "SHA-256" },
    key,
    256
  );
  return toHex(bits);
}

async function sha256(text) {
  if (!crypto.subtle) return text;
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

const readSession = () => {
  try {
    return localStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
};

async function newSession(authCfg) {
  const token = randomHex(32);
  await setConfig("auth", { ...authCfg, session: await sha256(token) });
  try {
    localStorage.setItem(SESSION_KEY, token);
  } catch {
    // sin storage: hay que entrar cada vez
  }
}

async function checkPassword(password) {
  const a = await getConfig("auth");
  return !!a && (await hashWith(String(password || ""), a.salt)) === a.hash;
}

async function makeAuth(password) {
  const salt = randomHex(16);
  return { salt, hash: await hashWith(password, salt) };
}

// ---------- fotos ----------
// Se guardan como Blob en IndexedDB y se muestran con URLs temporales del navegador.

const photoUrls = new Map();

const urlFor = (photo) => {
  if (!photoUrls.has(photo.id)) photoUrls.set(photo.id, URL.createObjectURL(photo.blob));
  return photoUrls.get(photo.id);
};

const forgetUrl = (id) => {
  const url = photoUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  photoUrls.delete(id);
};

export const photoUrl = (file) => photoUrls.get(file) || "";

const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

// ---------- clientas ----------

const cleanClient = (body) => {
  const birthday = String(body.birthday || "").trim();
  const c = {
    name: String(body.name || "").trim(),
    phone: String(body.phone || "").trim(),
    service: String(body.service || "").trim(),
    notes: String(body.notes || "").trim(),
    // formato MM-DD, sin año
    birthday: /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(birthday) ? birthday : "",
  };
  if (!c.name) fail("El nombre es obligatorio");
  return c;
};

// las visitas se cruzan con la caja por nombre (sin distinguir mayusculas)
function withStats(client, { entries, appointments, photos, today }) {
  const visits = entries.filter((e) => sameName(e.name, client.name));
  const next = appointments
    .filter((a) => a.clientId === client.id && a.date >= today && !a.entryId)
    .map((a) => a.date)
    .sort()[0];
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    service: client.service,
    notes: client.notes,
    birthday: client.birthday,
    lastVisit: visits.reduce((max, e) => (!max || e.date > max ? e.date : max), null),
    visits: visits.length,
    totalSpent: visits.reduce((s, e) => s + e.amount, 0),
    nextAppointment: next || null,
    photos: photos
      .filter((p) => p.clientId === client.id)
      .sort((a, b) => byCreated(b, a))
      .map((p) => {
        urlFor(p);
        return { id: p.id, file: p.id, createdAt: p.createdAt };
      }),
  };
}

async function loadClients(filterId) {
  const [clients, entries, appointments, photos] = await Promise.all(
    ["clients", "entries", "appointments", "photos"].map(getAll)
  );
  const ctx = { entries, appointments, photos, today: todayStr() };
  return clients
    .filter((c) => !filterId || c.id === filterId)
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }))
    .map((c) => withStats(c, ctx));
}

// ---------- turnos ----------

async function appointmentView(a, clientsById) {
  const c = clientsById ? clientsById.get(a.clientId) : await get("clients", a.clientId);
  return {
    id: a.id,
    clientId: a.clientId,
    date: a.date,
    time: a.time,
    service: a.service,
    deposit: a.deposit,
    remindedAt: a.remindedAt || null,
    done: !!a.entryId,
    name: c ? c.name : "",
    phone: c ? c.phone : "",
  };
}

async function saveAppointment(id, body) {
  const { clientId, date, time, service, deposit } = body;
  if (!clientId || !date) fail("Falta la clienta o la fecha");
  if (!(await get("clients", clientId))) fail("Clienta no encontrada");
  const current = id ? await get("appointments", id) : null;
  if (id && !current) fail("Turno no encontrado");
  const appt = {
    id: id || uid(),
    entryId: null,
    remindedAt: null,
    createdAt: stamp(),
    ...current,
    clientId,
    date,
    time: time || "",
    service: service || "",
    deposit: Math.max(0, Number(deposit) || 0),
  };
  await put("appointments", appt);
  return appointmentView(appt);
}

// ---------- resumen ----------

const toDateObj = (str) => {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// semana de lunes a domingo, que contiene la fecha dada
function getWeekRange(dateStr) {
  const d = toDateObj(dateStr);
  const day = d.getDay(); // 0 = domingo ... 6 = sabado
  const monday = new Date(d);
  monday.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toStr(monday), end: toStr(sunday) };
}

// mes calendario que contiene la fecha dada
function getMonthRange(dateStr) {
  const d = toDateObj(dateStr);
  return {
    start: toStr(new Date(d.getFullYear(), d.getMonth(), 1)),
    end: toStr(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

function getPreviousRange(range, start) {
  const first = toDateObj(start);
  if (range === "week") {
    first.setDate(first.getDate() - 7);
    return getWeekRange(toStr(first));
  }
  return getMonthRange(toStr(new Date(first.getFullYear(), first.getMonth() - 1, 1)));
}

const inRange = (start, end) => (r) => r.date >= start && r.date <= end;
const totals = (rows) => ({ total: rows.reduce((s, r) => s + r.amount, 0), count: rows.length });

function buildSummary(entries, expenses, start, end) {
  const rows = entries.filter(inRange(start, end));
  const groupBy = (key) => {
    const map = new Map();
    for (const r of rows) {
      if (!r[key]) continue;
      const g = map.get(r[key]) || { total: 0, count: 0 };
      g.total += r.amount;
      g.count += 1;
      map.set(r[key], g);
    }
    return map;
  };
  const days = [...groupBy("date")]
    .map(([date, g]) => ({ date, ...g }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const serviceBreakdown = [...groupBy("serviceType")]
    .map(([service_type, g]) => ({ service_type, ...g }))
    .sort((a, b) => b.total - a.total);
  return {
    start,
    end,
    ...totals(rows),
    days,
    serviceBreakdown,
    expensesTotal: totals(expenses.filter(inRange(start, end))).total,
  };
}

// ---------- export ----------

const yesNo = (v) => (v ? "Sí" : "No");

const EXPORTS = {
  ingresos: async () => ({
    rows: (await getAll("entries"))
      .sort((a, b) => (a.date === b.date ? byCreated(a, b) : a.date < b.date ? -1 : 1))
      .map((r) => ({ ...r, extras: (r.extras || []).join(", ") })),
    columns: { date: "Fecha", time: "Hora", name: "Clienta", serviceType: "Servicio", extras: "Extras", amount: "Monto" },
  }),
  gastos: async () => ({
    rows: (await getAll("expenses")).sort((a, b) => (a.date === b.date ? byCreated(a, b) : a.date < b.date ? -1 : 1)),
    columns: { date: "Fecha", description: "Detalle", amount: "Monto" },
  }),
  clientas: async () => ({
    rows: (await getAll("clients"))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }))
      .map((c) => ({ ...c, createdAt: (c.createdAt || "").slice(0, 10) })),
    columns: { name: "Nombre", phone: "WhatsApp", service: "Servicio habitual", birthday: "Cumpleaños (MM-DD)", notes: "Notas", createdAt: "Alta" },
  }),
  turnos: async () => {
    const clients = new Map((await getAll("clients")).map((c) => [c.id, c]));
    return {
      rows: (await getAll("appointments"))
        .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))
        .map((a) => ({ ...a, name: clients.get(a.clientId)?.name || "", done: yesNo(a.entryId) })),
      columns: { date: "Fecha", time: "Hora", name: "Clienta", service: "Servicio", deposit: "Seña", done: "Vino" },
    };
  },
};

// Excel en español usa ";" como separador. El BOM hace que respete los acentos.
const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// en el celu abre el menú de compartir (Guardar en Archivos, Drive, WhatsApp...);
// en la compu descarga el archivo
async function saveFile(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  const touch = window.matchMedia?.("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (err) {
      if (err.name === "AbortError") return false;
      // si compartir falla por otro motivo, se intenta la descarga común
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

// ---------- backup ----------

// convierte "2025-03-01 14:22:11" (formato SQLite, en UTC) a ISO
const isoFrom = (v) => {
  if (!v) return stamp();
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? `${s.replace(" ", "T")}Z` : s;
};
const pick = (r, camel, snake) => (r[camel] !== undefined ? r[camel] : r[snake]);
const parseList = (v) => {
  if (Array.isArray(v)) return v;
  try {
    return JSON.parse(v || "[]");
  } catch {
    return [];
  }
};

// acepta tanto el backup nuevo como el que bajaba la versión con servidor
async function normalizeBackup(data) {
  if (!data || !Array.isArray(data.entries) || !Array.isArray(data.clients)) {
    fail("Ese archivo no es un backup de by Emi.");
  }
  const list = (name) => (Array.isArray(data[name]) ? data[name] : []);
  const entries = list("entries").map((r) => ({
    id: r.id || uid(),
    date: r.date,
    name: r.name || "Clienta",
    amount: Number(r.amount) || 0,
    time: r.time || "",
    serviceType: pick(r, "serviceType", "service_type") || "",
    extras: parseList(r.extras),
    createdAt: isoFrom(pick(r, "createdAt", "created_at")),
  }));
  const expenses = list("expenses").map((r) => ({
    id: r.id || uid(),
    date: r.date,
    description: r.description || "Gasto",
    amount: Number(r.amount) || 0,
    createdAt: isoFrom(pick(r, "createdAt", "created_at")),
  }));
  const clients = list("clients").map((r) => ({
    id: r.id || uid(),
    name: r.name || "",
    phone: r.phone || "",
    service: r.service || "",
    notes: r.notes || "",
    birthday: r.birthday || "",
    createdAt: isoFrom(pick(r, "createdAt", "created_at")),
  }));
  const appointments = list("appointments").map((r) => ({
    id: r.id || uid(),
    clientId: pick(r, "clientId", "client_id"),
    date: r.date,
    time: r.time || "",
    service: r.service || "",
    deposit: Number(r.deposit) || 0,
    entryId: pick(r, "entryId", "entry_id") || null,
    remindedAt: pick(r, "remindedAt", "reminded_at") || null,
    createdAt: isoFrom(pick(r, "createdAt", "created_at")),
  }));
  // el backup del servidor no traía las imágenes, solo el nombre del archivo
  const withData = list("photos").filter((p) => p.dataUrl);
  const photos = [];
  for (const p of withData) {
    photos.push({
      id: p.id || uid(),
      clientId: p.clientId,
      blob: await dataUrlToBlob(p.dataUrl),
      createdAt: isoFrom(p.createdAt),
    });
  }
  const config = Object.entries(data.config || {})
    .filter(([key]) => key in DEFAULTS)
    .map(([key, value]) => ({ key, value }));
  return {
    entries,
    expenses,
    clients,
    appointments,
    photos,
    config,
    skippedPhotos: list("photos").length - withData.length,
  };
}

// ---------- API ----------

export const api = {
  async authStatus() {
    const a = await getConfig("auth");
    const token = readSession();
    return { configured: !!a, valid: !!a && !!token && (await sha256(token)) === a.session };
  },
  async setupPassword(password) {
    if (await getConfig("auth")) fail("La clave ya está creada.");
    if (String(password || "").length < MIN_LENGTH) fail(`La clave tiene que tener al menos ${MIN_LENGTH} caracteres.`);
    await newSession(await makeAuth(String(password)));
  },
  async login(password) {
    if (!(await checkPassword(password))) fail("Clave incorrecta.");
    await newSession(await getConfig("auth"));
  },
  async logout() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // idem
    }
  },
  async changePassword(current, next) {
    if (!(await checkPassword(current))) fail("La clave actual no es correcta.");
    if (String(next || "").length < MIN_LENGTH) fail(`La clave nueva tiene que tener al menos ${MIN_LENGTH} caracteres.`);
    await newSession(await makeAuth(String(next)));
  },

  // ----- caja -----
  async getEntries(date) {
    return (await getByIndex("entries", "date", date)).sort(byCreated).map(({ id, name, amount, time, serviceType, extras }) => ({
      id, name, amount, time, serviceType, extras,
    }));
  },
  async getDates() {
    const dates = new Set((await getAll("entries")).map((e) => e.date));
    return [...dates].sort().reverse();
  },
  async addEntry(date, { name, amount, time, serviceType, extras, appointmentId }) {
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) fail("Monto invalido");
    const entry = {
      id: uid(),
      date,
      name: (name || "Clienta").trim() || "Clienta",
      amount: parsedAmount,
      time: time || "",
      serviceType: serviceType || "",
      extras: Array.isArray(extras) ? extras : [],
      createdAt: stamp(),
    };
    await tx(["entries", "appointments"], "readwrite", async (s, d) => {
      s.entries.put(entry);
      // si viene de un turno ("Vino"), lo marca como atendido
      if (appointmentId) {
        const appt = await d(s.appointments.get(appointmentId));
        if (appt) s.appointments.put({ ...appt, entryId: entry.id });
      }
    });
    const { createdAt, ...out } = entry;
    return out;
  },
  async deleteEntry(id) {
    await tx(["entries", "appointments"], "readwrite", async (s, d) => {
      s.entries.delete(id);
      // el turno vuelve a quedar pendiente si se borra su cobro
      for (const appt of await d(s.appointments.index("entryId").getAll(id))) {
        s.appointments.put({ ...appt, entryId: null });
      }
    });
  },

  async getExpenses(date) {
    return (await getByIndex("expenses", "date", date)).sort(byCreated).map(({ id, description, amount }) => ({ id, description, amount }));
  },
  async addExpense(date, body) {
    const amount = Number(body.amount);
    if (!amount || amount <= 0) fail("Monto invalido");
    const expense = { id: uid(), date, description: String(body.description || "").trim() || "Gasto", amount, createdAt: stamp() };
    await put("expenses", expense);
    return { id: expense.id, description: expense.description, amount };
  },
  deleteExpense: (id) => remove("expenses", id),

  getSplit: () => readConfig("split"),
  async saveSplit({ insumos, ganancia, otro, otroLabel, otroGoal, otroGoalSince }) {
    if (Number(insumos) + Number(ganancia) + Number(otro) !== 100) fail("Los porcentajes deben sumar 100");
    const current = await readConfig("split");
    return setConfig("split", {
      insumos: Number(insumos),
      ganancia: Number(ganancia),
      otro: Number(otro),
      otroLabel: otroLabel || "Otro",
      otroGoal: otroGoal !== undefined ? Number(otroGoal) || 0 : current.otroGoal || 0,
      otroGoalSince: otroGoalSince !== undefined ? otroGoalSince : current.otroGoalSince || null,
    });
  },
  // reinicia el progreso de la meta desde hoy
  resetGoal: async () => setConfig("split", { ...(await readConfig("split")), otroGoalSince: todayStr() }),

  async getSummary(range, date) {
    const [entries, expenses] = await Promise.all([getAll("entries"), getAll("expenses")]);
    const { start, end } = range === "week" ? getWeekRange(date) : getMonthRange(date);
    const prev = getPreviousRange(range, start);
    return {
      ...buildSummary(entries, expenses, start, end),
      previous: { ...prev, ...totals(entries.filter(inRange(prev.start, prev.end))) },
    };
  },
  // total historico (o desde una fecha), para la barra de la meta
  getAllTime: async (since) => totals((await getAll("entries")).filter((e) => !since || e.date >= since)),

  // ----- configuracion -----
  getCatalog: () => readConfig("catalog"),
  async saveCatalog(catalog) {
    const cleanList = (list, withDuration) =>
      (Array.isArray(list) ? list : [])
        .map((item) => ({
          name: String(item.name || "").trim(),
          price: Math.max(0, Number(item.price) || 0),
          ...(withDuration ? { duration: Math.max(15, Number(item.duration) || 60) } : {}),
        }))
        .filter((item) => item.name);
    const services = cleanList(catalog.services, true);
    const extras = cleanList(catalog.extras, false);
    if (services.length === 0) fail("Tiene que haber al menos un servicio");
    const names = services.map((s) => s.name.toLowerCase());
    if (new Set(names).size !== names.length) fail("Hay servicios con el mismo nombre");
    return setConfig("catalog", { services, extras });
  },
  getAgendaConfig: () => readConfig("agenda"),
  async saveAgendaConfig({ start, end, daysOff }) {
    const validTime = (t) => /^\d{2}:\d{2}$/.test(t || "");
    if (!validTime(start) || !validTime(end) || start >= end) {
      fail("Revisá el horario: la entrada tiene que ser antes que la salida");
    }
    const days = (Array.isArray(daysOff) ? daysOff : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    return setConfig("agenda", { start, end, daysOff: [...new Set(days)] });
  },
  getReminderConfig: () => readConfig("reminders"),
  async saveReminderConfig({ turno, service, cumple, serviceDays }) {
    const days = Number(serviceDays);
    if (!turno || !service || !cumple || !days || days < 1) fail("Completá los mensajes y los días");
    return setConfig("reminders", { turno: String(turno), service: String(service), cumple: String(cumple), serviceDays: days });
  },

  // ----- clientas -----
  getClients: () => loadClients(),
  async addClient(body) {
    const client = { id: uid(), ...cleanClient(body), createdAt: stamp() };
    await put("clients", client);
    return (await loadClients(client.id))[0];
  },
  async updateClient(id, body) {
    const current = await get("clients", id);
    if (!current) fail("Clienta no encontrada");
    await put("clients", { ...current, ...cleanClient(body) });
    return (await loadClients(id))[0];
  },
  // borra tambien sus turnos y fotos
  async deleteClient(id) {
    const photoIds = await tx(["clients", "appointments", "photos"], "readwrite", async (s, d) => {
      s.clients.delete(id);
      for (const key of await d(s.appointments.index("clientId").getAllKeys(id))) s.appointments.delete(key);
      const keys = await d(s.photos.index("clientId").getAllKeys(id));
      for (const key of keys) s.photos.delete(key);
      return keys;
    });
    photoIds.forEach(forgetUrl);
  },
  // la imagen ya viene achicada (ver compressImage)
  async addPhoto(clientId, dataUrl) {
    if (!(await get("clients", clientId))) fail("Clienta no encontrada");
    if (!/^data:image\/jpeg;base64,/.test(dataUrl || "")) fail("Formato de imagen no soportado");
    const photo = { id: uid(), clientId, blob: await dataUrlToBlob(dataUrl), createdAt: stamp() };
    await put("photos", photo);
    urlFor(photo);
    return { id: photo.id, file: photo.id, createdAt: photo.createdAt };
  },
  async deletePhoto(id) {
    await remove("photos", id);
    forgetUrl(id);
  },

  // ----- turnos -----
  async getAppointments(from, to) {
    const [appts, clients] = await Promise.all([getAll("appointments"), getAll("clients")]);
    const byId = new Map(clients.map((c) => [c.id, c]));
    const list = appts
      .filter((a) => byId.has(a.clientId) && a.date >= (from || "0000-00-00") && a.date <= (to || "9999-99-99"))
      .sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : a.time > b.time ? 1 : 0) : a.date < b.date ? -1 : 1));
    return Promise.all(list.map((a) => appointmentView(a, byId)));
  },
  addAppointment: (appt) => saveAppointment(null, appt),
  updateAppointment: (id, appt) => saveAppointment(id, appt),
  // marca que ya se mando el recordatorio
  async markReminded(id) {
    const appt = await get("appointments", id);
    if (!appt) fail("Turno no encontrado");
    const updated = { ...appt, remindedAt: new Date().toISOString() };
    await put("appointments", updated);
    return appointmentView(updated);
  },
  deleteAppointment: (id) => remove("appointments", id),

  // ----- backup -----
  async exportCsv(table) {
    const { rows, columns } = await EXPORTS[table]();
    const keys = Object.keys(columns);
    const lines = [keys.map((k) => csvCell(columns[k])).join(";"), ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(";"))];
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    return saveFile(blob, `byemi-${table}.csv`);
  },
  // copia completa, con las fotos y sin la clave
  async exportBackup() {
    const [entries, expenses, clients, appointments, photos, config] = await Promise.all(STORES.map(getAll));
    const backup = {
      app: "byemi",
      version: 2,
      exportedAt: new Date().toISOString(),
      entries,
      expenses,
      clients,
      appointments,
      photos: await Promise.all(
        photos.map(async ({ blob, ...p }) => ({ ...p, dataUrl: await blobToDataUrl(blob) }))
      ),
      config: Object.fromEntries(config.filter((c) => c.key in DEFAULTS).map((c) => [c.key, c.value])),
    };
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const saved = await saveFile(blob, `byemi-backup-${todayStr()}.json`);
    if (saved) await setConfig("lastBackup", backup.exportedAt);
    return saved;
  },
  // reemplaza todos los datos del celular por los del archivo (la clave no se toca)
  async importBackup(file) {
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      fail("No se pudo leer el archivo.");
    }
    const b = await normalizeBackup(data);
    await tx(STORES, "readwrite", (s) => {
      for (const name of ["entries", "expenses", "clients", "appointments", "photos"]) {
        s[name].clear();
        for (const row of b[name]) s[name].put(row);
      }
      for (const row of b.config) s.config.put(row);
    });
    [...photoUrls.keys()].forEach(forgetUrl);
    return { clients: b.clients.length, entries: b.entries.length, skippedPhotos: b.skippedPhotos };
  },
  async getBackupInfo() {
    const [lastBackup, entries, clients] = await Promise.all([
      getConfig("lastBackup"),
      tx("entries", "readonly", (s, d) => d(s.entries.count())),
      tx("clients", "readonly", (s, d) => d(s.clients.count())),
    ]);
    return { lastBackup, hasData: entries + clients > 0 };
  },
};
