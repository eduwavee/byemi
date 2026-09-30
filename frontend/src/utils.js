export const toLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const parseDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const fmtMoney = (n) => "$" + Math.round(n || 0).toLocaleString("es-AR");

export const fmtDateLabel = (dateStr) =>
  parseDate(dateStr).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

export const fmtShortDate = (dateStr) =>
  parseDate(dateStr).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });

// dias enteros entre dos fechas YYYY-MM-DD (b - a)
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

export const addDays = (dateStr, n) => {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toLocalDateStr(d);
};

export const lastVisitLabel = (lastVisit, today) => {
  if (!lastVisit) return "Sin visitas registradas";
  const days = daysBetween(lastVisit, today);
  if (days <= 0) return "Vino hoy";
  if (days === 1) return "Vino ayer";
  if (days < 14) return `Vino hace ${days} días`;
  return `Vino hace ${Math.floor(days / 7)} semanas`;
};

export const DEFAULT_CATALOG = {
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
};

export const DEFAULT_AGENDA = { start: "09:00", end: "19:00", daysOff: [0] };

// precio sugerido: servicio + extras (0 si no hay precios cargados)
export const suggestedPrice = (catalog, service, extras = []) => {
  const s = catalog.services.find((x) => x.name === service);
  const extrasTotal = extras.reduce(
    (sum, name) => sum + (catalog.extras.find((x) => x.name === name)?.price || 0),
    0
  );
  return (s?.price || 0) + extrasTotal;
};

export const serviceDuration = (catalog, service) =>
  catalog.services.find((x) => x.name === service)?.duration || 90;

// ---------- horas ----------

export const timeToMin = (t) => {
  const [h, m] = String(t || "0:0").split(":").map(Number);
  return h * 60 + m;
};
export const minToTime = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// lunes de la semana que contiene la fecha
export const weekStart = (dateStr) => {
  const d = parseDate(dateStr);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return toLocalDateStr(d);
};

// ---------- cumpleaños (MM-DD) ----------

export const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export const fmtBirthday = (mmdd) => {
  if (!mmdd) return "";
  const [m, d] = mmdd.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
};

// dias que faltan para el proximo cumple (0 = hoy)
export const daysToBirthday = (mmdd, today) => {
  if (!mmdd) return null;
  const [m, d] = mmdd.split("-").map(Number);
  const t = parseDate(today);
  let next = new Date(t.getFullYear(), m - 1, d);
  if (next < t) next = new Date(t.getFullYear() + 1, m - 1, d);
  return Math.round((next - t) / 86400000);
};

// ---------- fotos ----------

// achica la foto en el celu antes de subirla (lado mayor 1400px, JPEG)
export async function compressImage(file, maxSide = 1400, quality = 0.82) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

// arma el numero para wa.me. Asume Argentina si no trae codigo de pais.
export const toWhatsAppNumber = (phone) => {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("54")) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 10 ? `549${digits}` : digits;
};

export const whatsAppLink = (phone, text) => {
  const num = toWhatsAppNumber(phone);
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return num ? `https://wa.me/${num}${query}` : "";
};

export const fillTemplate = (template, vars) =>
  template.replace(/\{(\w+)\}/g, (match, key) => (vars[key] !== undefined ? vars[key] : match));

export const firstName = (name) => String(name || "").trim().split(/\s+/)[0];
