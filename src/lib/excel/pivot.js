// Pivot table: group rows by up to two fields and summarise one value field.
import { minOf, maxOf } from '../stats';
export const AGGREGATIONS = ['Sum', 'Count', 'Average', 'Min', 'Max', 'Distinct count'];

const isBlank = (v) => v === null || v === undefined || v === '';
const keyOf = (v) => (isBlank(v) ? '(blank)' : String(v));
const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

const summarise = (values, agg) => {
  if (agg === 'Count') return values.filter(v => !isBlank(v)).length;
  if (agg === 'Distinct count') return new Set(values.filter(v => !isBlank(v)).map(String)).size;
  const n = values.map(num).filter(v => v !== null);
  if (agg === 'Sum') return n.reduce((s, x) => s + x, 0);
  if (!n.length) return null;
  if (agg === 'Average') return n.reduce((s, x) => s + x, 0) / n.length;
  if (agg === 'Min') return minOf(n);
  if (agg === 'Max') return maxOf(n);
  return null;
};

const sortKeys = (keys) => [...keys].sort((a, b) => {
  const x = Number(a);
  const y = Number(b);
  if (a !== '(blank)' && b !== '(blank)' && Number.isFinite(x) && Number.isFinite(y)) return x - y;
  return a.localeCompare(b);
});

// config: { rows, cols?, value, agg, filterField?, filterValue?, percent? }
// Returns { rowKeys, colKeys, cell(r, c), rowTotal(r), colTotal(c), grand }.
export const buildPivot = (data, config) => {
  const { rows: rf, cols: cf, value: vf, agg = 'Sum', filterField, filterValue, percent } = config;
  const source = filterField && !isBlank(filterValue) ? data.filter(r => keyOf(r[filterField]) === String(filterValue)) : data;
  const groups = new Map();
  const add = (k, v) => { if (!groups.has(k)) groups.set(k, []); groups.get(k).push(v); };
  const rowKeys = new Set();
  const colKeys = new Set();
  source.forEach(r => {
    const rk = rf ? keyOf(r[rf]) : 'Total';
    const ck = cf ? keyOf(r[cf]) : '';
    rowKeys.add(rk);
    colKeys.add(ck);
    const v = r[vf];
    add(`${rk}\u0000${ck}`, v);
    add(`${rk}\u0000*`, v);
    add(`*\u0000${ck}`, v);
    add('*\u0000*', v);
  });
  const raw = (rk, ck) => summarise(groups.get(`${rk}\u0000${ck}`) || [], agg);
  const grandRaw = raw('*', '*');
  const show = (v) => (percent && v !== null && grandRaw ? v / grandRaw : v);
  return {
    rowKeys: sortKeys(rowKeys),
    colKeys: cf ? sortKeys(colKeys) : [''],
    cell: (rk, ck) => (groups.has(`${rk}\u0000${ck}`) ? show(raw(rk, ck)) : null),
    rowTotal: (rk) => show(raw(rk, '*')),
    colTotal: (ck) => show(raw('*', ck)),
    grand: show(grandRaw),
    count: source.length,
  };
};

// Flat rows for display, CSV export and grading.
export const pivotRows = (p, config) => {
  const label = config.rows || 'Rows';
  const out = p.rowKeys.map(rk => {
    const row = { [label]: rk };
    if (config.cols) p.colKeys.forEach(ck => { row[ck] = p.cell(rk, ck); });
    row['Grand Total'] = p.rowTotal(rk);
    return row;
  });
  const total = { [label]: 'Grand Total' };
  if (config.cols) p.colKeys.forEach(ck => { total[ck] = p.colTotal(ck); });
  total['Grand Total'] = p.grand;
  return [...out, total];
};

// True when two pivots show the same numbers for the same labels.
export const samePivot = (a, b) => {
  const flatten = (rows) => {
    const m = new Map();
    rows.forEach(r => {
      const [labelKey, ...rest] = Object.keys(r);
      rest.forEach(k => m.set(`${r[labelKey]}|${k}`, r[k]));
    });
    return m;
  };
  const x = flatten(a);
  const y = flatten(b);
  if (x.size !== y.size) return false;
  for (const [k, v] of x) {
    if (!y.has(k)) return false;
    const w = y.get(k);
    if (v === null || w === null ? v !== w : Math.abs(v - w) > 1e-6 * Math.max(1, Math.abs(v))) return false;
  }
  return true;
};

// The worksheet formula that reproduces one pivot cell.
export const equivalentFormula = (config, colOf, rk, ck, lastRow) => {
  const rng = (f) => `${colOf(f)}2:${colOf(f)}${lastRow}`;
  const crit = [];
  if (config.rows && rk !== undefined) crit.push(`${rng(config.rows)},"${rk}"`);
  if (config.cols && ck !== undefined && ck !== '') crit.push(`${rng(config.cols)},"${ck}"`);
  if (config.filterField && !isBlank(config.filterValue)) crit.push(`${rng(config.filterField)},"${config.filterValue}"`);
  const v = rng(config.value);
  const c = crit.join(',');
  switch (config.agg) {
    case 'Count': return crit.length ? `=COUNTIFS(${c})` : `=COUNTA(${v})`;
    case 'Average': return crit.length ? `=AVERAGEIFS(${v},${c})` : `=AVERAGE(${v})`;
    case 'Min': return crit.length ? `=MINIFS(${v},${c})` : `=MIN(${v})`;
    case 'Max': return crit.length ? `=MAXIFS(${v},${c})` : `=MAX(${v})`;
    case 'Distinct count': return crit.length ? `=ROWS(UNIQUE(FILTER(${v},${crit.map(x => { const [r, val] = x.split(','); return `(${r}=${val})`; }).join('*')})))` : `=ROWS(UNIQUE(${v}))`;
    default: return crit.length ? `=SUMIFS(${v},${c})` : `=SUM(${v})`;
  }
};
