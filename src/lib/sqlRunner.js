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

// Finds the closing parenthesis for the one at `open`, skipping quoted text.
const matchParen = (sql, open) => {
  let depth = 0;
  for (let i = open; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" || ch === '"') {
      const q = ch;
      i++;
      while (i < sql.length && !(sql[i] === q && sql[i + 1] !== q)) i += sql[i] === q ? 2 : 1;
    } else if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return i;
  }
  return -1;
};

const literal = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return `'${String(v instanceof Date ? v.toISOString().slice(0, 10) : v).replace(/'/g, "''")}'`;
};

// alasql re-runs a scalar subquery such as (SELECT AVG(amount) FROM orders)
// once for every outer row, which takes tens of seconds on 10,000 rows. A
// subquery that runs on its own (so it does not refer to the outer query) and
// returns one value is computed once and replaced by that value. Correlated
// subqueries fail when run alone and are left as written. Only subqueries
// used as a value (after a comparison or arithmetic operator) are touched,
// never FROM (SELECT …), IN (SELECT …) or EXISTS (SELECT …).
export const hoistScalarSubqueries = (sql, run) => {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'" || ch === '"') {
      let end = i + 1;
      while (end < sql.length && !(sql[end] === ch && sql[end + 1] !== ch)) end += sql[end] === ch ? 2 : 1;
      out += sql.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    if (ch === '(' && /^\(\s*SELECT\b/i.test(sql.slice(i, i + 12))) {
      const close = matchParen(sql, i);
      if (close < 0) { out += sql.slice(i); break; }
      const inner = hoistScalarSubqueries(sql.slice(i + 1, close), run);
      const before = out.trimEnd();
      const asValue = /(=|<|>|\+|-|\*|\/)$/.test(before);
      let replaced = null;
      if (asValue) {
        try {
          const res = run(inner);
          if (Array.isArray(res) && res.length <= 1) {
            const vals = res.length ? Object.values(res[0]) : [null];
            if (vals.length === 1) replaced = literal(vals[0]);
          }
        } catch { /* correlated or invalid: leave it to the full query */ }
      }
      out += replaced !== null ? replaced : `(${inner})`;
      i = close + 1;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
};

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
    const ready = hoistScalarSubqueries(rewriteMinMax(sql), (sub) => db.exec(sub));
    res = db.exec(ready);
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
