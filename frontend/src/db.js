// Base de datos local del celular (IndexedDB). Reemplaza al backend:
// todo lo que antes guardaba el servidor ahora vive en el navegador de la app instalada.

const DB_NAME = "byemi";
const DB_VERSION = 1;

export const STORES = ["entries", "expenses", "clients", "appointments", "photos", "config"];

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const make = (name, indexes = []) => {
        if (db.objectStoreNames.contains(name)) return;
        const store = db.createObjectStore(name, { keyPath: name === "config" ? "key" : "id" });
        for (const field of indexes) store.createIndex(field, field);
      };
      make("entries", ["date"]);
      make("expenses", ["date"]);
      make("clients");
      make("appointments", ["date", "clientId", "entryId"]);
      make("photos", ["clientId"]);
      make("config");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // si falla (por ejemplo, modo privado), se reintenta la proxima vez
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

const done = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

// corre fn dentro de una transaccion y espera a que se confirme en disco
export async function tx(storeNames, mode, fn) {
  const db = await open();
  const t = db.transaction(storeNames, mode);
  const stores = Object.fromEntries([].concat(storeNames).map((n) => [n, t.objectStore(n)]));
  const finished = new Promise((resolve, reject) => {
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("Transacción cancelada"));
  });
  try {
    const result = await fn(stores, done);
    await finished;
    return result;
  } catch (err) {
    finished.catch(() => {});
    try {
      t.abort(); // no deja cambios a medias
    } catch {
      // ya estaba terminada
    }
    throw err;
  }
}

export const getAll = (store) => tx(store, "readonly", (s, d) => d(s[store].getAll()));
export const getByIndex = (store, index, value) =>
  tx(store, "readonly", (s, d) => d(s[store].index(index).getAll(value)));
export const get = (store, key) => tx(store, "readonly", (s, d) => d(s[store].get(key)));
export const put = (store, value) => tx(store, "readwrite", (s, d) => d(s[store].put(value))).then(() => value);
export const remove = (store, key) => tx(store, "readwrite", (s, d) => d(s[store].delete(key)));

export async function getConfig(key) {
  const row = await get("config", key);
  return row ? row.value : null;
}

export const setConfig = (key, value) => put("config", { key, value }).then(() => value);

// pide al navegador que no borre los datos aunque falte espacio
export function askPersistentStorage() {
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    // navegadores viejos
  }
}

// randomUUID solo existe en https; en la red local (http) se usa el fallback
export const uid = () =>
  crypto.randomUUID?.() ||
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

// marca de tiempo que nunca se repite, para ordenar por orden de carga
let lastMs = 0;
export function stamp() {
  lastMs = Math.max(Date.now(), lastMs + 1);
  return new Date(lastMs).toISOString();
}
