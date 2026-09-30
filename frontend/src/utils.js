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

export const SERVICE_TYPES = ["Kapping", "Softgel", "Esculpidas", "Esculpidas Híbridas"];
export const EXTRAS_OPTIONS = ["Largo L/XL", "Extensión de uñas", "Remoción colega"];

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
