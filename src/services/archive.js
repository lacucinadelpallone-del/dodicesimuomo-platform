// IndexedDB — nessun limite di spazio come localStorage
const DB_NAME    = 'dodicesimuomo_archive';
const DB_VERSION = 1;
const STORE      = 'graphics';

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onerror = () => rej(r.error);
    r.onsuccess = () => res(r.result);
    r.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

export async function archiveSave(entry) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const s = db.transaction(STORE, 'readwrite').objectStore(STORE);
    const r = s.add({ ...entry, savedAt: Date.now() });
    r.onsuccess = () => res(r.result); // restituisce l'id generato
    r.onerror   = () => rej(r.error);
  });
}

export async function archiveGetAll() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    r.onsuccess = () => res([...r.result].reverse()); // più recente prima
    r.onerror   = () => rej(r.error);
  });
}

export async function archiveUpdate(id, patch) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const s  = db.transaction(STORE, 'readwrite').objectStore(STORE);
    const rg = s.get(id);
    rg.onsuccess = () => {
      const rp = s.put({ ...rg.result, ...patch });
      rp.onsuccess = () => res();
      rp.onerror   = () => rej(rp.error);
    };
    rg.onerror = () => rej(rg.error);
  });
}

export async function archiveDelete(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    r.onsuccess = () => res();
    r.onerror   = () => rej(r.error);
  });
}
