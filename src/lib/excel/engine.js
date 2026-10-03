import { parseFormula, refName } from './parser';
import { FUNCTIONS } from './functions';
import { XErr, err, isErr, isArr, isBlank, toNum, toStr, compareValues, dims, single, broadcast, mapValue } from './values';

export { mapValue };

const MAX_SPILL = 100000;
const arith = (op) => (x, y) => {
  const a = toNum(x);
  const b = toNum(y);
  if (isErr(a)) return a;
  if (isErr(b)) return b;
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? err('#DIV/0!') : a / b;
    case '^': { const r = a ** b; return Number.isFinite(r) ? r : err('#NUM!'); }
    default: return err('#VALUE!');
  }
};
const cmp = (op) => (x, y) => {
  if (isErr(x)) return x;
  if (isErr(y)) return y;
  const c = compareValues(x, y);
  return { '=': c === 0, '<>': c !== 0, '<': c < 0, '>': c > 0, '<=': c <= 0, '>=': c >= 0 }[op];
};
const join = (x, y) => {
  const a = toStr(x);
  const b = toStr(y);
  if (isErr(a)) return a;
  if (isErr(b)) return b;
  return a + b;
};

// A sheet: raw cell contents plus a memoised evaluator.
// Cells holding text that starts with "=" are formulas.
export class Sheet {
  constructor() {
    this.raw = new Map(); // "r,c" → string | number | boolean
    this.formulas = new Set(); // keys of cells holding formulas
    this.maxRow = 0;
    this.maxCol = 0;
    this.reset();
  }

  reset() {
    this.cache = new Map();
    this.spill = new Map(); // "r,c" → origin key
    this.visiting = new Set();
    this.parsed = new Map();
    this.spillsReady = false;
    this.resolving = false;
  }

  static fromRows(columns, rows) {
    const s = new Sheet();
    // Data cells are written straight into the map (no per cell cache reset),
    // so loading thousands of rows stays fast.
    columns.forEach((c, j) => { if (!isBlank(c)) s.raw.set(`0,${j}`, c); });
    rows.forEach((r, i) => columns.forEach((c, j) => {
      const v = r[c];
      if (!isBlank(v)) s.raw.set(`${i + 1},${j}`, typeof v === 'string' && v.startsWith('=') ? `'${v}` : v);
    }));
    s.maxRow = rows.length;
    s.maxCol = Math.max(0, columns.length - 1);
    s.reset();
    return s;
  }

  setRaw(row, col, value) {
    const key = `${row},${col}`;
    if (isBlank(value)) this.raw.delete(key); else this.raw.set(key, value);
    if (typeof value === 'string' && value.startsWith('=')) this.formulas.add(key); else this.formulas.delete(key);
    if (!isBlank(value)) { this.maxRow = Math.max(this.maxRow, row); this.maxCol = Math.max(this.maxCol, col); }
    this.reset();
  }

  getRaw(row, col) { return this.raw.get(`${row},${col}`); }

  formulaCells() {
    return [...this.formulas].map(k => k.split(',').map(Number));
  }

  ast(key, text) {
    if (!this.parsed.has(key)) {
      try { this.parsed.set(key, parseFormula(text)); } catch (e) { this.parsed.set(key, { t: 'parseError', message: e.message }); }
    }
    return this.parsed.get(key);
  }

  // Result of the formula in a cell (array for spilling formulas).
  result(row, col) {
    const key = `${row},${col}`;
    if (this.cache.has(key)) return this.cache.get(key);
    if (this.visiting.has(key)) return err('#CIRC!');
    const raw = this.raw.get(key);
    let out;
    if (typeof raw === 'string' && raw.startsWith('=')) {
      this.visiting.add(key);
      const node = this.ast(key, raw);
      out = node.t === 'parseError' ? err('#NAME?') : this.evaluate(node, { row, col, names: {} });
      this.visiting.delete(key);
      if (isArr(out)) out = this.place(row, col, out);
    } else if (typeof raw === 'string' && raw.startsWith("'")) {
      out = raw.slice(1);
    } else {
      out = raw === undefined ? null : raw;
    }
    this.cache.set(key, out);
    return out;
  }

  // Claims spill cells for an array result, or returns #SPILL!.
  place(row, col, arr) {
    const [h, w] = dims(arr);
    if (h === 0 || w === 0) return err('#CALC!');
    if (h === 1 && w === 1) return arr;
    if (h * w > MAX_SPILL) return err('#SPILL!');
    const origin = `${row},${col}`;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (r === 0 && c === 0) continue;
        const k = `${row + r},${col + c}`;
        if (this.raw.has(k) || (this.spill.has(k) && this.spill.get(k) !== origin)) return err('#SPILL!');
      }
    }
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (r || c) this.spill.set(`${row + r},${col + c}`, origin);
    return arr;
  }

  // Displayed value of any cell, including cells filled by a spill.
  value(row, col) {
    const key = `${row},${col}`;
    if (this.raw.has(key)) return single(this.result(row, col));
    this.resolveSpills(row, col);
    const origin = this.spill.get(key);
    if (!origin) return null;
    const [r0, c0] = origin.split(',').map(Number);
    const arr = this.result(r0, c0);
    return isArr(arr) ? arr[row - r0][col - c0] : null;
  }

  // Makes sure spills that could cover a blank cell are known. The first
  // time, every formula is evaluated once; while that pass is running,
  // only formulas above and left of the cell are evaluated.
  resolveSpills(row, col) {
    if (this.spillsReady) return;
    if (!this.resolving) {
      this.resolving = true;
      this.formulaCells().forEach(([r, c]) => this.result(r, c));
      this.resolving = false;
      this.spillsReady = true;
      return;
    }
    this.formulaCells().forEach(([r, c]) => { if (r <= row && c <= col && !(r === row && c === col)) this.result(r, c); });
  }

  isSpillCell(row, col) { return this.spill.has(`${row},${col}`); }

  spillOrigin(row, col) {
    const res = this.raw.has(`${row},${col}`) ? this.result(row, col) : null;
    return isArr(res) ? dims(res) : null;
  }

  rangeValues(r1, c1, r2, c2) {
    const last = r2 === null ? this.usedRows() - 1 : r2;
    const out = [];
    for (let r = r1; r <= last; r++) {
      const row = [];
      for (let c = c1; c <= c2; c++) row.push(this.value(r, c));
      out.push(row);
    }
    return out.length ? out : [[null]];
  }

  usedRows() {
    let max = this.maxRow;
    this.spill.forEach((_, k) => { max = Math.max(max, Number(k.split(',')[0])); });
    return max + 1;
  }

  evaluate(node, ctx) {
    switch (node.t) {
      case 'num': case 'str': case 'bool': return node.v;
      case 'blank': return null;
      case 'err': return err(node.v);
      case 'arr': return node.rows;
      case 'ref': return this.value(node.row, node.col);
      case 'range': return this.rangeValues(node.r1, node.c1, node.r2, node.c2);
      case 'name':
        if (node.v in ctx.names) return ctx.names[node.v];
        return err('#NAME?');
      case 'neg': return mapValue(this.evaluate(node.a, ctx), v => { const n = toNum(v); return isErr(n) ? n : -n; });
      case 'pct': return mapValue(this.evaluate(node.a, ctx), v => { const n = toNum(v); return isErr(n) ? n : n / 100; });
      case 'bin': {
        const a = this.evaluate(node.a, ctx);
        const b = this.evaluate(node.b, ctx);
        if (['+', '-', '*', '/', '^'].includes(node.op)) return broadcast(a, b, arith(node.op));
        if (node.op === '&') return broadcast(a, b, join);
        return broadcast(a, b, cmp(node.op));
      }
      case 'fn': {
        const fn = FUNCTIONS[node.name];
        if (!fn) return err('#NAME?');
        // Lazy args let IF, IFERROR, LET and friends skip work and catch errors.
        const lazy = node.args.map(a => (names) => this.evaluate(a, names ? { ...ctx, names: { ...ctx.names, ...names } } : ctx));
        try {
          return fn(lazy, { sheet: this, node, ctx });
        } catch (e) {
          return e instanceof XErr ? e : err('#VALUE!');
        }
      }
      default: return err('#VALUE!');
    }
  }

  // Evaluates a formula as if it were typed at (row, col) without storing it.
  evaluateAt(formula, row, col) {
    const node = parseFormula(formula);
    return this.evaluate(node, { row, col, names: {} });
  }

  describe(row, col) { return refName(row, col); }
}
