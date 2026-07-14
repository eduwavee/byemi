// En desarrollo, Vite corre en :5173 y el backend en :3001.
// En producción, seteá VITE_API_URL en el build (ver README) apuntando a tu backend deployado.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getEntries: (date) => request(`/api/entries/${date}`),
  getDates: () => request(`/api/entries`),
  addEntry: (date, entry) =>
    request(`/api/entries/${date}`, {
      method: "POST",
      body: JSON.stringify(entry),
    }),
  deleteEntry: (id) => request(`/api/entries/id/${id}`, { method: "DELETE" }),
  getSplit: () => request(`/api/config/split`),
  saveSplit: (split) =>
    request(`/api/config/split`, {
      method: "PUT",
      body: JSON.stringify(split),
    }),
  getSummary: (range, date) => request(`/api/summary/${range}/${date}`),
  getAllTime: (since) => request(`/api/summary/alltime${since ? `?since=${since}` : ""}`),
  resetGoal: () => request(`/api/config/split/reset-goal`, { method: "POST" }),
};
