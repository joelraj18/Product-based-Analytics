// Minimal IndexedDB key/value store for uploaded tables, which can be much
// larger than localStorage allows. Falls back to memory without IndexedDB.
const DB = 'workx';
const STORE = 'tables';
const memory = new Map();

const open = () => new Promise((resolve) => {
  if (typeof indexedDB === 'undefined') { resolve(null); return; }
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE);
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => resolve(null);
});

// Runs `work(store)` inside a transaction and resolves when it commits.
const transact = async (mode, work) => {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let value;
    work(tx.objectStore(STORE), v => { value = v; });
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('The browser refused to save, it may be out of storage space')); };
  });
};

export const idbGetAll = async () => {
  const result = await transact('readonly', (store, done) => {
    const out = {};
    const req = store.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) { out[cur.key] = cur.value; cur.continue(); } else done(out);
    };
  });
  return result === null ? Object.fromEntries(memory) : result || {};
};

export const idbSet = async (key, value) => {
  const r = await transact('readwrite', store => store.put(value, key));
  if (r === null) memory.set(key, value);
};

export const idbDelete = async (key) => {
  const r = await transact('readwrite', store => store.delete(key));
  if (r === null) memory.delete(key);
};

export const idbClear = async () => {
  const r = await transact('readwrite', store => store.clear());
  if (r === null) memory.clear();
};
