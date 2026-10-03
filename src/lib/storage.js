import { idbGetAll, idbSet, idbClear } from './idb';

export const PREFIX = 'workx_';

export const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const save = (key, value) => {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    // Quota exceeded or storage disabled; app keeps working in memory and
    // the shell tells the user once (see App.jsx).
    try { window.dispatchEvent(new CustomEvent('workx-storage-full', { detail: { key } })); } catch { /* non-browser */ }
    return false;
  }
};

export const remove = (key) => {
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
};

const workspaceKeys = () => {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      // Accounts (workx_user_*) survive backup/reset of workspace data.
      if (k && k.startsWith(PREFIX) && !k.startsWith(PREFIX + 'user_')) keys.push(k);
    }
  } catch { /* ignore */ }
  return keys;
};

export const exportBackup = () => {
  const data = {};
  workspaceKeys().forEach(k => {
    if (k === PREFIX + 'current_user') return;
    try { data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)); } catch { /* skip corrupt */ }
  });
  return { app: 'workx', version: 2, exportedAt: new Date().toISOString(), data };
};

export const importBackup = (backup) => {
  if (!backup || backup.app !== 'workx' || typeof backup.data !== 'object' || backup.data === null) {
    throw new Error('Not a valid WorkX backup file');
  }
  Object.entries(backup.data).forEach(([k, v]) => {
    if (k.startsWith('user_') || k === 'current_user') return;
    save(k, v);
  });
  return Object.keys(backup.data).length;
};

// Uploaded SQL tables live in IndexedDB; backups carry them under user_tables.
export const exportBackupWithTables = async () => {
  const backup = exportBackup();
  try { backup.data.user_tables = await idbGetAll(); } catch { /* skip if unavailable */ }
  return backup;
};

export const importBackupWithTables = async (backup) => {
  const tables = backup && backup.data && backup.data.user_tables;
  const rest = tables ? { ...backup, data: Object.fromEntries(Object.entries(backup.data).filter(([k]) => k !== 'user_tables')) } : backup;
  const count = importBackup(rest);
  if (tables && typeof tables === 'object') {
    await Promise.all(Object.entries(tables).map(([name, t]) => idbSet(name, t)));
  }
  return count + (tables ? 1 : 0);
};

export const resetWorkspace = async () => {
  workspaceKeys().forEach(k => {
    if (k === PREFIX + 'current_user') return;
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  });
  try { await idbClear(); } catch { /* ignore */ }
};
