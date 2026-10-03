// Minimal IndexedDB key/value stores, for data much larger than localStorage
// allows: uploaded SQL tables ("tables") and the user's own orders ("kv").
// Falls back to memory without IndexedDB.
const DB = 'workx';
const TABLES = 'tables';
const KV = 'kv';
const memory = { [TABLES]: new Map(), [KV]: new Map() };

const open = () => new Promise((resolve) => {
  if (typeof indexedDB === 'undefined') { resolve(null); return; }
  const req = indexedDB.open(DB, 2);
  req.onupgradeneeded = () => {
    const db = req.result;
    [TABLES, KV].forEach(name => { if (!db.objectStoreNames.contains(name)) db.createObjectStore(name); });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => resolve(null);
});

// Runs `work(store)` inside a transaction and resolves when it commits.
const transact = async (storeName, mode, work) => {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    let value;
    work(tx.objectStore(storeName), v => { value = v; });
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('The browser refused to save, it may be out of storage space')); };
  });
};

const getAll = async (storeName) => {
  const result = await transact(storeName, 'readonly', (store, done) => {
    const out = {};
    const req = store.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) { out[cur.key] = cur.value; cur.continue(); } else done(out);
    };
  });
  return result === null ? Object.fromEntries(memory[storeName]) : result || {};
};

const setKey = async (storeName, key, value) => {
  const r = await transact(storeName, 'readwrite', store => store.put(value, key));
  if (r === null) memory[storeName].set(key, value);
};

const deleteKey = async (storeName, key) => {
  const r = await transact(storeName, 'readwrite', store => store.delete(key));
  if (r === null) memory[storeName].delete(key);
};

export const idbGetAll = () => getAll(TABLES);
export const idbSet = (key, value) => setKey(TABLES, key, value);
export const idbDelete = (key) => deleteKey(TABLES, key);

export const kvGet = async (key) => {
  const r = await transact(KV, 'readonly', (store, done) => {
    const req = store.get(key);
    req.onsuccess = () => done(req.result);
  });
  return r === null ? memory[KV].get(key) : r;
};
export const kvSet = (key, value) => setKey(KV, key, value);
export const kvDelete = (key) => deleteKey(KV, key);

export const idbClear = async () => {
  for (const name of [TABLES, KV]) {
    const r = await transact(name, 'readwrite', store => store.clear());
    if (r === null) memory[name].clear();
  }
};
