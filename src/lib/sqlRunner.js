import alasql from 'alasql';

// alasql's built in MIN and MAX ignore text, so MAX(week_start) or MIN(date)
// silently return nothing. These aggregates compare any value (numbers,
// ISO dates, text) and skip blanks, and runSql routes MIN( and MAX( to them.
const pick = (better) => (value, acc, stage) => {
  const ok = (x) => x !== null && x !== undefined && x !== '' && !(typeof x === 'number' && Number.isNaN(x));
  if (stage === 1) return ok(value) ? value : undefined;
  if (stage === 2) {
    if (!ok(value)) return acc;
    if (acc === undefined) return value;
    return better(value, acc) ? value : acc;
  }
  return acc;
};
alasql.aggr.WX_MIN = pick((a, b) => a < b);
alasql.aggr.WX_MAX = pick((a, b) => a > b);

// Rewrites MIN( and MAX( outside quoted strings.
export const rewriteMinMax = (sql) => sql
  .split(/('(?:[^']|'')*'|"(?:[^"]|"")*")/)
  .map((part, i) => (i % 2 ? part : part.replace(/\b(MIN|MAX)\s*\(/gi, (m, f) => `WX_${f.toUpperCase()}(`)))
  .join('');

// Runs SQL against a fresh in-memory database built from `tables` so queries
// can never change app data. Returns rows (array of objects).
export const runSql = (sql, tables) => {
  const db = new alasql.Database();
  Object.entries(tables).forEach(([name, rows]) => {
    db.exec(`CREATE TABLE \`${name}\``);
    db.tables[name].data = (rows || []).map(r => ({ ...r }));
  });
  let res;
  try {
    res = db.exec(rewriteMinMax(sql));
  } catch (e) {
    e.message = String(e.message).replace(/WX_(MIN|MAX)/g, '$1');
    throw e;
  }
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
