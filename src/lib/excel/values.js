// Value model shared by the engine and the functions.
// Scalars: number | string | boolean | null (blank) | XErr. Arrays: 2D JS arrays.

export class XErr {
  constructor(code) { this.code = code; }
  toString() { return this.code; }
}
export const err = (code) => new XErr(code);
export const NA = () => err('#N/A');
export const VALUE = () => err('#VALUE!');
export const DIV0 = () => err('#DIV/0!');
export const NUM = () => err('#NUM!');
export const REF = () => err('#REF!');
export const isErr = (v) => v instanceof XErr;
export const isArr = (v) => Array.isArray(v);
export const isBlank = (v) => v === null || v === undefined || v === '';

// Excel date serials: 1 = 1900-01-01, with Excel's 1900 leap year quirk,
// so serials from 61 match Excel exactly (25569 = 1970-01-01).
const EPOCH = Date.UTC(1899, 11, 30);
export const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
export const dateToSerial = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000);
export const isoToSerial = (s) => { const m = ISO.exec(s); return m ? dateToSerial(+m[1], +m[2], +m[3]) : null; };
export const serialToDate = (n) => new Date(EPOCH + Math.floor(n) * 86400000);
export const serialToIso = (n) => serialToDate(n).toISOString().slice(0, 10);

export const toNum = (v) => {
  if (isErr(v)) return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (isBlank(v)) return 0;
  if (typeof v === 'string') {
    const s = v.trim();
    const iso = isoToSerial(s);
    if (iso !== null) return iso;
    const pct = /^(-?\d*\.?\d+)%$/.exec(s);
    if (pct) return Number(pct[1]) / 100;
    if (s !== '' && Number.isFinite(Number(s.replace(/,/g, '')))) return Number(s.replace(/,/g, ''));
  }
  return VALUE();
};

export const toStr = (v) => {
  if (isErr(v)) return v;
  if (isBlank(v)) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return formatNumber(v);
  return String(v);
};

export const toBool = (v) => {
  if (isErr(v)) return v;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (isBlank(v)) return false;
  if (/^true$/i.test(v)) return true;
  if (/^false$/i.test(v)) return false;
  return VALUE();
};

// Up to 15 significant digits, like Excel's general format.
export const formatNumber = (n) => {
  if (!Number.isFinite(n)) return '#NUM!';
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toPrecision(15)));
};

// Excel ordering: numbers < text < booleans; text compares case insensitively.
// ISO date text compared with a number is treated as a date serial.
export const compareValues = (a, b) => {
  if (isBlank(a)) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
  if (isBlank(b)) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
  if (typeof a === 'string' && typeof b === 'number' && ISO.test(a)) a = isoToSerial(a);
  if (typeof b === 'string' && typeof a === 'number' && ISO.test(b)) b = isoToSerial(b);
  const rank = (v) => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (typeof a === 'string') { const x = a.toLowerCase(); const y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }
  return a < b ? -1 : a > b ? 1 : 0;
};

// Shape helpers for 2D arrays.
export const toGrid = (v) => (isArr(v) ? v : [[v]]);
export const dims = (g) => [g.length, g[0] ? g[0].length : 0];
export const flat = (v) => (isArr(v) ? v.flat() : [v]);
export const single = (v) => (isArr(v) ? v[0][0] : v);

// Elementwise binary operation with Excel style broadcasting.
export const broadcast = (a, b, fn) => {
  if (!isArr(a) && !isArr(b)) return fn(a, b);
  const ga = toGrid(a);
  const gb = toGrid(b);
  const [ra, ca] = dims(ga);
  const [rb, cb] = dims(gb);
  const rows = Math.max(ra, rb);
  const cols = Math.max(ca, cb);
  const pick = (g, r, c, gr, gc) => {
    const rr = gr === 1 ? 0 : r;
    const cc = gc === 1 ? 0 : c;
    return rr < gr && cc < gc ? g[rr][cc] : NA();
  };
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (__, c) => fn(pick(ga, r, c, ra, ca), pick(gb, r, c, rb, cb))));
};
export const mapValue = (v, fn) => (isArr(v) ? v.map(row => row.map(fn)) : fn(v));

