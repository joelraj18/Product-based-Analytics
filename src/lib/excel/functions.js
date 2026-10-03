// Excel worksheet functions. Each receives lazy argument thunks and an env
// ({ sheet, node, ctx }); call args[i]() to evaluate argument i.
import {
  XErr, err, NA, VALUE, DIV0, NUM, isErr, isArr, isBlank, toNum, toStr, toBool, compareValues,
  toGrid, dims, flat, single, broadcast, mapValue, ISO, isoToSerial, dateToSerial, serialToDate, serialToIso, formatNumber,
} from './values';

const F = {};
const throwIf = (v) => { if (isErr(v)) throw v; return v; };
const arg = (args, i, dflt) => (args[i] ? args[i]() : dflt);
const numArg = (args, i, dflt) => {
  const v = arg(args, i, dflt);
  if (v === undefined) return dflt;
  return throwIf(toNum(single(v)));
};
const strArg = (args, i, dflt = '') => { const v = arg(args, i, dflt); return throwIf(toStr(single(v))); };
const fromRange = (env, i) => { const t = env.node.args[i] && env.node.args[i].t; return t === 'range' || t === 'ref' || t === 'fn' || t === 'name'; };

// Numbers for aggregates: text and booleans inside ranges are ignored,
// typed literals are coerced, errors propagate.
const numbers = (args, env) => {
  const out = [];
  args.forEach((a, i) => {
    const v = a();
    if (isArr(v) || fromRange(env, i)) {
      flat(v).forEach(x => {
        if (isErr(x)) throw x;
        if (typeof x === 'number') out.push(x);
        else if (typeof x === 'string' && ISO.test(x)) out.push(isoToSerial(x)); // dates are numbers in Excel
      });
    } else {
      if (isBlank(v)) return;
      out.push(throwIf(toNum(v)));
    }
  });
  return out;
};

// ───── Math and statistics ─────
F.SUM = (a, e) => numbers(a, e).reduce((s, x) => s + x, 0);
F.AVERAGE = (a, e) => { const n = numbers(a, e); return n.length ? n.reduce((s, x) => s + x, 0) / n.length : DIV0(); };
F.MIN = (a, e) => { const n = numbers(a, e); return n.length ? Math.min(...n) : 0; };
F.MAX = (a, e) => { const n = numbers(a, e); return n.length ? Math.max(...n) : 0; };
F.COUNT = (a) => a.reduce((s, t) => s + flat(t()).filter(x => typeof x === 'number' || (typeof x === 'string' && ISO.test(x))).length, 0);
F.COUNTA = (a) => a.reduce((s, t) => s + flat(t()).filter(x => !isBlank(x)).length, 0);
F.COUNTBLANK = (a) => flat(a[0]()).filter(isBlank).length;
F.PRODUCT = (a, e) => numbers(a, e).reduce((s, x) => s * x, 1);
F.MEDIAN = (a, e) => {
  const n = numbers(a, e).sort((x, y) => x - y);
  if (!n.length) return NUM();
  const m = Math.floor(n.length / 2);
  return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2;
};
const stdev = (n, sample) => {
  if (n.length < (sample ? 2 : 1)) return DIV0();
  const mean = n.reduce((s, x) => s + x, 0) / n.length;
  return Math.sqrt(n.reduce((s, x) => s + (x - mean) ** 2, 0) / (n.length - (sample ? 1 : 0)));
};
F['STDEV.S'] = (a, e) => stdev(numbers(a, e), true);
F.STDEV = F['STDEV.S'];
F['STDEV.P'] = (a, e) => stdev(numbers(a, e), false);
const roundTo = (x, d, mode) => {
  const f = 10 ** d;
  const v = x * f;
  const r = mode === 'up' ? Math.sign(v) * Math.ceil(Math.abs(v) - 1e-9) : mode === 'down' ? Math.sign(v) * Math.floor(Math.abs(v) + 1e-9) : Math.sign(v) * Math.round(Math.abs(v) + 1e-9);
  return r / f;
};
const lift1 = (fn) => (a, e) => mapValue(a[0](), v => { try { return fn(throwIf(toNum(v)), a, e); } catch (x) { return x instanceof XErr ? x : VALUE(); } });
F.ROUND = lift1((x, a) => roundTo(x, numArg(a, 1, 0)));
F.ROUNDUP = lift1((x, a) => roundTo(x, numArg(a, 1, 0), 'up'));
F.ROUNDDOWN = lift1((x, a) => roundTo(x, numArg(a, 1, 0), 'down'));
F.INT = lift1(x => Math.floor(x));
F.ABS = lift1(x => Math.abs(x));
F.SQRT = lift1(x => (x < 0 ? NUM() : Math.sqrt(x)));
F.MOD = (a) => { const n = numArg(a, 0); const d = numArg(a, 1); return d === 0 ? DIV0() : n - d * Math.floor(n / d); };
F.POWER = (a) => numArg(a, 0) ** numArg(a, 1);
F.SIGN = lift1(x => Math.sign(x));
F.CEILING = (a) => { const x = numArg(a, 0); const s = numArg(a, 1, 1); return s === 0 ? 0 : Math.ceil(x / s) * s; };
F.FLOOR = (a) => { const x = numArg(a, 0); const s = numArg(a, 1, 1); return s === 0 ? 0 : Math.floor(x / s) * s; };
F.SUMPRODUCT = (a) => {
  const grids = a.map(t => toGrid(t()));
  const [r, c] = dims(grids[0]);
  if (grids.some(g => dims(g)[0] !== r || dims(g)[1] !== c)) return VALUE();
  let s = 0;
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) {
    let p = 1;
    for (const g of grids) { const v = g[i][j]; if (isErr(v)) return v; p *= typeof v === 'number' ? v : typeof v === 'boolean' && grids.length === 1 ? Number(v) : typeof v === 'boolean' ? 0 : 0; }
    s += p;
  }
  return s;
};
const kth = (a, e, largest) => {
  const n = flat(a[0]()).filter(x => typeof x === 'number').sort((x, y) => (largest ? y - x : x - y));
  const k = numArg(a, 1);
  return k < 1 || k > n.length ? NUM() : n[Math.floor(k) - 1];
};
F.LARGE = (a, e) => kth(a, e, true);
F.SMALL = (a, e) => kth(a, e, false);
F['RANK.EQ'] = (a) => {
  const x = numArg(a, 0);
  const n = flat(a[1]()).filter(v => typeof v === 'number');
  const asc = numArg(a, 2, 0) !== 0;
  if (!n.includes(x)) return NA();
  return 1 + n.filter(v => (asc ? v < x : v > x)).length;
};
F.RANK = F['RANK.EQ'];
F['PERCENTILE.INC'] = (a) => {
  const n = flat(a[0]()).filter(v => typeof v === 'number').sort((x, y) => x - y);
  const k = numArg(a, 1);
  if (!n.length || k < 0 || k > 1) return NUM();
  const idx = (n.length - 1) * k;
  const lo = Math.floor(idx);
  return n[lo] + (n[Math.min(lo + 1, n.length - 1)] - n[lo]) * (idx - lo);
};
F.PERCENTILE = F['PERCENTILE.INC'];
F.RAND = () => Math.random();
F.RANDBETWEEN = (a) => { const lo = Math.ceil(numArg(a, 0)); const hi = Math.floor(numArg(a, 1)); return lo + Math.floor(Math.random() * (hi - lo + 1)); };

// ───── Criteria (SUMIFS, COUNTIFS…) ─────
const wildcard = (pattern) => {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '~' && (pattern[i + 1] === '*' || pattern[i + 1] === '?' || pattern[i + 1] === '~')) { out += `\\${pattern[++i]}`; continue; }
    if (ch === '*') out += '.*';
    else if (ch === '?') out += '.';
    else out += ch.replace(/[.+^${}()|[\]\\*?]/g, '\\$&');
  }
  return new RegExp(`^${out}$`, 'i');
};
export const matcher = (criterion) => {
  if (isErr(criterion)) throw criterion;
  if (typeof criterion === 'number' || typeof criterion === 'boolean') return v => compareValues(typeof v === 'string' && ISO.test(v) ? isoToSerial(v) : v, criterion) === 0 && !isBlank(v);
  const s = isBlank(criterion) ? '' : String(criterion);
  const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(s);
  const op = m[1] || '=';
  const raw = m[2];
  let target = raw;
  const asNum = toNum(raw);
  const numeric = raw.trim() !== '' && !isErr(asNum);
  if (numeric) target = asNum;
  if (op === '=' && raw === '') return v => isBlank(v);
  if (op === '<>' && raw === '') return v => !isBlank(v);
  return (v) => {
    if (isErr(v)) return false;
    if (numeric) {
      const x = typeof v === 'number' ? v : typeof v === 'string' && ISO.test(v) ? isoToSerial(v) : null;
      if (x === null) return op === '<>';
      const c = x - target;
      return { '=': c === 0, '<>': c !== 0, '<': c < 0, '>': c > 0, '<=': c <= 0, '>=': c >= 0 }[op];
    }
    if (op === '=' || op === '<>') {
      const hit = typeof v === 'string' && wildcard(raw).test(v);
      return op === '=' ? hit : !hit;
    }
    if (typeof v !== 'string') return false;
    const c = compareValues(v, raw);
    return { '<': c < 0, '>': c > 0, '<=': c <= 0, '>=': c >= 0 }[op];
  };
};
// Indices of cells that satisfy every (range, criterion) pair.
const matching = (pairs) => {
  const grids = pairs.map(([r]) => flat(r));
  const n = grids[0].length;
  if (grids.some(g => g.length !== n)) throw VALUE();
  const tests = pairs.map(([, c]) => matcher(c));
  const out = [];
  for (let i = 0; i < n; i++) if (tests.every((t, k) => t(grids[k][i]))) out.push(i);
  return out;
};
const pairsFrom = (a, start) => {
  const pairs = [];
  for (let i = start; i < a.length; i += 2) pairs.push([a[i](), a[i + 1] ? a[i + 1]() : null]);
  return pairs;
};
const nums = (vals) => vals.filter(v => typeof v === 'number');
// An array of criteria returns an array of answers, e.g. COUNTIFS(E:E, UNIQUE(E:E)).
const overCriteria = (pairs, compute) => {
  const k = pairs.findIndex(([, c]) => isArr(c));
  if (k < 0) return compute(matching(pairs));
  return mapValue(pairs[k][1], c => overCriteria(pairs.map((p, i) => (i === k ? [p[0], c] : p)), compute));
};
const sumOf = (n) => n.reduce((s, x) => s + x, 0);
const avgOf = (n) => (n.length ? sumOf(n) / n.length : DIV0());
const pick = (vals, idx) => nums(idx.map(i => vals[i]));
F.COUNTIF = (a) => overCriteria([[a[0](), a[1]()]], idx => idx.length);
F.COUNTIFS = (a) => overCriteria(pairsFrom(a, 0), idx => idx.length);
F.SUMIF = (a) => { const range = a[0](); const vals = flat(a[2] ? a[2]() : range); return overCriteria([[range, a[1]()]], idx => sumOf(pick(vals, idx))); };
F.SUMIFS = (a) => { const vals = flat(a[0]()); return overCriteria(pairsFrom(a, 1), idx => sumOf(pick(vals, idx))); };
F.AVERAGEIF = (a) => { const range = a[0](); const vals = flat(a[2] ? a[2]() : range); return overCriteria([[range, a[1]()]], idx => avgOf(pick(vals, idx))); };
F.AVERAGEIFS = (a) => { const vals = flat(a[0]()); return overCriteria(pairsFrom(a, 1), idx => avgOf(pick(vals, idx))); };
F.MAXIFS = (a) => { const vals = flat(a[0]()); return overCriteria(pairsFrom(a, 1), idx => { const n = pick(vals, idx); return n.length ? Math.max(...n) : 0; }); };
F.MINIFS = (a) => { const vals = flat(a[0]()); return overCriteria(pairsFrom(a, 1), idx => { const n = pick(vals, idx); return n.length ? Math.min(...n) : 0; }); };

// ───── Logic ─────
F.IF = (a) => {
  const cond = a[0]();
  const pick = (c) => {
    if (isErr(c)) return c;
    const b = toBool(c);
    if (isErr(b)) return b;
    return b ? (a[1] ? a[1]() : true) : (a[2] ? a[2]() : false);
  };
  if (!isArr(cond)) return pick(cond);
  const yes = a[1] ? a[1]() : true;
  const no = a[2] ? a[2]() : false;
  return broadcast(broadcast(cond, yes, (c, y) => [c, y]), no, ([c, y], n) => {
    if (isErr(c)) return c;
    const b = toBool(c);
    return isErr(b) ? b : b ? y : n;
  });
};
F.IFS = (a) => {
  for (let i = 0; i < a.length; i += 2) {
    const c = single(a[i]());
    if (isErr(c)) return c;
    if (throwIf(toBool(c))) return a[i + 1]();
  }
  return NA();
};
const bools = (a) => a.flatMap(t => flat(t())).filter(v => !isBlank(v) && typeof v !== 'string').map(v => throwIf(toBool(v)));
F.AND = (a) => { const b = bools(a); return b.length ? b.every(Boolean) : VALUE(); };
F.OR = (a) => { const b = bools(a); return b.length ? b.some(Boolean) : VALUE(); };
F.XOR = (a) => bools(a).filter(Boolean).length % 2 === 1;
F.NOT = (a) => mapValue(a[0](), v => { const b = toBool(v); return isErr(b) ? b : !b; });
F.TRUE = () => true;
F.FALSE = () => false;
F.IFERROR = (a) => mapValue(a[0](), v => (isErr(v) ? single(a[1]()) : v));
F.IFNA = (a) => mapValue(a[0](), v => (isErr(v) && v.code === '#N/A' ? single(a[1]()) : v));
F.SWITCH = (a) => {
  const v = single(a[0]());
  let i = 1;
  for (; i + 1 < a.length; i += 2) if (compareValues(v, single(a[i]())) === 0) return a[i + 1]();
  return i < a.length ? a[i]() : NA();
};
F.ISBLANK = (a) => mapValue(a[0](), isBlank);
F.ISNUMBER = (a) => mapValue(a[0](), v => typeof v === 'number');
F.ISTEXT = (a) => mapValue(a[0](), v => typeof v === 'string' && v !== '');
F.ISERROR = (a) => mapValue(a[0](), isErr);
F.ISNA = (a) => mapValue(a[0](), v => isErr(v) && v.code === '#N/A');
F.NA = () => NA();

// ───── Lookup and reference ─────
const findIndex = (list, value, mode) => {
  // mode 0 exact (wildcards for text), 1 largest <= value (sorted ascending), -1 smallest >= value (sorted descending)
  if (mode === 0) {
    const test = typeof value === 'string' && /[*?]/.test(value) ? (v) => typeof v === 'string' && wildcard(value).test(v) : (v) => !isBlank(v) && compareValues(v, value) === 0;
    return list.findIndex(test);
  }
  let best = -1;
  for (let i = 0; i < list.length; i++) {
    if (isBlank(list[i])) continue;
    const c = compareValues(list[i], value);
    if (mode === 1 ? c <= 0 : c >= 0) best = i; else break;
  }
  return best;
};
F.MATCH = (a) => {
  const value = single(a[0]());
  const list = flat(a[1]());
  const mode = numArg(a, 2, 1);
  const i = findIndex(list, value, mode === 0 ? 0 : mode > 0 ? 1 : -1);
  return i < 0 ? NA() : i + 1;
};
F.XMATCH = (a) => {
  const value = single(a[0]());
  const list = flat(a[1]());
  const mode = numArg(a, 2, 0);
  const search = numArg(a, 3, 1);
  const order = search < 0 ? list.map((v, i) => i).reverse() : list.map((v, i) => i);
  if (mode === 0 || mode === 2) {
    const j = findIndex(order.map(i => list[i]), value, 0);
    return j < 0 ? NA() : order[j] + 1;
  }
  let best = -1;
  order.forEach(i => {
    const v = list[i];
    if (isBlank(v)) return;
    const c = compareValues(v, value);
    if (c === 0 && best < 0) best = i;
    else if (mode === -1 && c < 0 && (best < 0 || (compareValues(v, list[best]) > 0 && compareValues(list[best], value) !== 0))) best = i;
    else if (mode === 1 && c > 0 && (best < 0 || (compareValues(v, list[best]) < 0 && compareValues(list[best], value) !== 0))) best = i;
  });
  return best < 0 ? NA() : best + 1;
};
F.INDEX = (a) => {
  const g = toGrid(a[0]());
  const [h, w] = dims(g);
  let r = numArg(a, 1, 0);
  let c = numArg(a, 2, 0);
  if (h === 1 && a.length === 2) { c = r; r = 1; }
  if (r < 0 || c < 0 || r > h || c > w) return err('#REF!');
  if (r === 0 && c === 0) return g;
  if (r === 0) return g.map(row => [row[c - 1]]);
  if (c === 0) return w === 1 ? g[r - 1][0] : [g[r - 1]];
  return g[r - 1][c - 1];
};
F.VLOOKUP = (a) => {
  const value = single(a[0]());
  const g = toGrid(a[1]());
  const col = numArg(a, 2);
  const approx = a[3] ? throwIf(toBool(single(a[3]()))) : true;
  if (col < 1 || col > dims(g)[1]) return err('#REF!');
  const i = findIndex(g.map(r => r[0]), value, approx ? 1 : 0);
  return i < 0 ? NA() : g[i][col - 1];
};
F.HLOOKUP = (a) => {
  const value = single(a[0]());
  const g = toGrid(a[1]());
  const row = numArg(a, 2);
  const approx = a[3] ? throwIf(toBool(single(a[3]()))) : true;
  if (row < 1 || row > g.length) return err('#REF!');
  const i = findIndex(g[0], value, approx ? 1 : 0);
  return i < 0 ? NA() : g[row - 1][i];
};
F.XLOOKUP = (a, e) => {
  const value = single(a[0]());
  const look = toGrid(a[1]());
  const ret = toGrid(a[2]());
  const vertical = look[0].length === 1;
  const list = vertical ? look.map(r => r[0]) : look[0];
  const notFound = a[3] && e.node.args[3].t !== 'blank' ? a[3] : null;
  const mode = numArg(a, 4, 0);
  const search = numArg(a, 5, 1);
  const order = list.map((_, i) => i);
  if (search < 0) order.reverse();
  let hit = -1;
  if (mode === 0 || mode === 2) {
    const j = findIndex(order.map(i => list[i]), value, 0);
    hit = j < 0 ? -1 : order[j];
  } else {
    order.forEach(i => {
      const v = list[i];
      if (isBlank(v) || (hit >= 0 && compareValues(list[hit], value) === 0)) return;
      const c = compareValues(v, value);
      if (c === 0) hit = i;
      else if (mode === -1 && c < 0 && (hit < 0 || compareValues(v, list[hit]) > 0)) hit = i;
      else if (mode === 1 && c > 0 && (hit < 0 || compareValues(v, list[hit]) < 0)) hit = i;
    });
  }
  if (hit < 0) return notFound ? notFound() : NA();
  if (vertical) return ret[0].length === 1 ? ret[hit][0] : [ret[hit]];
  return ret.length === 1 ? ret[0][hit] : ret.map(r => [r[hit]]);
};
F.CHOOSE = (a) => { const i = Math.floor(numArg(a, 0)); return i < 1 || i >= a.length ? VALUE() : a[i](); };
F.ROW = (a, e) => (e.node.args[0] && e.node.args[0].t === 'ref' ? e.node.args[0].row + 1 : e.ctx.row + 1);
F.COLUMN = (a, e) => (e.node.args[0] && e.node.args[0].t === 'ref' ? e.node.args[0].col + 1 : e.ctx.col + 1);
F.ROWS = (a) => dims(toGrid(a[0]()))[0];
F.COLUMNS = (a) => dims(toGrid(a[0]()))[1];

// ───── Text ─────
const liftText = (fn) => (a) => mapValue(a[0](), v => { const s = toStr(v); if (isErr(s)) return s; try { return fn(s, a); } catch (x) { return x instanceof XErr ? x : VALUE(); } });
F.LEFT = liftText((s, a) => s.slice(0, numArg(a, 1, 1)));
F.RIGHT = liftText((s, a) => { const n = numArg(a, 1, 1); return n === 0 ? '' : s.slice(-n); });
F.MID = liftText((s, a) => s.substr(numArg(a, 1) - 1, numArg(a, 2)));
F.LEN = liftText(s => s.length);
F.UPPER = liftText(s => s.toUpperCase());
F.LOWER = liftText(s => s.toLowerCase());
F.PROPER = liftText(s => s.toLowerCase().replace(/(^|[^a-z])([a-z])/g, (m, p, c) => p + c.toUpperCase()));
F.TRIM = liftText(s => s.trim().replace(/ {2,}/g, ' '));
F.CONCAT = (a) => a.map(t => flat(t()).map(v => throwIf(toStr(v))).join('')).join('');
F.CONCATENATE = F.CONCAT;
F.TEXTJOIN = (a) => {
  const sep = strArg(a, 0);
  const skip = throwIf(toBool(single(a[1]())));
  const parts = a.slice(2).flatMap(t => flat(t())).map(v => throwIf(toStr(v))).filter(s => !(skip && s === ''));
  return parts.join(sep);
};
F.SUBSTITUTE = liftText((s, a) => {
  const from = strArg(a, 1);
  const to = strArg(a, 2);
  if (!from) return s;
  if (a[3]) {
    const n = numArg(a, 3);
    let k = 0;
    return s.split(from).reduce((acc, part, i) => (i === 0 ? part : acc + ((++k === n) ? to : from) + part), '');
  }
  return s.split(from).join(to);
});
F.FIND = (a) => { const s = strArg(a, 1); const i = s.indexOf(strArg(a, 0), numArg(a, 2, 1) - 1); return i < 0 ? VALUE() : i + 1; };
F.SEARCH = (a) => {
  const s = strArg(a, 1);
  const start = numArg(a, 2, 1) - 1;
  const re = new RegExp(wildcard(strArg(a, 0)).source.slice(1, -1), 'i');
  const m = re.exec(s.slice(start));
  return m ? m.index + start + 1 : VALUE();
};
F.REPT = liftText((s, a) => s.repeat(Math.max(0, numArg(a, 1))));
F.EXACT = (a) => strArg(a, 0) === strArg(a, 1);
F.VALUE = (a) => mapValue(a[0](), v => toNum(v));
F.TEXTBEFORE = liftText((s, a) => { const d = strArg(a, 1); const i = s.indexOf(d); return i < 0 ? NA() : s.slice(0, i); });
F.TEXTAFTER = liftText((s, a) => { const d = strArg(a, 1); const i = s.indexOf(d); return i < 0 ? NA() : s.slice(i + d.length); });
F.CHAR = (a) => String.fromCharCode(numArg(a, 0));

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const formatText = (value, fmt) => {
  const f = String(fmt);
  if (/[ymd]/i.test(f) && !/^[#0.,%]+$/.test(f)) {
    const n = toNum(value);
    if (isErr(n)) return n;
    const d = serialToDate(n);
    const Y = d.getUTCFullYear();
    const M = d.getUTCMonth();
    const D = d.getUTCDate();
    return f.replace(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d/gi, (t) => {
      switch (t.toLowerCase()) {
        case 'yyyy': return String(Y);
        case 'yy': return String(Y).slice(-2);
        case 'mmmm': return MONTHS[M];
        case 'mmm': return MONTHS[M].slice(0, 3);
        case 'mm': return String(M + 1).padStart(2, '0');
        case 'm': return String(M + 1);
        case 'dddd': return DAYS[d.getUTCDay()];
        case 'ddd': return DAYS[d.getUTCDay()].slice(0, 3);
        case 'dd': return String(D).padStart(2, '0');
        default: return String(D);
      }
    });
  }
  const n = toNum(value);
  if (isErr(n)) return typeof value === 'string' ? value : n;
  const pct = f.includes('%');
  const x = pct ? n * 100 : n;
  const dec = (f.split('.')[1] || '').replace(/[^0#]/g, '').length;
  const grouped = f.includes(',');
  const s = Math.abs(x).toFixed(dec);
  const [int, frac] = s.split('.');
  const intOut = grouped ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : int;
  return `${x < 0 ? '-' : ''}${intOut}${frac ? `.${frac}` : ''}${pct ? '%' : ''}`;
};
F.TEXT = (a) => mapValue(a[0](), v => formatText(v, strArg(a, 1)));

// ───── Dates ─────
const serial = (v) => throwIf(toNum(single(v)));
const iso = (n) => serialToIso(n);
F.DATE = (a) => {
  const y = numArg(a, 0);
  const m = numArg(a, 1);
  const d = numArg(a, 2);
  return iso(dateToSerial(y, 1, 1) + (Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000)));
};
F.TODAY = () => new Date().toISOString().slice(0, 10);
F.NOW = () => (Date.now() - Date.UTC(1899, 11, 30)) / 86400000;
const part = (fn) => (a) => mapValue(a[0](), v => { const n = toNum(v); return isErr(n) ? n : fn(serialToDate(n)); });
F.YEAR = part(d => d.getUTCFullYear());
F.MONTH = part(d => d.getUTCMonth() + 1);
F.DAY = part(d => d.getUTCDate());
F.WEEKDAY = (a) => { const d = serialToDate(serial(a[0]())); const type = numArg(a, 1, 1); const w = d.getUTCDay(); return type === 2 ? ((w + 6) % 7) + 1 : type === 3 ? (w + 6) % 7 : w + 1; };
F.WEEKNUM = (a) => { const n = serial(a[0]()); const d = serialToDate(n); const jan1 = dateToSerial(d.getUTCFullYear(), 1, 1); const type = numArg(a, 1, 1); const offset = (serialToDate(jan1).getUTCDay() - (type === 2 ? 1 : 0) + 7) % 7; return Math.floor((n - jan1 + offset) / 7) + 1; };
F.EOMONTH = (a) => { const d = serialToDate(serial(a[0]())); const m = numArg(a, 1); return iso(Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m + 1, 0) - Date.UTC(1899, 11, 30)) / 86400000)); };
F.EDATE = (a) => {
  const d = serialToDate(serial(a[0]()));
  const m = numArg(a, 1);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return iso(dateToSerial(target.getUTCFullYear(), target.getUTCMonth() + 1, Math.min(d.getUTCDate(), last)));
};
F.DAYS = (a) => serial(a[0]()) - serial(a[1]());
F.DATEDIF = (a) => {
  const s = serial(a[0]());
  const e = serial(a[1]());
  if (e < s) return NUM();
  const u = strArg(a, 2).toUpperCase();
  const d1 = serialToDate(s);
  const d2 = serialToDate(e);
  const months = (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 + d2.getUTCMonth() - d1.getUTCMonth() - (d2.getUTCDate() < d1.getUTCDate() ? 1 : 0);
  if (u === 'D') return e - s;
  if (u === 'M') return months;
  if (u === 'Y') return Math.floor(months / 12);
  return NUM();
};
const isWorkday = (n) => { const w = serialToDate(n).getUTCDay(); return w !== 0 && w !== 6; };
F.NETWORKDAYS = (a) => {
  let s = serial(a[0]());
  let e = serial(a[1]());
  const sign = e < s ? -1 : 1;
  if (sign < 0) [s, e] = [e, s];
  const holidays = new Set(a[2] ? flat(a[2]()).map(v => toNum(v)).filter(v => typeof v === 'number') : []);
  let n = 0;
  for (let d = s; d <= e; d++) if (isWorkday(d) && !holidays.has(d)) n++;
  return sign * n;
};
F.WORKDAY = (a) => {
  let d = serial(a[0]());
  let k = numArg(a, 1);
  const step = k < 0 ? -1 : 1;
  while (k !== 0) { d += step; if (isWorkday(d)) k -= step; }
  return iso(d);
};

// ───── Dynamic arrays ─────
F.SEQUENCE = (a) => {
  const r = numArg(a, 0);
  const c = numArg(a, 1, 1);
  const start = numArg(a, 2, 1);
  const step = numArg(a, 3, 1);
  if (r < 1 || c < 1) return err('#CALC!');
  return Array.from({ length: r }, (_, i) => Array.from({ length: c }, (__, j) => start + (i * c + j) * step));
};
F.TRANSPOSE = (a) => { const g = toGrid(a[0]()); return g[0].map((_, j) => g.map(row => row[j])); };
F.FILTER = (a) => {
  const g = toGrid(a[0]());
  const inc = toGrid(a[1]());
  const [h, w] = dims(g);
  const [ih, iw] = dims(inc);
  let out;
  if (iw === 1 && ih === h) out = g.filter((_, i) => { const v = inc[i][0]; if (isErr(v)) throw v; return throwIf(toBool(v)); });
  else if (ih === 1 && iw === w) { const keep = inc[0].map(v => throwIf(toBool(v))); out = g.map(row => row.filter((_, j) => keep[j])); if (!out[0].length) out = []; }
  else return VALUE();
  if (!out.length) return a[2] ? a[2]() : err('#CALC!');
  return out;
};
const sortRows = (g, keys) => g.map((row, i) => ({ row, i })).sort((x, y) => {
  for (const { col, by, dir } of keys) {
    const vx = by ? by[x.i] : x.row[col];
    const vy = by ? by[y.i] : y.row[col];
    const c = compareValues(vx, vy);
    if (c) return dir * c;
  }
  return x.i - y.i;
}).map(o => o.row);
F.SORT = (a) => {
  const g = toGrid(a[0]());
  const idx = numArg(a, 1, 1);
  const dir = numArg(a, 2, 1) < 0 ? -1 : 1;
  const byCol = a[3] ? throwIf(toBool(single(a[3]()))) : false;
  if (byCol) { const t = g[0].map((_, j) => g.map(r => r[j])); const s = sortRows(t, [{ col: idx - 1, dir }]); return s[0].map((_, j) => s.map(r => r[j])); }
  if (idx < 1 || idx > dims(g)[1]) return VALUE();
  return sortRows(g, [{ col: idx - 1, dir }]);
};
F.SORTBY = (a) => {
  const g = toGrid(a[0]());
  const keys = [];
  for (let i = 1; i < a.length; i += 2) keys.push({ by: flat(a[i]()), dir: (a[i + 1] ? numArg(a, i + 1, 1) : 1) < 0 ? -1 : 1 });
  if (keys.some(k => k.by.length !== g.length)) return VALUE();
  return sortRows(g, keys);
};
F.UNIQUE = (a) => {
  const g = toGrid(a[0]());
  const byCol = a[1] ? throwIf(toBool(single(a[1]()))) : false;
  const once = a[2] ? throwIf(toBool(single(a[2]()))) : false;
  const rows = byCol ? g[0].map((_, j) => g.map(r => r[j])) : g;
  const key = (r) => JSON.stringify(r.map(v => (typeof v === 'string' ? v.toLowerCase() : v instanceof XErr ? v.code : v)));
  const counts = new Map();
  rows.forEach(r => counts.set(key(r), (counts.get(key(r)) || 0) + 1));
  const seen = new Set();
  const out = rows.filter(r => { const k = key(r); if (seen.has(k) || (once && counts.get(k) > 1)) return false; seen.add(k); return true; });
  if (!out.length) return err('#CALC!');
  return byCol ? out[0].map((_, j) => out.map(r => r[j])) : out;
};
F.TAKE = (a) => {
  const g = toGrid(a[0]());
  const r = a[1] ? numArg(a, 1) : g.length;
  const c = a[2] ? numArg(a, 2) : g[0].length;
  const rows = r >= 0 ? g.slice(0, r) : g.slice(r);
  return rows.map(row => (c >= 0 ? row.slice(0, c) : row.slice(c)));
};
F.DROP = (a) => {
  const g = toGrid(a[0]());
  const r = a[1] ? numArg(a, 1) : 0;
  const c = a[2] ? numArg(a, 2) : 0;
  const rows = r >= 0 ? g.slice(r) : g.slice(0, r);
  const out = rows.map(row => (c >= 0 ? row.slice(c) : row.slice(0, c)));
  return out.length && out[0].length ? out : err('#CALC!');
};
F.CHOOSECOLS = (a) => { const g = toGrid(a[0]()); const cols = a.slice(1).map((_, i) => numArg(a, i + 1)); return g.map(row => cols.map(c => row[c > 0 ? c - 1 : row.length + c])); };
F.VSTACK = (a) => { const parts = a.map(t => toGrid(t())); const w = Math.max(...parts.map(p => dims(p)[1])); return parts.flatMap(p => p.map(r => [...r, ...Array(w - r.length).fill(NA())])); };
F.HSTACK = (a) => { const parts = a.map(t => toGrid(t())); const h = Math.max(...parts.map(p => p.length)); return Array.from({ length: h }, (_, i) => parts.flatMap(p => p[i] || Array(dims(p)[1]).fill(NA()))); };
F.LET = (a, e) => {
  const names = {};
  for (let i = 0; i + 1 < a.length; i += 2) {
    const n = e.node.args[i];
    if (!n || n.t !== 'name') return VALUE();
    names[n.v] = a[i + 1](names);
  }
  return a[a.length - 1](names);
};

export const FUNCTIONS = F;
export const FUNCTION_NAMES = Object.keys(F).sort();
export { formatNumber, single };
