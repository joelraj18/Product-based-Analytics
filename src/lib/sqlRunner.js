import alasql from 'alasql';

// Runs SQL against a fresh in-memory database built from `tables` so queries
// can never change app data. Returns rows (array of objects).
export const runSql = (sql, tables) => {
  const db = new alasql.Database();
  Object.entries(tables).forEach(([name, rows]) => {
    db.exec(`CREATE TABLE \`${name}\``);
    db.tables[name].data = (rows || []).map(r => ({ ...r }));
  });
  const res = db.exec(sql);
  // Several statements return an array of results: show the last one.
  const last = Array.isArray(res) && res.length && Array.isArray(res[res.length - 1]) && /;\s*\S/.test(sql) ? res[res.length - 1] : res;
  return Array.isArray(last) ? last.map(r => (r !== null && typeof r === 'object' ? r : { value: r })) : [{ result: last }];
};

const norm = (v) => {
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  if (v === null || v === undefined) return '';
  const n = Number(v);
  return typeof v === 'string' && v.trim() !== '' && Number.isFinite(n) ? Math.round(n * 100) / 100 : String(v).trim();
};

// Compares two result sets by values (column names/aliases may differ).
export const sameResult = (a, b, ordered = false) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const rows = (x) => x.map(r => JSON.stringify(Object.values(r).map(norm)));
  const ra = rows(a);
  const rb = rows(b);
  if (!ordered) { ra.sort(); rb.sort(); }
  return ra.every((r, i) => r === rb[i]);
};
